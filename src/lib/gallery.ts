import type { CaseInput, JudgeResult } from "./types";
import type { SearchDoc } from "./search";

/** A landmark case record: `CaseInput` plus display metadata. */
export type GalleryCase = CaseInput & {
  id: string;
  year: number;
  topic: string;
  tldr: string;
};

export type GalleryEntry = {
  case: GalleryCase;
  result: JudgeResult;
};

/** Build the lowercase haystack a search query is matched against. */
export function searchText(e: GalleryEntry): string {
  const c = e.case;
  return [
    c.title,
    c.topic,
    c.court,
    c.jurisdiction,
    c.caseType,
    String(c.year),
    c.tldr,
    c.questionPresented,
    c.facts,
    c.actualOutcome,
    e.result.ruling.ruling,
    e.result.ruling.prevailingParty,
    ...e.result.ruling.keyFactors,
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

/**
 * Build a weighted SearchDoc for ranked fuzzy search.
 * Title is the first field so rankSearch's shorter-title tie-break applies.
 */
export function galleryDoc(e: GalleryEntry): SearchDoc {
  const c = e.case;
  const r = e.result.ruling;
  return {
    id: c.id,
    fields: [
      { text: c.title, weight: 5 },
      { text: c.topic, weight: 3 },
      { text: c.court ?? "", weight: 2 },
      { text: String(c.year), weight: 2 },
      { text: c.jurisdiction ?? "", weight: 2 },
      { text: c.caseType ?? "", weight: 2 },
      { text: c.questionPresented ?? "", weight: 2 },
      { text: c.tldr, weight: 2 },
      {
        text: [r.ruling, r.prevailingParty, ...r.keyFactors].join(" "),
        weight: 1.5,
      },
      { text: c.facts, weight: 1 },
      { text: c.actualOutcome ?? "", weight: 1 },
    ],
  };
}

/** Every whitespace-separated term must appear somewhere in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((t) => haystack.includes(t));
}
