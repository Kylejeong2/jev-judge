/**
 * Pure, dependency-free ranked search over weighted text fields.
 * Used by the gallery and the command palette.
 */

export type SearchDoc = {
  id: string;
  fields: { text: string; weight: number }[];
};

export type SearchHit = { id: string; score: number };

/** Lowercase, strip punctuation except "." (so "v." survives), collapse spaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(query: string): string[] {
  return normalize(query).split(" ").filter(Boolean);
}

/**
 * Damerau-ish edit distance with early bailout at `max`.
 * Counts a single adjacent transposition (e.g. "mirnda" vs "miranda")
 * as one edit.
 */
export function editDistance(a: string, b: string, max = 1): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const prev2 = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(
        prev[j] + 1, // deletion
        cur[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      // adjacent transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1] &&
        prev2[j - 2] !== undefined
      ) {
        d = Math.min(d, prev2[j - 2] + 1);
      }
      cur[j] = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev.splice(0, prev.length, ...cur);
  }
  return prev[b.length];
}

/** Best match score for one token within one field's text. */
function tokenScore(token: string, fieldText: string): number {
  const norm = normalize(fieldText);
  if (!norm) return 0;
  const ws = norm.split(" ");
  if (ws.includes(token)) return 3; // exact word
  if (ws.some((w) => w.startsWith(token))) return 2; // word prefix
  if (norm.includes(token)) return 1; // substring
  if (token.length >= 5) {
    // fuzzy: edit distance <= 1 against any word
    if (ws.some((w) => editDistance(token, w, 1) <= 1)) return 0.6;
  }
  return 0;
}

/**
 * Rank docs against a whitespace-tokenized query. A doc matches only if
 * every token scores > 0 in at least one field. Score is the sum over
 * tokens of (best match score x field weight). Ties break toward the
 * shorter first field (the title by convention). An empty query returns
 * every doc with score 0 in the original order.
 */
export function rankSearch(
  docs: SearchDoc[],
  query: string,
  limit = Infinity,
): SearchHit[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    const all = docs.map((d) => ({ id: d.id, score: 0 }));
    return all.slice(0, limit === Infinity ? docs.length : limit);
  }
  const hits: { id: string; score: number; titleLen: number }[] = [];
  for (const doc of docs) {
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      let best = 0;
      for (const f of doc.fields) {
        if (!f.text) continue;
        const s = tokenScore(t, f.text) * f.weight;
        if (s > best) best = s;
      }
      if (best <= 0) {
        ok = false;
        break;
      }
      score += best;
    }
    if (ok) hits.push({ id: doc.id, score, titleLen: doc.fields[0]?.text.length ?? 0 });
  }
  hits.sort((a, b) => b.score - a.score || a.titleLen - b.titleLen);
  const out = hits.slice(0, limit === Infinity ? hits.length : limit);
  return out.map(({ id, score }) => ({ id, score }));
}

/**
 * Split `text` into segments marking where query tokens appear
 * (exact / prefix / substring matching only — no fuzzy marks), for
 * rendering <mark> around hits. Case-insensitive; punctuation inside
 * a token other than "." is ignored.
 */
export function highlight(
  text: string,
  query: string,
): { text: string; hit: boolean }[] {
  const tokens = tokenizeQuery(query);
  if (!text || tokens.length === 0) return [{ text, hit: false }];
  // Map cleaned positions back to original positions by replacing
  // unwanted chars with spaces in place (same length).
  const lowered = text.toLowerCase();
  const cleaned = lowered.replace(/[^\p{L}\p{N}.\s]/gu, " ");
  const marks: Array<[number, number]> = [];
  for (const t of tokens) {
    let idx = cleaned.indexOf(t);
    while (idx !== -1) {
      marks.push([idx, idx + t.length]);
      idx = cleaned.indexOf(t, idx + 1);
    }
  }
  if (marks.length === 0) return [{ text, hit: false }];
  marks.sort((a, b) => a[0] - b[0]);
  // merge overlapping marks
  const merged: Array<[number, number]> = [];
  for (const [s, e] of marks) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const segs: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) segs.push({ text: text.slice(pos, s), hit: false });
    segs.push({ text: text.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), hit: false });
  return segs;
}
