"use client";

import { useEffect, useState } from "react";
import { Bench } from "./Bench";
import { RulingCard } from "./RulingCard";
import type { CaseInput, JudgeResult } from "@/lib/types";

type Field = {
  key: keyof CaseInput;
  label: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
};

const CAPTION_FIELDS: Field[] = [
  { key: "title", label: "Case title", required: true, placeholder: "Smith v. Jones" },
  { key: "jurisdiction", label: "Jurisdiction", placeholder: "California" },
  { key: "court", label: "Court", placeholder: "Superior Court of Los Angeles County" },
  { key: "caseType", label: "Case type", placeholder: "Civil — breach of contract" },
];

const RECORD_FIELDS: Field[] = [
  { key: "questionPresented", label: "Question presented", rows: 2 },
  { key: "facts", label: "Facts", rows: 8, required: true },
  { key: "proceduralHistory", label: "Procedural history", rows: 3 },
  { key: "evidence", label: "Evidence", rows: 4 },
  { key: "applicableLaw", label: "Applicable law", rows: 3 },
  { key: "precedents", label: "Precedents", rows: 3 },
  { key: "additionalContext", label: "Additional context", rows: 2 },
  { key: "actualOutcome", label: "Actual outcome (optional, for scoring)", rows: 2 },
];

const EMPTY: CaseInput = { title: "", facts: "" };

type Phase = "idle" | "deliberating" | "ruled" | "error";

/** Transcript lines shown while the single Jev request is in flight. */
const DELIBERATION = (title: string) => [
  `Clerk: Calling ${title || "the matter"}. All rise.`,
  "Jev takes the bench and receives the case record as one structured state.",
  "Reading `case.facts`, `case.evidence` and `case.procedural_history`…",
  "Weighing `case.arguments.plaintiff` against `case.arguments.defendant`…",
  "Consulting `case.law.applicable` and `case.law.precedents`…",
  "Answering 18 questions in parallel: 3 Choice · 10 Noul · 5 Score.",
  "Composing the disposition from the typed answers…",
];

