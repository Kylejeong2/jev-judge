"use client";

import { useState } from "react";
import { RulingCard } from "@/components/RulingCard";
import type { CaseInput, JudgeResult } from "@/lib/types";

type Field = {
  key: keyof CaseInput;
  label: string;
  rows?: number;
  required?: boolean;
  placeholder?: string;
};

const FIELDS: Field[] = [
  { key: "title", label: "Case title", required: true, placeholder: "Smith v. Jones" },
  { key: "jurisdiction", label: "Jurisdiction", placeholder: "California" },
  { key: "court", label: "Court", placeholder: "Superior Court of Los Angeles County" },
  { key: "caseType", label: "Case type", placeholder: "Civil — breach of contract" },
  { key: "questionPresented", label: "Question presented", rows: 2 },
  { key: "facts", label: "Facts", rows: 8, required: true },
  { key: "proceduralHistory", label: "Procedural history", rows: 3 },
  { key: "evidence", label: "Evidence", rows: 5 },
  { key: "plaintiffArguments", label: "Plaintiff / prosecution arguments", rows: 4 },
  { key: "defendantArguments", label: "Defendant / respondent arguments", rows: 4 },
  { key: "applicableLaw", label: "Applicable law", rows: 4 },
  { key: "precedents", label: "Precedents", rows: 4 },
  { key: "additionalContext", label: "Additional context", rows: 3 },
  { key: "actualOutcome", label: "Actual outcome (optional, for scoring)", rows: 2 },
];

const EMPTY: CaseInput = { title: "", facts: "" };

export default function SingleCasePage() {
  const [form, setForm] = useState<CaseInput>(EMPTY);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setResult(data as JudgeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Case record</h1>
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-800"
            onClick={() => setForm(EMPTY)}
          >
            Clear
          </button>
        </div>
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </span>
            {f.rows ? (
              <textarea
                rows={f.rows}
                required={f.required}
                placeholder={f.placeholder}
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            ) : (
              <input
                type="text"
                required={f.required}
                placeholder={f.placeholder}
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            )}
          </label>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Jev is deliberating…" : "Ask Jev to rule"}
        </button>
      </form>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <h1 className="mb-4 text-xl font-semibold">Ruling</h1>
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}
        {result && <RulingCard result={result} />}
        {!result && !error && (
          <p className="text-sm text-zinc-500">
            Fill in the record and submit. Jev returns a disposition, a calibrated confidence, the opinion, and
            the authorities relied upon.
          </p>
        )}
      </div>
    </div>
  );
}
