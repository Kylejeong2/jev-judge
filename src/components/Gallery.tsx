"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { galleryDoc, type GalleryEntry } from "@/lib/gallery";
import { highlight, rankSearch } from "@/lib/search";
import type { Party } from "@/lib/types";
import { partyColor, RulingCard } from "./RulingCard";
import { Seal } from "./Bench";

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

  const docs = useMemo(() => entries.map(galleryDoc), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.case.id, e])), [entries]);

  const filtered = useMemo(
    () =>
      rankSearch(docs, query)
        .flatMap((h) => byId.get(h.id) ?? [])
        .filter((e) => {
          if (verdict === "match" && !e.result.matchesActual) return false;
          if (verdict === "differ" && e.result.matchesActual) return false;
          if (party !== "all" && e.result.ruling.prevailingParty !== party) return false;
          return true;
        }),
    [docs, byId, query, verdict, party],
  );

  const total = entries.length;
  const correct = entries.filter((e) => e.result.matchesActual).length;
  const selected = selectedId ? entries.find((e) => e.case.id === selectedId) : undefined;

  if (selected) return <Detail entry={selected} onBack={() => select(null)} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-5">
        <Seal size={72} />
        <div>
          <h1 className="font-serif text-3xl text-ink">The gallery of landmark cases</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">
            {total} famous cases, each judged by Jev from the case record alone (facts, arguments, law
            and precedents as they stood at the time), then compared with what the court actually
            decided. Jev agreed with the real outcome in{" "}
            <span className="font-medium text-ink">
              {correct}/{total} ({Math.round((correct / total) * 100)}%)
            </span>
            .
          </p>
        </div>
      </div>

      <div className="wood flex flex-wrap items-center gap-3 rounded-md p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cases: Miranda, negligence, 1973, Commerce Clause, free speech…  (⌘K anywhere)"
          className="min-w-64 flex-1 rounded-md border border-oak-900/40 px-3 py-2 text-sm text-ink shadow-inner focus:border-brass focus:outline-none"
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

      <p className="text-xs text-ink-soft">
        {filtered.length === total ? `${total} cases` : `${filtered.length} of ${total} cases`}
        {query.trim() && " · ranked by relevance"}
      </p>

      {filtered.length === 0 ? (
        <p className="paper rounded-md p-10 text-center text-sm text-ink-soft">No cases match “{query}”.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <li key={e.case.id}>
              <button
                type="button"
                onClick={() => select(e.case.id)}
                className="paper flex h-full w-full flex-col gap-2 rounded-md p-4 text-left transition hover:-translate-y-0.5 hover:border-brass"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-[15px] leading-snug text-ink">
                    <Highlighted text={e.case.title} query={query} />
                  </h2>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                      e.result.matchesActual
                        ? "bg-verdict-green/10 text-verdict-green"
                        : "bg-verdict-red/10 text-verdict-red"
                    }`}
                  >
                    {e.result.matchesActual ? "agrees" : "differs"}
                  </span>
                </div>
                <p className="text-xs text-ink-soft">
                  <Highlighted text={`${e.case.court} · ${e.case.year} · ${e.case.topic}`} query={query} />
                </p>
                <p className="line-clamp-3 text-sm text-ink">
                  <Highlighted text={e.case.tldr} query={query} />
                </p>
                <div className="mt-auto flex items-center justify-between pt-1 text-xs">
                  <span className="flex flex-wrap items-center gap-1">
                    Court:{" "}
                    <span className={`rounded-md px-1.5 py-0.5 font-medium ${partyColor[e.case.actualPrevailingParty ?? "other"]}`}>
                      {e.case.actualPrevailingParty ?? "other"}
                    </span>
                    {" · "}Jev:{" "}
                    <span className={`rounded-md px-1.5 py-0.5 font-medium ${partyColor[e.result.ruling.prevailingParty]}`}>
                      {e.result.ruling.prevailingParty}
                    </span>
                  </span>
                  <span className="tabular-nums text-ink-soft">{Math.round(e.result.ruling.confidence * 100)}%</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {highlight(text, query).map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="rounded-md bg-brass-light/60 text-inherit">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
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
    <div className="inline-flex overflow-hidden rounded-md border border-oak-900/40 bg-paper text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-2 ${v === value ? "brass font-medium" : "text-ink hover:bg-wall-dark"}`}
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
      <button type="button" onClick={onBack} className="text-sm text-ink-soft hover:text-ink">
        ← All cases
      </button>
      <div className="flex items-start gap-5">
        <Seal size={64} />
        <div>
        <h1 className="font-serif text-3xl text-ink">{c.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {c.court} · {c.year} · {c.topic}
          {c.jurisdiction && ` · ${c.jurisdiction}`}
        </p>
        </div>
      </div>

      <div className="paper rise-in rounded-md p-5">
        <p className="font-serif text-lg leading-relaxed text-ink">{c.tldr}</p>
      </div>

      <Verdicts entry={entry} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h2 className="mb-2 font-serif text-base text-ink">Jev&rsquo;s full opinion</h2>
          <RulingCard result={entry.result} />
        </div>
        <div>
          <h2 className="mb-2 font-serif text-base text-ink">The record before the court</h2>
          <div className="paper space-y-4 rounded-md p-5 text-sm">
            {RECORD_FIELDS.map(({ key, label }) => {
              const v = c[key];
              if (typeof v !== "string" || !v) return null;
              return (
                <div key={key}>
                  <h3 className="paper-rule pb-1 font-serif text-sm font-medium text-ink">{label}</h3>
                  <p className="mt-1 whitespace-pre-line text-ink">{v}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Verdicts({ entry }: { entry: GalleryEntry }) {
  const c = entry.case;
  const r = entry.result;
  const courtParty = c.actualPrevailingParty ?? "other";
  const jevParty = r.ruling.prevailingParty;
  const sameParty = courtParty === jevParty;
  const agree = r.matchesActual;
  return (
    <div className="paper rounded-md p-5">
      <p className={`font-serif text-lg ${agree ? "text-verdict-green" : "text-verdict-red"}`}>
        {agree ? "Jev agrees with the court" : "Jev disagrees with the court"}
        <span className="ml-2 text-sm font-normal tabular-nums text-ink-soft">
          Jev&rsquo;s confidence in its winner: {Math.round(r.ruling.confidence * 100)}%
        </span>
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-oak-900/15 p-4">
          <h3 className="font-serif text-sm font-medium text-ink">What the court ruled</h3>
          <p className="mt-2">
            <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${partyColor[courtParty]}`}>
              {courtParty}
            </span>
          </p>
          <p className="mt-2 text-sm text-ink">{c.actualOutcome}</p>
        </div>
        <div className="rounded-md border border-oak-900/15 p-4">
          <h3 className="font-serif text-sm font-medium text-ink">What Jev ruled</h3>
          <p className="mt-2">
            <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${partyColor[jevParty]}`}>
              {jevParty}
            </span>
          </p>
          <p className="mt-2 text-sm text-ink">{r.ruling.ruling}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        {sameParty
          ? `Both name the ${jevParty} as the prevailing party.`
          : `The court ruled for the ${courtParty}; Jev ruled for the ${jevParty}.`}
        {r.matchProbability !== undefined && ` Jev put the odds of matching the real outcome at ${Math.round(r.matchProbability * 100)}%.`}
      </p>
    </div>
  );
}
