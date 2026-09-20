/**
 * Join case records with their Jev results into the static gallery dataset
 * consumed by /gallery.
 *
 *   npm run batch -- --in data/landmark-cases.jsonl --out results/landmark.jsonl
 *   npx tsx scripts/build-gallery.ts   # -> src/data/gallery.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { CaseInput, JudgeResult } from "../src/lib/types";
import type { GalleryEntry, GalleryCase } from "../src/lib/gallery";

const casesPath = process.argv[2] ?? "data/landmark-cases.jsonl";
const resultsPath = process.argv[3] ?? "results/landmark.jsonl";
const outPath = process.argv[4] ?? "src/data/gallery.json";

const lines = (p: string) => readFileSync(p, "utf8").split("\n").filter(Boolean);

const results = new Map<string, JudgeResult>();
for (const l of lines(resultsPath)) {
  const r = JSON.parse(l) as JudgeResult;
  results.set(r.caseId, r);
}

const tldrs = new Map<string, string>();
for (const c of JSON.parse(readFileSync("data/landmark-list.json", "utf8")) as {
  id: string;
  tldr: string;
}[]) {
  tldrs.set(c.id, c.tldr);
}

const entries: GalleryEntry[] = [];
for (const l of lines(casesPath)) {
  const c = JSON.parse(l) as GalleryCase & CaseInput;
  const result = results.get(c.id!);
  if (!result) {
    console.warn(`no result for ${c.id}, skipping`);
    continue;
  }
  const tldr = tldrs.get(c.id!);
  if (!tldr) throw new Error(`no tldr for ${c.id} in landmark-list.json`);
  c.tldr = tldr;
  entries.push({ case: c, result });
}
entries.sort((a, b) => a.case.year - b.case.year);

writeFileSync(outPath, JSON.stringify(entries));
const correct = entries.filter((e) => e.result.matchesActual).length;
console.log(`${entries.length} entries -> ${outPath} (${correct} match actual outcome)`);
