import type { ChoiceResult, JudgeResult, ScoreResult } from "@/lib/types";
import { label } from "@/lib/labels";

export const partyColor: Record<JudgeResult["ruling"]["prevailingParty"], string> = {
  plaintiff: "bg-blue-900/10 text-blue-900",
  defendant: "bg-oak-700/15 text-oak-800",
  mixed: "bg-purple-900/10 text-purple-900",
  other: "bg-ink/10 text-ink",
};

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-verdict-green" : pct >= 50 ? "bg-brass" : "bg-verdict-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-md bg-wall-dark">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-sm">{pct}%</span>
    </div>
  );
}

function Distribution({ probabilities, highlight }: { probabilities: Record<string, number>; highlight?: string }) {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-1">
      {entries.map(([k, p]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className={`w-40 shrink-0 truncate sm:w-64 sm:whitespace-normal sm:overflow-visible ${k === highlight ? "font-semibold text-ink" : "text-ink-soft"}`} title={k}>
            {label(k)}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-md bg-wall-dark">
            <div className={`h-full ${k === highlight ? "bg-oak-700" : "bg-oak-400"}`} style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <span className="w-10 text-right tabular-nums">{Math.round(p * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function ChoiceBlock({ title, a }: { title: string; a: ChoiceResult }) {
  return (
    <Section title={`${title} · Jev's confidence ${Math.round(a.confidence * 100)}%`}>
      <Distribution probabilities={a.probabilities} highlight={a.choice} />
    </Section>
  );
}

function ScoreRow({ id, s }: { id: string; s: ScoreResult }) {
  const level = s.legend[Math.min(s.max, Math.max(0, Math.round(s.score)))];
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label(id)}</span>
        <span className="tabular-nums text-xs">
          {s.score.toFixed(2)} / {s.max} · Jev&rsquo;s confidence {Math.round(s.confidence * 100)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-md bg-wall-dark">
        <div className="h-full bg-brass" style={{ width: `${(s.score / s.max) * 100}%` }} />
      </div>
      <p className="mt-0.5 text-xs text-ink-soft">{level}</p>
    </div>
  );
}

export function RulingCard({ result }: { result: JudgeResult }) {
  const r = result.ruling;
  const findings = Object.entries(r.findings).sort((a, b) => b[1] - a[1]);
  return (
    <div className="paper space-y-5 rounded-md p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-ink">{r.ruling}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            {result.model} · {(result.latencyMs / 1000).toFixed(1)}s · {result.inputTokens} input tokens
            {r.needsReview && <span className="ml-2 rounded-md bg-verdict-red/10 px-1.5 py-0.5 font-medium text-verdict-red">needs review</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${partyColor[r.prevailingParty]}`}>
            {label(r.prevailingParty)}
          </span>
          <ConfidenceBar value={r.confidence} />
        </div>
      </div>

      {result.actualOutcome && (
        <div
          className={`rounded-md border p-3 text-sm ${
            result.matchesActual
              ? "border-verdict-green/30 bg-verdict-green/10 text-verdict-green"
              : "border-verdict-red/30 bg-verdict-red/10 text-verdict-red"
          }`}
        >
          <span className="font-medium">
            {result.matchesActual ? "Matches" : "Differs from"} the actual outcome
            {result.matchProbability !== undefined && ` · odds of matching ${Math.round(result.matchProbability * 100)}%`}:
          </span>{" "}
          {result.actualOutcome}
        </div>
      )}

      <ChoiceBlock title="Prevailing party" a={r.prevailingPartyAnswer} />
      <ChoiceBlock title="Appellate disposition" a={r.appellateDisposition} />
      <ChoiceBlock title="Remedy" a={r.remedy} />

      <Section title="Findings (probability each proposition is true)">
        <div className="space-y-1">
          {findings.map(([id, p]) => (
            <div key={id} className="flex items-center gap-2 text-xs">
              <span className="w-40 shrink-0 truncate text-ink-soft sm:w-64 sm:whitespace-normal sm:overflow-visible" title={id}>{label(id)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-md bg-wall-dark">
                <div
                  className={`h-full ${p >= 0.5 ? "bg-verdict-green" : "bg-verdict-red/70"}`}
                  style={{ width: `${Math.round(p * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right tabular-nums">{Math.round(p * 100)}%</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Scores">
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(r.scores).map(([id, s]) => (
            <ScoreRow key={id} id={id} s={s} />
          ))}
        </div>
      </Section>

      {r.keyFactors.length > 0 && (
        <Section title="Key signals">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.keyFactors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="paper-rule mb-2 pb-1 font-serif text-sm font-medium text-ink">{title}</h3>
      {children}
    </div>
  );
}
