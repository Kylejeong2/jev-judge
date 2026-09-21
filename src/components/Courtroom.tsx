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

/** Text fields that count toward record completeness (excludes id, actualPrevailingParty, actualOutcome). */
const COMPLETENESS_KEYS: (keyof CaseInput)[] = [
  "title", "jurisdiction", "court", "caseType", "questionPresented", "facts",
  "proceduralHistory", "evidence", "plaintiffArguments", "defendantArguments",
  "applicableLaw", "precedents", "additionalContext",
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

function friendlyError(msg: string): string {
  if (/429|rate|busy|529|overloaded/i.test(msg))
    return "Jev is busy right now — try again in a few seconds.";
  if (/TYPESAFE_API_KEY|api key|401|403/i.test(msg))
    return "This deployment has no TypeSafe API key configured.";
  if (/timeout|timed out|504|fetch failed|network/i.test(msg))
    return "The request to Jev timed out or the network dropped.";
  return "Jev could not rule on this record.";
}

export function Courtroom({ samples }: { samples: CaseInput[] }) {
  const [form, setForm] = useState<CaseInput>(EMPTY);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [recordOpen, setRecordOpen] = useState(true);

  const busy = phase === "deliberating";
  const isEmpty = !form.title && !form.facts;
  const completeness = COMPLETENESS_KEYS.filter(
    (k) => typeof form[k] === "string" && (form[k] as string).trim().length > 0,
  ).length;

  useEffect(() => {
    if (!busy) return;
    const script = DELIBERATION(form.title);
    const t = setInterval(() => setLines((n) => Math.min(n + 1, script.length)), 650);
    const e = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearInterval(t);
      clearInterval(e);
    };
  }, [busy, form.title]);

  const set = (key: keyof CaseInput, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const scrollToRecord = () =>
    requestAnimationFrame(() =>
      document.getElementById("record")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

  function loadSample(s: CaseInput) {
    setForm(s);
    setPhase("idle");
    setResult(null);
    setError(null);
    setRecordOpen(true);
    scrollToRecord();
  }

  function clearRecord() {
    setForm(EMPTY);
    setPhase("idle");
    setResult(null);
    setError(null);
    setRecordOpen(true);
  }

  async function run() {
    setPhase("deliberating");
    setLines(1);
    setElapsed(0);
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
      const minShow = 1200 - (Date.now() - started);
      if (minShow > 0) await new Promise((r) => setTimeout(r, minShow));
      setResult(data as JudgeResult);
      setPhase("ruled");
      setRecordOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void run();
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
  const scriptDone = lines >= script.length;

  const askButton = (
    <button
      type="submit"
      disabled={busy}
      className="brass rounded-md px-8 py-3 font-serif text-base disabled:opacity-60"
    >
      {busy ? "Deliberating…" : "Ask the court to rule"}
    </button>
  );

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
        <div className="space-y-6">
          {phase === "idle" && isEmpty && (
            <div className="paper rise-in mx-auto max-w-3xl rounded-md p-5">
              <h2 className="font-serif text-base text-ink">Start with a landmark case</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Load a real case record to see Jev rule, or write your own below.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {samples.map((s) => (
                  <button
                    key={s.id ?? s.title}
                    type="button"
                    onClick={() => loadSample(s)}
                    className="rounded-md border border-oak-300 px-3 py-1.5 text-sm text-ink hover:border-brass"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(busy || phase === "ruled" || phase === "error") && (
            <>
              <Transcript
                lines={busy ? script.slice(0, lines) : script}
                done={!busy}
                stalled={busy && scriptDone}
                elapsed={elapsed}
              />
              {phase === "ruled" && result && <BenchRuling result={result} />}
              {phase === "error" && error && (
                <div className="paper rise-in mx-auto max-w-3xl rounded-md border-verdict-red/30 bg-verdict-red/10 p-5 text-sm text-verdict-red">
                  <p>
                    <span className="font-serif font-semibold">{friendlyError(error)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void run()}
                    className="brass mt-3 rounded-md px-4 py-1.5 text-sm"
                  >
                    Try again
                  </button>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs">Technical details</summary>
                    <pre className="mt-1 whitespace-pre-wrap text-xs">{error}</pre>
                  </details>
                </div>
              )}
              {phase === "ruled" && result && (
                <div className="rise-in mx-auto max-w-4xl">
                  <RulingCard result={result} />
                </div>
              )}
            </>
          )}
        </div>
      </Bench>

      {phase === "ruled" && !recordOpen ? (
        <div className="paper mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-md p-5">
          <p className="text-sm text-ink">
            {form.title || "Untitled case"} · {completeness} of {COMPLETENESS_KEYS.length} fields on
            the record
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setRecordOpen(true);
                scrollToRecord();
              }}
              className="rounded-md border border-oak-300 px-3 py-1.5 text-sm text-ink hover:border-brass"
            >
              Amend the record and re-rule
            </button>
            <button
              type="button"
              onClick={clearRecord}
              className="rounded-md border border-oak-300 px-3 py-1.5 text-sm text-ink hover:border-brass"
            >
              Start a new case
            </button>
          </div>
        </div>
      ) : (
        <form id="record" onSubmit={submit} className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl text-ink">Counsel tables</h1>
              <p className="text-sm text-ink-soft">
                Everything the court will consider goes on the record. Jev sees nothing else.
              </p>
            </div>
            {!isEmpty && (
              <button
                type="button"
                className="text-xs text-ink-soft underline-offset-2 hover:underline"
                onClick={clearRecord}
              >
                Clear the record
              </button>
            )}
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

            <div className="order-first lg:order-none">
              <Paper title="The record">
                <div className="space-y-3">
                  {RECORD_FIELDS.map((f) => (
                    <Input key={f.key} f={f} value={(form[f.key] as string) ?? ""} onChange={(v) => set(f.key, v)} />
                  ))}
                </div>
              </Paper>
            </div>

            <Table side="Defendant's table">
              <Input
                f={{ key: "defendantArguments", label: "Arguments for the party opposing relief", rows: 14 }}
                value={form.defendantArguments ?? ""}
                onChange={(v) => set("defendantArguments", v)}
              />
            </Table>
          </div>

          {form.facts.trim() || phase !== "idle" ? (
            <div className="wood sticky bottom-0 z-30 flex items-center justify-between gap-3 rounded-md px-4 py-3 shadow-lg">
              <span className="text-sm text-oak-300">
                {completeness} of {COMPLETENESS_KEYS.length} fields on the record
              </span>
              {askButton}
            </div>
          ) : (
            <div className="flex justify-center">{askButton}</div>
          )}
        </form>
      )}
    </div>
  );
}

function Transcript({
  lines,
  done,
  stalled,
  elapsed,
}: {
  lines: string[];
  done: boolean;
  stalled: boolean;
  elapsed: number;
}) {
  const body = (
    <>
      {lines.map((l, i) => (
        <p key={i} className="rise-in">
          <span className="mr-2 select-none tabular-nums text-oak-500">{String(i + 1).padStart(2, "0")}</span>
          {l}
        </p>
      ))}
      {stalled && <p className="text-ink-soft">Still deliberating — {elapsed}s elapsed.</p>}
      {!done && (
        <p>
          <span className="mr-2 select-none tabular-nums text-oak-500">{String(lines.length + 1).padStart(2, "0")}</span>
          <span aria-hidden="true" className="blink">▌</span>
        </p>
      )}
    </>
  );
  if (done) {
    return (
      <details className="paper mx-auto max-w-3xl rounded-md p-4 text-[13px] leading-relaxed text-ink-soft">
        <summary className="cursor-pointer font-serif text-sm text-ink">
          Transcript ({lines.length} lines)
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    );
  }
  return (
    <div className="paper mx-auto max-w-3xl rounded-md p-5 text-[13px] leading-relaxed text-ink-soft">
      <h3 className="paper-rule mb-3 pb-2 font-serif text-sm font-medium text-ink">Transcript</h3>
      {body}
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
            Judgment for the <span className="font-semibold text-ink">{r.prevailingParty}</span> ·
            Jev&rsquo;s confidence{" "}
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
