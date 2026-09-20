import type {
  CaseInput,
  ChoiceResult,
  JudgeResult,
  Party,
  Ruling,
  ScoreResult,
} from "./types";
import { OUTCOME_MATCH_QUESTIONS, QUESTIONS } from "./questions";
import {
  systemOne,
  type ChoiceAnswer,
  type JsonState,
  type ScoreAnswer,
} from "./typesafe";

export { QUESTIONS, type QuestionId } from "./questions";

/** Below this confidence the ruling is flagged for human review. */
export const REVIEW_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// State: the case record as a structured object. Questions reference fields
// by path (e.g. `case.facts`), per https://docs.typesafe.ai/concepts/state
// ---------------------------------------------------------------------------

export function buildState(c: CaseInput): JsonState {
  const opt = (v?: string) => (v?.trim() ? v.trim() : undefined);
  const prune = (o: Record<string, JsonState | undefined>): JsonState =>
    Object.fromEntries(
      Object.entries(o).filter(([, v]) => v !== undefined),
    ) as JsonState;

  return prune({
    case: prune({
      title: c.title.trim(),
      jurisdiction: opt(c.jurisdiction),
      court: opt(c.court),
      case_type: opt(c.caseType),
      question_presented: opt(c.questionPresented),
      facts: c.facts.trim(),
      procedural_history: opt(c.proceduralHistory),
      evidence: opt(c.evidence),
      arguments: prune({
        plaintiff: opt(c.plaintiffArguments),
        defendant: opt(c.defendantArguments),
      }),
      law: prune({
        applicable: opt(c.applicableLaw),
        precedents: opt(c.precedents),
      }),
      additional_context: opt(c.additionalContext),
    }),
  });
}


// ---------------------------------------------------------------------------
// Composition: deterministic code turns atomic answers into a ruling.
// ---------------------------------------------------------------------------

const toChoice = (a: ChoiceAnswer): ChoiceResult => ({
  choice: a.choice,
  probabilities: a.probabilities,
  confidence: a.confidence,
});

const toScore = (a: ScoreAnswer): ScoreResult => {
  const keys = Object.keys(a.legend).sort((x, y) => Number(x) - Number(y));
  return {
    score: a.score,
    max: keys.length - 1,
    legend: keys.map((k) => {
      const l = a.legend[k];
      if (l === null) return k;
      return typeof l === "string" ? l : String(l.what ?? JSON.stringify(l));
    }),
    probabilities: a.probabilities,
    confidence: a.confidence,
  };
};

const humanize = (s: string) => s.replace(/_/g, " ");

const DISPOSITION_TEXT: Record<Party, string> = {
  plaintiff: "Judgment for the party seeking relief (plaintiff/prosecution/appellant).",
  defendant: "Judgment for the defending party; relief denied.",
  mixed: "Relief granted in part and denied in part.",
  other: "No disposition on the merits.",
};

export function composeRuling(
  answers: Awaited<ReturnType<typeof systemOne<typeof QUESTIONS>>>["answers"],
): Ruling {
  const pp = toChoice(answers.prevailing_party);
  const app = toChoice(answers.appellate_disposition);
  const remedy = toChoice(answers.remedy);
  const prevailingParty = pp.choice as Party;

  const findings: Record<string, number> = {};
  const scores: Record<string, ScoreResult> = {};
  for (const [id, a] of Object.entries(answers)) {
    if (a.type === "noul") findings[id] = a.noul;
    else if (a.type === "score") scores[id] = toScore(a);
  }

  const parts = [DISPOSITION_TEXT[prevailingParty] ?? DISPOSITION_TEXT.other];
  if (app.choice !== "not_on_appeal" && app.probabilities.not_on_appeal < 0.5) {
    parts.push(`Decision below: ${humanize(app.choice)}.`);
  }
  if (remedy.confidence >= 0.5) parts.push(`Remedy: ${humanize(remedy.choice)}.`);

  const keyFactors: string[] = [];
  for (const [id, p] of Object.entries(findings)) {
    if (p >= 0.75) keyFactors.push(`${humanize(id)}: likely (${pct(p)})`);
    else if (p <= 0.25) keyFactors.push(`${humanize(id)}: unlikely (${pct(p)})`);
  }
  for (const [id, s] of Object.entries(scores)) {
    keyFactors.push(`${humanize(id)}: ${s.score.toFixed(1)}/${s.max} — ${s.legend[Math.round(s.score)]}`);
  }

  const needsReview =
    pp.confidence < REVIEW_THRESHOLD ||
    scores.record_sufficiency.score < 0.5 ||
    findings.procedural_bar > 0.5;

  return {
    ruling: parts.join(" "),
    prevailingParty,
    confidence: pp.confidence,
    needsReview,
    prevailingPartyAnswer: pp,
    appellateDisposition: app,
    remedy,
    findings,
    scores,
    keyFactors,
  };
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function judgeCase(c: CaseInput): Promise<JudgeResult> {
  const t0 = Date.now();
  const res = await systemOne(buildState(c), QUESTIONS);
  const ruling = composeRuling(res.answers);

  const result: JudgeResult = {
    caseId: c.id ?? crypto.randomUUID(),
    title: c.title,
    ruling,
    model: res.model,
    latencyMs: Date.now() - t0,
    inputTokens: res.usage.input_tokens,
  };

  if (c.actualOutcome?.trim()) result.actualOutcome = c.actualOutcome.trim();

  if (c.actualPrevailingParty) {
    result.actualPrevailingParty = c.actualPrevailingParty;
    result.matchesActual = ruling.prevailingParty === c.actualPrevailingParty;
    result.matchProbability = ruling.prevailingPartyAnswer.probabilities[c.actualPrevailingParty] ?? 0;
  } else if (result.actualOutcome) {
    const cmp = await systemOne(
      {
        predicted: {
          prevailing_party: ruling.prevailingParty,
          disposition: ruling.ruling,
        },
        actual_outcome: result.actualOutcome,
      },
      OUTCOME_MATCH_QUESTIONS,
    );
    result.matchProbability = cmp.answers.matches.noul;
    result.matchesActual = cmp.answers.matches.noul >= 0.5;
    result.inputTokens += cmp.usage.input_tokens;
  }
  return result;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onSettled: (
    index: number,
    outcome: { ok: true; value: R } | { ok: false; error: unknown },
  ) => void,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        onSettled(i, { ok: true, value: await fn(items[i], i) });
      } catch (error) {
        onSettled(i, { ok: false, error });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}
