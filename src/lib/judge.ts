import { complete, getLLMConfig } from "./llm";
import type { CaseInput, JudgeResult, Ruling } from "./types";

export const JUDGE_SYSTEM_PROMPT = `You are Jev, a presiding judge. You are given the record of a case and must issue a ruling as a court would.

Rules:
- Rule ONLY on the record provided. Do not invent facts. If the record is insufficient, say so in your reasoning and lower your confidence.
- Apply the applicable law and precedents given; if none are given, apply the law of the stated jurisdiction to the best of your knowledge and say which authorities you are relying on.
- Be decisive: state a clear disposition (e.g. "Judgment for plaintiff", "Motion to dismiss granted", "Conviction affirmed", "Reversed and remanded").
- Confidence is a probability from 0 to 1 that your disposition is the one a competent appellate court would reach on this record. Be calibrated: 0.5 means a coin flip.
- Respond with ONLY a JSON object, no prose before or after, matching exactly this schema:
{
  "ruling": string,                 // one-sentence disposition
  "prevailingParty": "plaintiff" | "defendant" | "mixed" | "other",
  "confidence": number,             // 0..1
  "reasoning": string,              // the opinion: analysis of issues, application of law to facts
  "keyFactors": string[],           // the 3-7 facts/arguments that most drove the outcome
  "controllingAuthority": string[], // statutes, rules, cases relied on
  "dissentingConsiderations": string, // strongest case for the other side and why it did not prevail
  "remedy": string                  // damages, injunction, sentence, remand instructions, or "N/A"
}`;

function section(label: string, value?: string) {
  return value?.trim() ? `## ${label}\n${value.trim()}\n` : "";
}

export function buildCasePrompt(c: CaseInput): string {
  return [
    `# Case: ${c.title}`,
    section("Jurisdiction", c.jurisdiction),
    section("Court", c.court),
    section("Case type", c.caseType),
    section("Question presented", c.questionPresented),
    section("Facts", c.facts),
    section("Procedural history", c.proceduralHistory),
    section("Evidence", c.evidence),
    section("Plaintiff / prosecution / appellant arguments", c.plaintiffArguments),
    section("Defendant / respondent / appellee arguments", c.defendantArguments),
    section("Applicable law", c.applicableLaw),
    section("Precedents", c.precedents),
    section("Additional context", c.additionalContext),
    "Issue your ruling as the JSON object described.",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`No JSON object in model output: ${text.slice(0, 200)}`);
  return JSON.parse(candidate.slice(start, end + 1));
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export function parseRuling(text: string): Ruling {
  const raw = extractJson(text) as Record<string, unknown>;
  const party = String(raw.prevailingParty ?? "other").toLowerCase();
  const confidence = Number(raw.confidence);
  return {
    ruling: String(raw.ruling ?? ""),
    prevailingParty: (["plaintiff", "defendant", "mixed", "other"] as const).find((p) => p === party) ?? "other",
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    reasoning: String(raw.reasoning ?? ""),
    keyFactors: asStringArray(raw.keyFactors),
    controllingAuthority: asStringArray(raw.controllingAuthority),
    dissentingConsiderations: String(raw.dissentingConsiderations ?? ""),
    remedy: raw.remedy ? String(raw.remedy) : undefined,
  };
}

const MATCH_SYSTEM_PROMPT = `You compare a court's actual disposition with a predicted disposition. Answer with exactly one word: MATCH if they reach the same outcome for the same party (wording may differ), otherwise MISMATCH.`;

export async function judgeCase(c: CaseInput): Promise<JudgeResult> {
  const cfg = getLLMConfig();
  const started = Date.now();
  const text = await complete(cfg, JUDGE_SYSTEM_PROMPT, buildCasePrompt(c), { maxTokens: 3000 });
  const ruling = parseRuling(text);
  const latencyMs = Date.now() - started;

  let matchesActual: boolean | undefined;
  if (c.actualOutcome?.trim()) {
    const verdict = await complete(
      cfg,
      MATCH_SYSTEM_PROMPT,
      `Actual: ${c.actualOutcome}\nPredicted: ${ruling.ruling} (prevailing party: ${ruling.prevailingParty})`,
      { maxTokens: 5 },
    );
    matchesActual = /^\s*MATCH/i.test(verdict);
  }

  return {
    caseId: c.id ?? crypto.randomUUID(),
    title: c.title,
    ruling,
    model: `${cfg.provider}/${cfg.model}`,
    latencyMs,
    actualOutcome: c.actualOutcome,
    matchesActual,
  };
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onSettled: (index: number, outcome: { ok: true; value: R } | { ok: false; error: unknown }) => void,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      try {
        onSettled(i, { ok: true, value: await fn(items[i], i) });
      } catch (error) {
        onSettled(i, { ok: false, error });
      }
    }
  });
  await Promise.all(workers);
}
