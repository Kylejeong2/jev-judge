# Jev as a Judge

Give [Jev](https://docs.typesafe.ai) (TypeSafe's System One model) the record of a case — facts, evidence, arguments, law, precedents — and get back a disposition with calibrated confidence plus the full probability distributions behind it. Run one case in the UI, or thousands via the batch page / CLI and score them against real outcomes.

## How it uses Jev

Jev doesn't generate prose; it answers typed questions about a `state` with probabilities. So a case is sent as one structured JSON object (`case.facts`, `case.evidence`, `case.arguments.plaintiff`, `case.law.precedents`, …) and the "ruling" is a single request with 18 atomic questions evaluated in parallel:

| Primitive | Questions |
|---|---|
| **Choice** | `prevailing_party` (plaintiff / defendant / mixed / other), `appellate_disposition` (affirmed / reversed / … / not_on_appeal), `remedy` (11 options) |
| **Noul** (P(true)) | `duty_or_obligation`, `breach_or_violation`, `causation`, `harm_or_damages_proven`, `standard_of_proof_met`, `affirmative_defense_succeeds`, `procedural_bar`, `precedent_favors_plaintiff`, `statute_favors_plaintiff`, `novel_question_of_law` |
| **Score** | `plaintiff_case_strength`, `defendant_case_strength` (0–4), `record_sufficiency`, `legal_clarity` (0–2), `harm_severity` (0–3) |

`src/lib/judge.ts` then composes the disposition sentence, confidence (from the `prevailing_party` Choice), key signals, and a `needsReview` flag (low confidence, thin record, or likely procedural bar) deterministically in code. Every answer's probabilities are kept in the result so you can re-threshold or analyze offline.

## Setup

```bash
npm install
cp .env.example .env.local   # set TYPESAFE_API_KEY (optionally JEV_MODEL, default jev-latest)
npm run dev                  # http://localhost:3000
```

## Usage

- **`/`** — single-case form. Fill in the record, submit, read the ruling.
- **`/batch`** — paste/upload JSONL or a JSON array of cases, pick concurrency, watch results stream in. Shows accuracy vs `actualOutcome`, average confidence, prevailing-party breakdown; export CSV/JSONL.
- **CLI** — for very large runs (resumable; skips ids already in the output file):

  ```bash
  npm run batch -- --in data/sample-cases.jsonl --out results/run1.jsonl --concurrency 8
  ```

### Case format

```jsonc
{
  "id": "palsgraf",                 // optional; used for resume/dedupe
  "title": "Palsgraf v. LIRR",      // required
  "facts": "...",                   // required
  "jurisdiction": "New York",
  "court": "...", "caseType": "...", "questionPresented": "...",
  "proceduralHistory": "...", "evidence": "...",
  "plaintiffArguments": "...", "defendantArguments": "...",
  "applicableLaw": "...", "precedents": "...", "additionalContext": "...",
  "actualOutcome": "Reversed; judgment for defendant"   // optional; enables scoring
}
```

### Result format

```jsonc
{
  "caseId": "...", "title": "...", "model": "jev-1.13.0", "latencyMs": 1234, "inputTokens": 2900,
  "ruling": {
    "ruling": "Judgment for the defending party; relief denied. Decision below: reversed.",
    "prevailingParty": "defendant",          // plaintiff | defendant | mixed | other
    "confidence": 0.82,                      // confidence of the prevailing_party Choice
    "needsReview": false,
    "prevailingPartyAnswer": { "choice": "defendant", "probabilities": { "plaintiff": 0.12, "defendant": 0.82, "mixed": 0.04, "other": 0.02 }, "confidence": 0.82 },
    "appellateDisposition": { "choice": "reversed", "probabilities": { ... }, "confidence": 0.7 },
    "remedy": { "choice": "dismissal_or_judgment_for_defendant", "probabilities": { ... }, "confidence": 0.6 },
    "findings": { "duty_or_obligation": 0.21, "causation": 0.15, ... },      // Noul probabilities
    "scores": { "plaintiff_case_strength": { "score": 1.3, "max": 4, "legend": [...], "probabilities": { ... }, "confidence": 0.7 }, ... },
    "keyFactors": ["duty or obligation: unlikely (21%)", ...]
  },
  "actualOutcome": "...", "matchProbability": 0.94, "matchesActual": true   // when actualOutcome was given
}
```

`matchesActual` comes from a second small Jev request: a Noul asking whether the predicted and actual dispositions agree on who prevailed (wording differs across sources, so string matching is unreliable).

## API

- `POST /api/judge` — body: one case → `JudgeResult`
- `POST /api/batch` — body: `{ cases: CaseInput[], concurrency?: number }` → NDJSON stream of `start` / `result` / `error` / `done` events

## Layout

- `src/lib/judge.ts` — case → structured state, the question battery (`QUESTIONS`), composition into a `Ruling`, concurrency helper
- `src/lib/typesafe.ts` — thin client for `POST /v1/systemone` with typed questions/answers and retry on 429/5xx
- `src/lib/types.ts` — `CaseInput`, `Ruling`, `JudgeResult`, `BatchEvent`
- `scripts/batch.ts` — CLI batch runner
- `data/sample-cases.jsonl` — five sample cases with known outcomes