export function Courtroom({ samples }: { samples: CaseInput[] }) {
  const [form, setForm] = useState<CaseInput>(EMPTY);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState(0);

  const busy = phase === "deliberating";

  useEffect(() => {
    if (!busy) return;
    const script = DELIBERATION(form.title);
    const t = setInterval(() => setLines((n) => Math.min(n + 1, script.length)), 650);
    return () => clearInterval(t);
  }, [busy, form.title]);

  const set = (key: keyof CaseInput, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("deliberating");
    setLines(1);
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      // let the transcript play for a beat so the ruling feels read from the bench
      const minShow = 2200 - (Date.now() - started);
      if (minShow > 0) await new Promise((r) => setTimeout(r, minShow));
      setResult(data as JudgeResult);
      setPhase("ruled");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  const status =
    phase === "deliberating"
      ? "Jev is deliberating"
      : phase === "ruled"
        ? "Ruling entered"
        : phase === "error"
          ? "Recess — request failed"
          : "Court is in session";

  const script = DELIBERATION(form.title);

  return (
    <div className="space-y-10">
      <Bench
        status={status}
        busy={busy}
        caption={
          phase === "idle"
            ? "Present the record at the counsel tables below, then ask the court to rule."
            : undefined
        }
      >
        {(busy || phase === "ruled" || phase === "error") && (
          <div className="space-y-6">
            <Transcript lines={busy ? script.slice(0, lines) : script} done={!busy} />
            {phase === "ruled" && result && <BenchRuling result={result} />}
            {phase === "error" && error && (
              <div className="paper rise-in mx-auto max-w-3xl rounded-md border-verdict-red/30 bg-verdict-red/10 p-5 text-sm text-verdict-red">
                <span className="font-serif font-semibold">The court could not reach Jev:</span> {error}
              </div>
            )}
            {phase === "ruled" && result && (
              <div className="mx-auto max-w-4xl rise-in">
                <RulingCard result={result} />
              </div>
            )}
          </div>
        )}
      </Bench>

      <form onSubmit={submit} className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl text-ink">Counsel tables</h1>
            <p className="text-sm text-ink-soft">
              Everything the court will consider goes on the record. Jev sees nothing else.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-ink-soft">
              Load a landmark record{" "}
              <select
                className="rounded-md border border-oak-300 px-2 py-1 text-xs text-ink"
                defaultValue=""
                onChange={(e) => {
                  const s = samples.find((x) => x.id === e.target.value);
                  if (s) {
                    setForm(s);
                    setPhase("idle");
                    setResult(null);
                  }
                }}
              >
                <option value="">— choose —</option>
                {samples.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-ink-soft underline-offset-2 hover:underline"
              onClick={() => {
                setForm(EMPTY);
                setPhase("idle");
                setResult(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* caption sheet */}
        <Paper title="Caption">
          <div className="grid gap-3 sm:grid-cols-2">
            {CAPTION_FIELDS.map((f) => (
              <Input key={f.key} f={f} value={(form[f.key] as string) ?? ""} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
        </Paper>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr_1fr]">
          <Table side="Plaintiff's table">
            <Input
              f={{ key: "plaintiffArguments", label: "Arguments for the party seeking relief", rows: 14 }}
              value={form.plaintiffArguments ?? ""}
              onChange={(v) => set("plaintiffArguments", v)}
            />
          </Table>

          <Paper title="The record">
            <div className="space-y-3">
              {RECORD_FIELDS.map((f) => (
                <Input key={f.key} f={f} value={(form[f.key] as string) ?? ""} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          </Paper>

          <Table side="Defendant's table">
            <Input
              f={{ key: "defendantArguments", label: "Arguments for the party opposing relief", rows: 14 }}
              value={form.defendantArguments ?? ""}
              onChange={(v) => set("defendantArguments", v)}
            />
          </Table>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={busy}
            className="brass rounded-md px-8 py-3 font-serif text-base disabled:opacity-60"
          >
            {busy ? "Deliberating…" : "Ask the court to rule"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Transcript({ lines, done }: { lines: string[]; done: boolean }) {
  return (
    <div className="paper mx-auto max-w-3xl rounded-md p-5 text-[13px] leading-relaxed text-ink-soft">
      <h3 className="paper-rule mb-3 pb-2 font-serif text-sm font-medium text-ink">Transcript</h3>
      {lines.map((l, i) => (
        <p key={i} className="rise-in">
          <span className="mr-2 select-none tabular-nums text-oak-500">{String(i + 1).padStart(2, "0")}</span>
          {l}
        </p>
      ))}
      {!done && (
        <p>
          <span className="mr-2 select-none tabular-nums text-oak-500">{String(lines.length + 1).padStart(2, "0")}</span>
          <span className="blink">▌</span>
        </p>
      )}
    </div>
  );
}

function BenchRuling({ result }: { result: JudgeResult }) {
  const r = result.ruling;
  return (
    <div className="gavel-in mx-auto max-w-3xl">
      <div className="wood rounded-md p-1">
        <div className="paper rounded-md p-6 text-center">
          <h2 className="font-serif text-sm font-medium text-ink-soft">The court rules</h2>
          <p className="mt-3 font-serif text-2xl leading-snug text-ink">{r.ruling}</p>
          <p className="mt-3 text-sm text-ink-soft">
            Judgment for the <span className="font-semibold text-ink">{r.prevailingParty}</span> · confidence{" "}
            <span className="tabular-nums">{Math.round(r.confidence * 100)}%</span>
            {r.needsReview && <span className="ml-2 text-verdict-red">· flagged for review</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function Paper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="paper rounded-md p-5">
      <h3 className="paper-rule mb-4 pb-2 font-serif text-sm font-medium text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Table({ side, children }: { side: string; children: React.ReactNode }) {
  return (
    <div className="wood rounded-md p-3">
      <h3 className="mb-2 text-center font-serif text-sm font-medium text-brass-light">{side}</h3>
      <div className="paper rounded-md p-3">{children}</div>
    </div>
  );
}

function Input({ f, value, onChange }: { f: Field; value: string; onChange: (v: string) => void }) {
  const cls =
    "w-full rounded-md border border-oak-300/70 px-3 py-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-oak-600 focus:outline-none";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">
        {f.label}
        {f.required && <span className="text-verdict-red"> *</span>}
      </span>
      {f.rows ? (
        <textarea
          rows={f.rows}
          required={f.required}
          placeholder={f.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : (
        <input
          type="text"
          required={f.required}
          placeholder={f.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </label>
  );
}
