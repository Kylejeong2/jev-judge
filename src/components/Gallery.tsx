"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { galleryDoc, type GalleryEntry } from "@/lib/gallery";
import { highlight, rankSearch } from "@/lib/search";
import { label } from "@/lib/labels";
import { whyTheyDiffer } from "@/lib/explain";
import type { Party } from "@/lib/types";
import { RulingCard } from "./RulingCard";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useHashId();
  const lastOpenedId = useRef<string | null>(null);

  const query = searchParams.get("q") ?? "";
  const verdict = (searchParams.get("verdict") ?? "all") as Verdict;
  const party = (searchParams.get("party") ?? "all") as Party | "all";

  function updateParams(next: { q?: string; verdict?: string; party?: string }) {
    const params = new URLSearchParams();
    const q = next.q ?? query;
    const v = next.verdict ?? verdict;
    const p = next.party ?? party;
    if (q) params.set("q", q);
    if (v !== "all") params.set("verdict", v);
    if (p !== "all") params.set("party", p);
    const qs = params.toString();
    const hash = window.location.hash;
    router.replace(`${pathname}${qs ? `?${qs}` : ""}${hash}`, { scroll: false });
  }

  const select = (id: string | null) => {
    if (id) {
      lastOpenedId.current = id;
      setSelectedId(id);
      window.scrollTo({ top: 0 });
    } else {
      setSelectedId(null);
      const last = lastOpenedId.current;
      if (last) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            document.getElementById(`case-${last}`)?.scrollIntoView({ block: "center" }),
          ),
        );
      }
    }
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

  // counts filtered only by the query, for the segment labels
  const byQuery = useMemo(
    () => rankSearch(docs, query).flatMap((h) => byId.get(h.id) ?? []),
    [docs, byId, query],
  );
  const countMatch = byQuery.filter((e) => e.result.matchesActual).length;
  const countDiffer = byQuery.length - countMatch;
  const partyCount = (p: Party) =>
    byQuery.filter((e) => e.result.ruling.prevailingParty === p).length;

  const notable = useMemo(
    () =>
      !query && verdict === "all" && party === "all"
        ? entries
            .filter((e) => !e.result.matchesActual)
            .sort((a, b) => b.result.ruling.confidence - a.result.ruling.confidence)
            .slice(0, 4)
        : [],
    [entries, query, verdict, party],
  );

  const closest = useMemo(() => {
    const first = query.split(/\s+/)[0];
    return first ? rankSearch(docs, first, 3).flatMap((h) => byId.get(h.id) ?? []) : [];
  }, [docs, byId, query]);

  const total = entries.length;
  const correct = entries.filter((e) => e.result.matchesActual).length;
  const selected = selectedId ? entries.find((e) => e.case.id === selectedId) : undefined;
  const selectedIndex = selected ? filtered.findIndex((e) => e.case.id === selected.case.id) : -1;

  if (selected) {
    return (
      <Detail
        entry={selected}
        onBack={() => select(null)}
        prev={selectedIndex > 0 ? filtered[selectedIndex - 1] : undefined}
        next={
          selectedIndex >= 0 && selectedIndex < filtered.length - 1
            ? filtered[selectedIndex + 1]
            : undefined
        }
        index={selectedIndex}
        count={filtered.length}
        onSelect={select}
      />
    );
  }

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
          onChange={(e) => updateParams({ q: e.target.value })}
          placeholder={`Search ${total} cases…`}
          className="min-w-64 flex-1 rounded-md border border-oak-900/40 px-3 py-2 text-sm text-ink shadow-inner focus:border-brass focus:outline-none"
        />
        <Segmented
          value={verdict}
          onChange={(v) => updateParams({ verdict: v })}
          ariaLabel="Filter by verdict"
          options={[
            ["all", "All", byQuery.length],
            ["match", "Jev agreed", countMatch],
            ["differ", "Jev differed", countDiffer],
          ]}
        />
        <Segmented
          value={party}
          onChange={(p) => updateParams({ party: p })}
          ariaLabel="Filter by prevailing party"
          options={[
            ["all", "Any winner", byQuery.length],
            ["plaintiff", "Plaintiff", partyCount("plaintiff")],
            ["defendant", "Defendant", partyCount("defendant")],
            ["mixed", "Mixed", partyCount("mixed")],
          ]}
        />
      </div>

      <p className="text-xs text-ink-soft">
        {filtered.length === total ? `${total} cases` : `${filtered.length} of ${total} cases`}
        {" · try a party, year or topic — typos are fine · ⌘K anywhere"}
      </p>

      {notable.length > 0 && (
        <div className="paper rounded-md p-4">
          <h2 className="font-serif text-sm font-medium text-ink">Notable disagreements</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {notable.map((e) => (
              <button
                key={e.case.id}
                type="button"
                onClick={() => select(e.case.id)}
                className="rounded-md border border-oak-300 px-3 py-1.5 text-sm text-ink hover:border-brass"
              >
                {e.case.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="paper rounded-md p-10 text-center">
          <p className="text-sm text-ink">No cases match “{query}”.</p>
          <p className="mt-1 text-sm text-ink-soft">Try a party, year or topic.</p>
          <button
            type="button"
            onClick={() => updateParams({ q: "" })}
            className="brass mt-4 rounded-md px-4 py-1.5 text-sm"
          >
            Clear search
          </button>
          {closest.length > 0 && (
            <div className="mt-5">
              <h3 className="font-serif text-sm font-medium text-ink">Closest matches</h3>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {closest.map((e) => (
                  <button
                    key={e.case.id}
                    type="button"
                    onClick={() => select(e.case.id)}
                    className="rounded-md border border-oak-300 px-3 py-1.5 text-sm text-ink hover:border-brass"
                  >
                    {e.case.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <li key={e.case.id} id={`case-${e.case.id}`}>
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
                    {e.result.matchesActual
                      ? `agrees · ${label(e.result.ruling.prevailingParty)}`
                      : `differs · court ${label(e.case.actualPrevailingParty ?? "other")}, Jev ${label(e.result.ruling.prevailingParty)}`}
                  </span>
                </div>
                <p className="text-xs text-ink-soft">
                  <Highlighted
                    text={`${e.case.court} · ${e.case.year} · ${e.case.topic} · Jev ${Math.round(e.result.ruling.confidence * 100)}%`}
                    query={query}
                  />
                </p>
                <p className="line-clamp-3 text-sm text-ink">
                  <Highlighted text={e.case.tldr} query={query} />
                </p>
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
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string, number?][];
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-md border border-oak-900/40 bg-paper text-xs"
    >
      {options.map(([v, text, count]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`px-3 py-2 ${v === value ? "brass font-medium" : "text-ink hover:bg-wall-dark"}`}
        >
          {text}
          {count !== undefined && (
            <span
              className={`ml-1 tabular-nums ${v === value ? "text-oak-900/70" : "text-ink-soft"}`}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Detail({
  entry,
  onBack,
  prev,
  next,
  index,
  count,
  onSelect,
}: {
  entry: GalleryEntry;
  onBack: () => void;
  prev?: GalleryEntry;
  next?: GalleryEntry;
  index: number;
  count: number;
  onSelect: (id: string | null) => void;
}) {
  const c = entry.case;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft" && prev) onSelect(prev.case.id);
      else if (e.key === "ArrowRight" && next) onSelect(next.case.id);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prev, next, onSelect]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm text-ink-soft hover:text-ink">
          ← All cases
        </button>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && onSelect(prev.case.id)}
            className="text-ink-soft hover:text-ink disabled:opacity-40"
          >
            ← Previous case
          </button>
          {index >= 0 && (
            <span className="tabular-nums text-xs text-ink-soft">
              {index + 1} of {count}
            </span>
          )}
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onSelect(next.case.id)}
            className="text-ink-soft hover:text-ink disabled:opacity-40"
          >
            Next case →
          </button>
        </div>
      </div>
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
            {RECORD_FIELDS.map(({ key, label: fieldLabel }) => {
              const v = c[key];
              if (typeof v !== "string" || !v) return null;
              return (
                <div key={key}>
                  <h3 className="paper-rule pb-1 font-serif text-sm font-medium text-ink">
                    {fieldLabel}
                  </h3>
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
  const why = agree ? null : whyTheyDiffer(r, courtParty);
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
            <span className="rounded-md bg-ink/10 px-1.5 py-0.5 text-xs font-medium text-ink">
              {label(courtParty)}
            </span>
          </p>
          <p className="mt-2 text-sm text-ink">{c.actualOutcome}</p>
        </div>
        <div className="rounded-md border border-oak-900/15 p-4">
          <h3 className="font-serif text-sm font-medium text-ink">What Jev ruled</h3>
          <p className="mt-2">
            <span className="rounded-md bg-ink/10 px-1.5 py-0.5 text-xs font-medium text-ink">
              {label(jevParty)}
            </span>
          </p>
          <p className="mt-2 text-sm text-ink">{r.ruling.ruling}</p>
        </div>
      </div>
      {why && (
        <div className="mt-4 rounded-md bg-wall-dark/60 p-3">
          <h3 className="font-serif text-sm font-medium text-ink">Why they differ</h3>
          <p className="mt-1 text-sm text-ink">{why}</p>
        </div>
      )}
      <p className="mt-4 text-sm text-ink-soft">
        {sameParty
          ? `Both name the ${label(jevParty).toLowerCase()} as the prevailing party.`
          : `The court ruled for the ${label(courtParty).toLowerCase()}; Jev ruled for the ${label(jevParty).toLowerCase()}.`}
        {r.matchProbability !== undefined &&
          ` Jev put the odds of matching the real outcome at ${Math.round(r.matchProbability * 100)}%.`}
      </p>
    </div>
  );
}
