import type {
  CaseInput,
  ChoiceResult,
  JudgeResult,
  Party,
  Ruling,
  ScoreResult,
} from "./types";
import {
  choice,
  noul,
  score,
  systemOne,
  type ChoiceAnswer,
  type JsonState,
  type ScoreAnswer,
} from "./typesafe";

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
// Questions: one parallel battery of atomic Choice / Score / Noul questions.
// "plaintiff" = the party seeking relief (plaintiff, prosecution, petitioner,
// appellant, movant); "defendant" = the party opposing it.
// ---------------------------------------------------------------------------

const PARTY_NOTE =
  'Treat "plaintiff" as the party seeking relief in `case` (plaintiff, prosecution, petitioner, appellant, or movant) and "defendant" as the party opposing relief.';

const STRENGTH_SCALE = [
  { what: "No viable case; fails on the record as a matter of law" },
  { what: "Weak; significant gaps in facts, evidence, or legal support" },
  { what: "Arguable; genuine dispute that could go either way" },
  { what: "Strong; well supported by the record and the applicable law" },
  { what: "Compelling; the record and law point clearly to this party" },
];

export const QUESTIONS = {
  prevailing_party: choice(
    `Applying the applicable law in \`case.law\` to the facts in \`case.facts\` and the evidence in \`case.evidence\`, which party should prevail on the question in \`case.question_presented\` (or, if absent, on the dispute as a whole)? ${PARTY_NOTE}`,
    {
      plaintiff: {
        what: "The party seeking relief wins on the dispositive issue(s); its claim, motion, or appeal is granted or its conviction sought is entered",
        not_for: "Cases where relief is granted only in small part",
      },
      defendant: {
        what: "The party opposing relief wins; the claim, motion, or appeal is denied, dismissed, or the defendant is acquitted",
        not_for: "Cases where the defendant loses on the main issue but wins a minor point",
      },
      mixed: {
        what: "Each side wins a substantial part; relief granted in part and denied in part, or affirmed in part and reversed in part",
      },
      other: {
        what: "No party prevails on the merits: e.g. remand for further proceedings without deciding, dismissal for want of jurisdiction, or the record is insufficient to decide",
      },
    },
  ),

  appellate_disposition: choice(
    "If `case.procedural_history` shows this matter is on appeal or review of a lower decision, what should the reviewing court do with the decision below? If it is not on appeal, choose not_on_appeal.",
    {
      affirmed: "Lower decision upheld in full",
      reversed: "Lower decision overturned in full",
      affirmed_in_part_reversed_in_part: "Some holdings upheld, others overturned",
      vacated_and_remanded: "Lower decision set aside and sent back for further proceedings without deciding the merits",
      dismissed: "Appeal dismissed (e.g. untimely, moot, no jurisdiction)",
      not_on_appeal: "This is a first-instance matter, not review of a lower decision",
    },
  ),

  remedy: choice(
    "What remedy or order should the court enter, given the relief requested in `case.arguments.plaintiff` and the outcome the record supports?",
    {
      compensatory_damages: "Money damages measured by the plaintiff's loss",
      nominal_or_limited_damages: "Token or sharply limited damages",
      punitive_damages: "Damages intended to punish, in addition to compensation",
      specific_performance_or_injunction: "Order compelling or forbidding conduct, or compelling performance",
      declaratory_relief: "Declaration of rights without coercive order",
      restitution: "Return of money or property, disgorgement",
      dismissal_or_judgment_for_defendant: "Claim dismissed or judgment entered against the party seeking relief; no relief awarded",
      new_trial_or_remand: "Case sent back for a new trial or further proceedings",
      criminal_sentence: "Conviction with a sentence (fine, probation, imprisonment)",
      acquittal: "Criminal defendant found not guilty",
      other: "Some other remedy, or none of these fits",
    },
  ),

  // Element-by-element findings (Nouls). Probabilities, not verdicts.
  duty_or_obligation: noul(
    `On \`case.facts\` and \`case.law\`, the defendant owed the plaintiff a legal duty or obligation (or, in a criminal matter, the charged conduct is proscribed by the cited law). ${PARTY_NOTE}`,
  ),
  breach_or_violation: noul(
    "On `case.facts` and `case.evidence`, the defendant's conduct breached that duty or violated the applicable law.",
  ),
  causation: noul(
    "On `case.facts` and `case.evidence`, the defendant's conduct was the legal (proximate) cause of the harm the plaintiff complains of.",
  ),
  harm_or_damages_proven: noul(
    "The plaintiff has proven cognizable harm or damages on `case.evidence`, not merely alleged them.",
  ),
  standard_of_proof_met: noul(
    "Taken together, `case.evidence` meets the standard of proof that applies to this kind of case (preponderance, clear and convincing, or beyond a reasonable doubt as appropriate).",
  ),
  affirmative_defense_succeeds: noul(
    "An affirmative defense or justification raised in `case.arguments.defendant` (e.g. consent, contributory negligence, statute of limitations, impossibility, self-defense, immunity) defeats or substantially reduces the plaintiff's claim.",
  ),
  procedural_bar: noul(
    "A procedural or jurisdictional defect (lack of standing, jurisdiction, untimeliness, failure to preserve the issue, waiver) bars the court from reaching the merits.",
  ),
  precedent_favors_plaintiff: noul(
    "The precedents in `case.law.precedents`, as described, on balance support the plaintiff's position rather than the defendant's.",
  ),
  statute_favors_plaintiff: noul(
    "The plain text of the statutes, rules, or contract terms in `case.law.applicable` on balance supports the plaintiff's position rather than the defendant's.",
  ),
  novel_question_of_law: noul(
    "Resolving `case.question_presented` requires the court to decide a question of law not clearly settled by `case.law`.",
  ),

  // Scores: ordered scales.
  plaintiff_case_strength: score(
    `How strong is the plaintiff's overall case on the record in \`case\`? ${PARTY_NOTE}`,
    STRENGTH_SCALE,
  ),
  defendant_case_strength: score(
    "How strong is the defendant's overall position (defenses and counter-arguments in `case.arguments.defendant`) on the record in `case`?",
    STRENGTH_SCALE,
  ),
  record_sufficiency: score(
    "How complete is the record in `case` for deciding the question presented?",
    [
      { what: "Critical facts, evidence, or law are missing; any ruling would be speculative" },
      { what: "Notable gaps, but the core dispute can be decided" },
      { what: "Essentially complete; the court has what it needs" },
    ],
  ),
  legal_clarity: score(
    "How clearly does `case.law` (applicable law and precedents) dictate the outcome?",
    [
      { what: "Law is unsettled or silent; outcome turns on policy or first-principles reasoning" },
      { what: "Law provides a framework but its application to these facts is contestable" },
      { what: "Law is settled and squarely controls these facts" },
    ],
  ),
  harm_severity: score(
    "How severe is the harm to the plaintiff described in `case.facts` and `case.evidence`?",
    [
      { what: "None or trivial" },
      { what: "Minor; modest financial loss or inconvenience" },
      { what: "Serious; substantial financial loss, injury, or loss of liberty at stake" },
      { what: "Grave; death, permanent injury, or ruinous loss" },
    ],
  ),
};

export type QuestionId = keyof typeof QUESTIONS;

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
    if (a.type === "noul") findings[id] = a.probability;
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

  if (c.actualOutcome?.trim()) {
    result.actualOutcome = c.actualOutcome.trim();
    const cmp = await systemOne(
      {
        predicted: {
          prevailing_party: ruling.prevailingParty,
          disposition: ruling.ruling,
        },
        actual_outcome: result.actualOutcome,
      },
      {
        matches: noul(
          "`predicted` reaches the same result as `actual_outcome` as to which party prevailed on the main issue. Ignore differences in wording, remedy detail, or amount.",
        ),
      },
    );
    result.matchProbability = cmp.answers.matches.probability;
    result.matchesActual = cmp.answers.matches.probability >= 0.5;
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
