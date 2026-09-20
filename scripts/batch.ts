/**
 * Run Jev over a large set of cases from the terminal (no UI, resumable).
 *
 *   npx tsx scripts/batch.ts --in data/cases.jsonl --out results/run1.jsonl --concurrency 8
 *
 * Input: JSONL or JSON array of CaseInput. Output: JSONL of JudgeResult, appended as cases finish.
 * Re-running with the same --out skips cases whose id already appears in the output file.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { config as loadEnv } from "dotenv";
import { judgeCase, runWithConcurrency } from "../src/lib/judge";
import type { CaseInput, JudgeResult } from "../src/lib/types";

loadEnv({ path: [".env.local", ".env"] });

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const inPath = arg("in");
const outPath = arg("out", "results/jev-results.jsonl")!;
const concurrency = Number(arg("concurrency", "4"));
if (!inPath) {
  console.error(
    "usage: tsx scripts/batch.ts --in cases.jsonl [--out results.jsonl] [--concurrency 4]",
  );
  process.exit(1);
}

const text = readFileSync(inPath, "utf8").trim();
let cases: CaseInput[] = text.startsWith("[")
  ? JSON.parse(text)
  : text
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
cases = cases.map((c, i) => ({ ...c, id: c.id ?? String(i) }));

mkdirSync(dirname(outPath), { recursive: true });
const doneIds = new Set<string>();
if (existsSync(outPath)) {
  for (const line of readFileSync(outPath, "utf8")
    .split("\n")
    .filter(Boolean)) {
    doneIds.add((JSON.parse(line) as JudgeResult).caseId);
  }
}
const todo = cases.filter((c) => !doneIds.has(c.id!));
console.log(
  `${cases.length} cases, ${doneIds.size} already done, ${todo.length} to run (concurrency ${concurrency})`,
);

let ok = 0;
let failed = 0;
let scored = 0;
let correct = 0;
const started = Date.now();

void runWithConcurrency(todo, concurrency, judgeCase, (i, outcome) => {
  const c = todo[i];
  if (outcome.ok) {
    ok++;
    const r = outcome.value;
    appendFileSync(outPath, JSON.stringify(r) + "\n");
    if (r.matchesActual !== undefined) {
      scored++;
      if (r.matchesActual) correct++;
    }
    console.log(
      `[${ok + failed}/${todo.length}] ${c.title} -> ${r.ruling.ruling} (${Math.round(r.ruling.confidence * 100)}%)` +
        (r.matchesActual === undefined
          ? ""
          : r.matchesActual
            ? " MATCH"
            : " MISMATCH"),
    );
  } else {
    failed++;
    console.error(
      `[${ok + failed}/${todo.length}] ${c.title} FAILED: ${outcome.error instanceof Error ? outcome.error.message : outcome.error}`,
    );
  }
}).then(() => {
  console.log(
    `\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s: ${ok} ok, ${failed} failed` +
      (scored
        ? `, accuracy ${correct}/${scored} (${Math.round((correct / scored) * 100)}%)`
        : "") +
      `\nResults: ${outPath}`,
  );
});
