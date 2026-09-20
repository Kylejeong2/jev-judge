import type { JudgeResult } from "@/lib/types";

const partyColor: Record<JudgeResult["ruling"]["prevailingParty"], string> = {
  plaintiff: "bg-blue-100 text-blue-800",
  defendant: "bg-amber-100 text-amber-800",
  mixed: "bg-purple-100 text-purple-800",
  other: "bg-zinc-100 text-zinc-800",
};

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

export function RulingCard({ result }: { result: JudgeResult }) {
  const r = result.ruling;
  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{r.ruling}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {result.model} · {(result.latencyMs / 1000).toFixed(1)}s
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
          <span className="font-medium">{result.matchesActual ? "Matches" : "Differs from"} actual outcome:</span>{" "}
          {result.actualOutcome}
        </div>
      )}

      <Section title="Reasoning">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.reasoning}</p>
      </Section>

      {r.keyFactors.length > 0 && (
        <Section title="Key factors">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.keyFactors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.controllingAuthority.length > 0 && (
        <Section title="Controlling authority">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {r.controllingAuthority.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.dissentingConsiderations && (
        <Section title="Strongest case for the other side">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.dissentingConsiderations}</p>
        </Section>
      )}

      {r.remedy && (
        <Section title="Remedy">
          <p className="text-sm">{r.remedy}</p>
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
