"use client";

import { useMemo, useRef, useState } from "react";
import { ConfidenceBar, RulingCard } from "@/components/RulingCard";
import type { BatchEvent, CaseInput, JudgeResult } from "@/lib/types";

type Row =
  | { status: "pending"; index: number; title: string }
  | { status: "done"; index: number; title: string; result: JudgeResult }
  | { status: "error"; index: number; title: string; error: string };

function parseCases(text: string): CaseInput[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed) as CaseInput[];
  return trimmed
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CaseInput);
}

function toCsv(rows: Row[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["index", "title", "status", "ruling", "prevailingParty", "confidence", "actualOutcome", "matchesActual", "keyFactors", "error"];
  const lines = rows.map((r) =>
    r.status === "done"
      ? [r.index, r.title, "done", r.result.ruling.ruling, r.result.ruling.prevailingParty, r.result.ruling.confidence, r.result.actualOutcome, r.result.matchesActual, r.result.ruling.keyFactors.join(" | "), ""]
      : [r.index, r.title, r.status, "", "", "", "", "", "", r.status === "error" ? r.error : ""],
  );
  return [header, ...lines].map((l) => l.map(esc).join(",")).join("\n");
}

export default function BatchPage() {
  const [raw, setRaw] = useState("");
  const [concurrency, setConcurrency] = useState(4);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parsed = useMemo(() => {
    try {
      return { cases: parseCases(raw), error: null };
    } catch (e) {
      return { cases: [], error: e instanceof Error ? e.message : String(e) };
    }
  }, [raw]);

  const stats = useMemo(() => {
    const done = rows.filter((r): r is Extract<Row, { status: "done" }> => r.status === "done");
    const failed = rows.filter((r) => r.status === "error").length;
    const scored = done.filter((r) => r.result.matchesActual !== undefined);
    const correct = scored.filter((r) => r.result.matchesActual).length;
    const avgConf = done.length ? done.reduce((s, r) => s + r.result.ruling.confidence, 0) / done.length : 0;
    const byParty = done.reduce<Record<string, number>>((acc, r) => {
      acc[r.result.ruling.prevailingParty] = (acc[r.result.ruling.prevailingParty] ?? 0) + 1;
      return acc;
    }, {});
    return { done: done.length, failed, scored: scored.length, correct, avgConf, byParty };
  }, [rows]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setRaw(await f.text());
  }

  async function run() {
    const cases = parsed.cases;
    if (!cases.length) return;
    setError(null);
    setSelected(null);
    setRows(cases.map((c, i) => ({ status: "pending", index: i, title: c.title })));
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cases, concurrency }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.json()).error ?? res.statusText);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as BatchEvent;
          if (ev.type === "result") {
            setRows((prev) => prev.map((r) => (r.index === ev.index ? { status: "done", index: ev.index, title: ev.result.title, result: ev.result } : r)));
          } else if (ev.type === "error") {
            setRows((prev) => prev.map((r) => (r.index === ev.index ? { status: "error", index: ev.index, title: ev.title, error: ev.error } : r)));
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedRow = rows.find((r) => r.index === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Batch rulings</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Paste or upload cases as JSONL (one JSON object per line) or a JSON array. Each object uses the same fields as
          the single-case form (<code className="font-mono text-xs">title</code> and{" "}
          <code className="font-mono text-xs">facts</code> required; include{" "}
          <code className="font-mono text-xs">actualOutcome</code> to score accuracy).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <textarea
          rows={8}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'{"id":"1","title":"Smith v. Jones","facts":"...","actualOutcome":"Judgment for defendant"}\n{"id":"2",...}'}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-xs focus:border-zinc-500 focus:outline-none"
        />
        <div className="flex flex-col gap-3">
          <label className="text-sm">
            <span className="block text-zinc-700">Upload file</span>
            <input type="file" accept=".json,.jsonl,.ndjson,.txt" onChange={onFile} className="mt-1 text-xs" />
          </label>
          <label className="text-sm">
            <span className="block text-zinc-700">Concurrency</span>
            <input
              type="number"
              min={1}
              max={32}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              className="mt-1 w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </label>
          <div className="text-xs text-zinc-500">
            {parsed.error ? <span className="text-red-600">Parse error: {parsed.error}</span> : `${parsed.cases.length} case(s) parsed`}
          </div>
          {running ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!parsed.cases.length || !!parsed.error}
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Run {parsed.cases.length || ""} case(s)
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      {rows.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            <Stat label="Completed" value={`${stats.done} / ${rows.length}`} />
            <Stat label="Failed" value={String(stats.failed)} />
            <Stat
              label="Accuracy vs actual"
              value={stats.scored ? `${Math.round((stats.correct / stats.scored) * 100)}% (${stats.correct}/${stats.scored})` : "—"}
            />
            <Stat label="Avg confidence" value={stats.done ? `${Math.round(stats.avgConf * 100)}%` : "—"} />
            <Stat
              label="Prevailing party"
              value={Object.entries(stats.byParty).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => download("jev-results.csv", toCsv(rows), "text/csv")}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100"
            >
              Download CSV
            </button>
            <button
              onClick={() =>
                download(
                  "jev-results.jsonl",
                  rows.filter((r) => r.status === "done").map((r) => JSON.stringify((r as Extract<Row, { status: "done" }>).result)).join("\n"),
                  "application/x-ndjson",
                )
              }
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100"
            >
              Download JSONL
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">Ruling</th>
                    <th className="px-3 py-2">Conf.</th>
                    <th className="px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.index}
                      onClick={() => r.status === "done" && setSelected(r.index)}
                      className={`border-t border-zinc-100 ${r.status === "done" ? "cursor-pointer hover:bg-zinc-50" : ""} ${selected === r.index ? "bg-zinc-100" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.index + 1}</td>
                      <td className="px-3 py-2">{r.title}</td>
                      <td className="px-3 py-2">
                        {r.status === "pending" && <span className="text-zinc-400">…</span>}
                        {r.status === "error" && <span className="text-red-600">{r.error}</span>}
                        {r.status === "done" && r.result.ruling.ruling}
                      </td>
                      <td className="px-3 py-2">{r.status === "done" && <ConfidenceBar value={r.result.ruling.confidence} />}</td>
                      <td className="px-3 py-2">
                        {r.status === "done" && r.result.matchesActual !== undefined && (
                          <span className={r.result.matchesActual ? "text-green-700" : "text-red-700"}>
                            {r.result.matchesActual ? "yes" : "no"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lg:sticky lg:top-8 lg:self-start">
              {selectedRow?.status === "done" ? (
                <RulingCard result={selectedRow.result} />
              ) : (
                <p className="text-sm text-zinc-500">Click a completed row to read Jev&apos;s full opinion.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
