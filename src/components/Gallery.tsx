"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { matchesQuery, searchText, type GalleryEntry } from "@/lib/gallery";
import type { Party } from "@/lib/types";
import { RulingCard } from "./RulingCard";

const partyColor: Record<Party, string> = {
  plaintiff: "bg-blue-100 text-blue-800",
  defendant: "bg-amber-100 text-amber-800",
  mixed: "bg-purple-100 text-purple-800",
  other: "bg-zinc-100 text-zinc-800",
};

type Verdict = "all" | "match" | "differ";

const RECORD_FIELDS: { key: keyof GalleryEntry["case"]; label: string }[] = [
  { key: "questionPresented", label: "Question presented" },
  { key: "facts", label: "Facts" },
  { key: "proceduralHistory", label: "Procedural history" },
  { key: "evidence", label: "Evidence" },
  { key: "plaintiffArguments", label: "Plaintiff's arguments" },
  { key: "defendantArguments", label: "Defendant's arguments" },
  { key: "applicableLaw", label: "Applicable law" },
  { key: "precedents", label: "Precedents" },
  { key: "additionalContext", label: "Additional context" },
];

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => decodeURIComponent(window.location.hash.slice(1)) || null;

function useHashId(): [string | null, (id: string | null) => void] {
  const id = useSyncExternalStore(subscribeHash, readHash, () => null);
  const set = (next: string | null) => {
    window.location.hash = next ? encodeURIComponent(next) : "";
  };
  return [id, set];
}

export function Gallery({ entries }: { entries: GalleryEntry[] }) {
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("all");
  const [party, setParty] = useState<Party | "all">("all");
  const [selectedId, setSelectedId] = useHashId();

  const select = (id: string | null) => {
    setSelectedId(id);
    window.scrollTo({ top: 0 });
  };

  const indexed = useMemo(() => entries.map((e) => ({ e, text: searchText(e) })), [entries]);

  const filtered = useMemo(
    () =>
      indexed
        .filter(({ e, text }) => {
          if (verdict === "match" && !e.result.matchesActual) return false;
          if (verdict === "differ" && e.result.matchesActual) return false;
          if (party !== "all" && e.result.ruling.prevailingParty !== party) return false;
          return matchesQuery(text, query);
        })
        .map(({ e }) => e),
    [indexed, query, verdict, party],
  );

  const total = entries.length;
  const correct = entries.filter((e) => e.result.matchesActual).length;
  const selected = selectedId ? entries.find((e) => e.case.id === selectedId) : undefined;

  if (selected) return <Detail entry={selected} onBack={() => select(null)} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Landmark case gallery</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {total} famous cases, each judged by Jev from the case record alone (facts, arguments, law
          and precedents as they stood at the time), then compared with what the court actually
          decided. Jev agreed with the real outcome in{" "}
          <span className="font-medium text-zinc-900">
            {correct}/{total} ({Math.round((correct / total) * 100)}%)
          </span>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cases: Miranda, negligence, 1973, Commerce Clause, free speech…"
          className="min-w-64 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none"
          autoFocus
        />
        <Segmented
          value={verdict}
          onChange={setVerdict}
          options={[
            ["all", "All"],
            ["match", "Jev agreed"],
            ["differ", "Jev differed"],
          ]}
        />
        <Segmented
          value={party}
          onChange={setParty}
          options={[
            ["all", "Any winner"],
            ["plaintiff", "Plaintiff"],
            ["defendant", "Defendant"],
            ["mixed", "Mixed"],
          ]}
        />
      </div>

      <p className="text-xs text-zinc-500">
        {filtered.length === total ? `${total} cases` : `${filtered.length} of ${total} cases`}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No cases match “{query}”.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <li key={e.case.id}>
              <button
                type="button"
                onClick={() => select(e.case.id)}
                className="flex h-full w-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-400 hover:shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium leading-snug">{e.case.title}</h2>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      e.result.matchesActual ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {e.result.matchesActual ? "agrees" : "differs"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {e.case.court} · {e.case.year} · {e.case.topic}
                </p>
                <p className="line-clamp-3 text-sm text-zinc-700">{e.case.questionPresented}</p>
                <div className="mt-auto flex items-center justify-between pt-1 text-xs">
                  <span>
                    Jev:{" "}
                    <span className={`rounded px-1.5 py-0.5 font-medium ${partyColor[e.result.ruling.prevailingParty]}`}>
                      {e.result.ruling.prevailingParty}
                    </span>
                  </span>
                  <span className="font-mono text-zinc-600">{Math.round(e.result.ruling.confidence * 100)}%</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 bg-white text-xs shadow-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-2 ${v === value ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Detail({ entry, onBack }: { entry: GalleryEntry; onBack: () => void }) {
  const c = entry.case;
  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm text-zinc-600 hover:text-zinc-900">
        ← All cases
      </button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {c.court} · {c.year} · {c.topic}
          {c.jurisdiction && ` · ${c.jurisdiction}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Jev&apos;s ruling</h2>
          <RulingCard result={entry.result} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Case record given to Jev</h2>
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 text-sm shadow-sm">
            {RECORD_FIELDS.map(({ key, label }) => {
              const v = c[key];
              if (typeof v !== "string" || !v) return null;
              return (
                <div key={key}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</h3>
                  <p className="mt-1 whitespace-pre-line text-zinc-800">{v}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
