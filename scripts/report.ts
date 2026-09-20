/**
 * Accuracy + calibration report for a results JSONL produced by scripts/batch.ts.
 *
 *   npx tsx scripts/report.ts results/run.jsonl
 *
 * Only rows with a ground-truth label (`matchesActual` defined) are scored.
 * Confidence = probability Jev put on the predicted prevailing party.
 */
import { readFileSync } from "node:fs";
import type { JudgeResult } from "../src/lib/types";

const path = process.argv[2];
if (!path) {
  console.error("usage: tsx scripts/report.ts results.jsonl");
  process.exit(1);
}

const rows = readFileSync(path, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as JudgeResult)
  .filter((r) => typeof r.matchesActual === "boolean");

const n = rows.length;
const correct = rows.filter((r) => r.matchesActual).length;
console.log(`scored: ${n}   accuracy: ${correct}/${n} = ${pct(correct / n)}`);

// Confusion by predicted vs actual party (only when exact labels exist).
const labeled = rows.filter((r) => r.actualPrevailingParty);
if (labeled.length) {
  const table = new Map<string, number>();
  for (const r of labeled) {
    const k = `${r.actualPrevailingParty} -> ${r.ruling.prevailingParty}`;
    table.set(k, (table.get(k) ?? 0) + 1);
  }
  console.log("\nactual -> predicted:");
  for (const [k, v] of [...table].sort()) console.log(`  ${k.padEnd(24)} ${v}`);
}

// Calibration: bin by confidence, compare mean confidence to accuracy.
const bins = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];
console.log("\nconfidence bin   n    acc     mean conf   gap");
let ece = 0;
for (let i = 0; i < bins.length - 1; i++) {
  const lo = i === 0 ? 0 : bins[i];
  const hi = bins[i + 1];
  const b = rows.filter((r) => r.ruling.confidence >= lo && r.ruling.confidence < hi);
  if (!b.length) continue;
  const acc = b.filter((r) => r.matchesActual).length / b.length;
  const conf = b.reduce((s, r) => s + r.ruling.confidence, 0) / b.length;
  ece += (b.length / n) * Math.abs(acc - conf);
  console.log(
    `[${lo.toFixed(1)}, ${Math.min(hi, 1).toFixed(1)})     ${String(b.length).padStart(4)}  ${pct(acc).padStart(6)}  ${pct(conf).padStart(9)}   ${(acc - conf >= 0 ? "+" : "") + pct(acc - conf)}`,
  );
}
console.log(`\nexpected calibration error (ECE): ${pct(ece)}`);

// Brier score on the binary "predicted party is right" event.
const brier =
  rows.reduce((s, r) => s + (r.ruling.confidence - (r.matchesActual ? 1 : 0)) ** 2, 0) / n;
console.log(`Brier score: ${brier.toFixed(3)}  (0 = perfect, 0.25 = uninformative at 50%)`);

// Does needsReview flag the wrong ones?
const flagged = rows.filter((r) => r.ruling.needsReview);
if (flagged.length) {
  const flaggedAcc = flagged.filter((r) => r.matchesActual).length / flagged.length;
  const rest = rows.filter((r) => !r.ruling.needsReview);
  const restAcc = rest.filter((r) => r.matchesActual).length / Math.max(rest.length, 1);
  console.log(
    `\nneedsReview: ${flagged.length}/${n} flagged; accuracy flagged ${pct(flaggedAcc)} vs unflagged ${pct(restAcc)}`,
  );
}

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}
