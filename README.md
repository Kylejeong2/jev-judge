# Jev as a Judge

Give Jev the record of a case — facts, evidence, arguments, law, precedents — and get back a ruling with a calibrated confidence, the opinion, key factors, and the authorities relied on. Run one case in the UI, or thousands via the batch page / CLI and score them against real outcomes.

## Setup

```bash
npm install
cp .env.example .env.local   # set JEV_API_KEY (and JEV_PROVIDER / JEV_MODEL / JEV_BASE_URL as needed)
npm run dev                  # http://localhost:3000
```

Any OpenAI-compatible endpoint works via `JEV_PROVIDER=openai` + `JEV_BASE_URL`, so a fine-tuned or self-hosted Jev can be dropped in without code changes.

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
  "caseId": "...", "title": "...", "model": "anthropic/claude-sonnet-4-5", "latencyMs": 8123,
  "ruling": {
    "ruling": "Reversed; complaint dismissed.",
    "prevailingParty": "defendant",          // plaintiff | defendant | mixed | other
    "confidence": 0.82,                      // 0..1
    "reasoning": "...", "keyFactors": ["..."], "controllingAuthority": ["..."],
    "dissentingConsiderations": "...", "remedy": "N/A"
  },
  "actualOutcome": "...", "matchesActual": true   // present when actualOutcome was given
}
```

`matchesActual` is decided by a second, tiny LLM call comparing the actual and predicted dispositions (wording differs across sources, so string matching is unreliable).

## API

- `POST /api/judge` — body: one case → `JudgeResult`
- `POST /api/batch` — body: `{ cases: CaseInput[], concurrency?: number }` → NDJSON stream of `start` / `result` / `error` / `done` events

## Layout

- `src/lib/judge.ts` — system prompt, case → prompt builder, JSON parsing, concurrency helper
- `src/lib/llm.ts` — provider-agnostic chat completion (Anthropic Messages / OpenAI-compatible)
- `src/lib/types.ts` — `CaseInput`, `Ruling`, `JudgeResult`, `BatchEvent`
- `scripts/batch.ts` — CLI batch runner
- `data/sample-cases.jsonl` — five sample cases with known outcomes
