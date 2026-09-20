import type { ChoiceResult, JudgeResult, ScoreResult } from "@/lib/types";

const partyColor: Record<JudgeResult["ruling"]["prevailingParty"], string> = {
  plaintiff: "bg-blue-100 text-blue-800",
  defendant: "bg-amber-100 text-amber-800",
  mixed: "bg-purple-100 text-purple-800",
  other: "bg-zinc-100 text-zinc-800",
};

const humanize = (s: string) => s.replace(/_/g, " ");

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded bg-zinc-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-sm">{pct}%</span>
    </div>
  );
}

function Distribution({ probabilities, highlight }: { probabilities: Record<string, number>; highlight?: string }) {
  const entries = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-1">
      {entries.map(([k, p]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className={`w-56 truncate ${k === highlight ? "font-semibold" : "text-zinc-600"}`} title={k}>
            {humanize(k)}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-100">
            <div className={`h-full ${k === highlight ? "bg-zinc-800" : "bg-zinc-400"}`} style={{ width: `${Math.round(p * 100)}%` }} />
          </div>
          <span className="w-10 text-right font-mono">{Math.round(p * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function ChoiceBlock({ title, a }: { title: string; a: ChoiceResult }) {
  return (
    <Section title={`${title} · confidence ${Math.round(a.confidence * 100)}%`}>
      <Distribution probabilities={a.probabilities} highlight={a.choice} />
    </Section>
  );
}

function ScoreRow({ id, s }: { id: string; s: ScoreResult }) {
  const level = s.legend[Math.min(s.max, Math.max(0, Math.round(s.score)))];
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{humanize(id)}</span>
        <span className="font-mono text-xs">
          {s.score.toFixed(2)} / {s.max} · conf {Math.round(s.confidence * 100)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-100">
        <div className="h-full bg-indigo-500" style={{ width: `${(s.score / s.max) * 100}%` }} />
      </div>
      <p className="mt-0.5 text-xs text-zinc-600">{level}</p>
    </div>
  );
}

export function RulingCard({ result }: { result: JudgeResult }) {
  const r = result.ruling;
  const findings = Object.entries(r.findings).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{r.ruling}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {result.model} · {(result.latencyMs / 1000).toFixed(1)}s · {result.inputTokens} input tokens
            {r.needsReview && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">needs review</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${partyColor[r.prevailingParty]}`}>
            {r.prevailingParty}
          </span>
          <ConfidenceBar value={r.confidence} />
        </div>
      </div>

      {result.actualOutcome && (
        <div
          className={`rounded border p-3 text-sm ${
            result.matchesActual
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <span className="font-medium">
            {result.matchesActual ? "Matches" : "Differs from"} actual outcome
            {result.matchProbability !== undefined && ` (p=${result.matchProbability.toFixed(2)})`}:
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
              <span className="w-56 truncate text-zinc-700" title={id}>{humanize(id)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-100">
                <div
                  className={`h-full ${p >= 0.5 ? "bg-emerald-500" : "bg-rose-400"}`}
                  style={{ width: `${Math.round(p * 100)}%` }}
                />
              </div>
              <span className="w-10 text-right font-mono">{Math.round(p * 100)}%</span>
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
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}
