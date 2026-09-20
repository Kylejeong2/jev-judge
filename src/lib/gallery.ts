import type { CaseInput, JudgeResult } from "./types";

/** A landmark case record: `CaseInput` plus display metadata. */
export type GalleryCase = CaseInput & {
  id: string;
  year: number;
  topic: string;
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

/** Every whitespace-separated term must appear somewhere in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((t) => haystack.includes(t));
}
