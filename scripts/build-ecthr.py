"""Build a labeled CaseInput JSONL from LexGLUE ECtHR-A (test split).

Source: https://huggingface.co/datasets/coastalcph/lex_glue (config `ecthr_a`),
fetched via the datasets-server rows API into data/ecthr/raw_*.json:
  for o in $(seq 0 100 900); do curl -sL "https://datasets-server.huggingface.co/rows?dataset=coastalcph%2Flex_glue&config=ecthr_a&split=test&offset=$o&length=100" > data/ecthr/raw_$o.json; done
Each row: `text` = list of fact paragraphs from the judgment, `labels` = list of
ECHR articles the Court found violated (empty = no violation found).

Mapping: applicant = plaintiff, respondent State = defendant.
  labels non-empty -> actualPrevailingParty "plaintiff"
  labels empty     -> actualPrevailingParty "defendant"
The dataset is ~85% violation, so we take every no-violation case and an equal
number of randomly sampled violation cases for a balanced set.

    python3 scripts/build-ecthr.py --n 300 --out data/ecthr-300.jsonl
"""
import argparse
import glob
import json
import random

ARTICLES = {
    0: "Article 2 (right to life)",
    1: "Article 3 (prohibition of torture)",
    2: "Article 5 (right to liberty and security)",
    3: "Article 6 (right to a fair trial)",
    4: "Article 8 (respect for private and family life)",
    5: "Article 9 (freedom of thought, conscience and religion)",
    6: "Article 10 (freedom of expression)",
    7: "Article 11 (freedom of assembly and association)",
    8: "Article 14 (prohibition of discrimination)",
    9: "Article 1 of Protocol No. 1 (protection of property)",
}
MAX_FACT_CHARS = 12000

ap = argparse.ArgumentParser()
ap.add_argument("--n", type=int, default=300)
ap.add_argument("--out", default="data/ecthr-300.jsonl")
ap.add_argument("--seed", type=int, default=7)
a = ap.parse_args()

rows = []
for f in sorted(glob.glob("data/ecthr/raw_*.json")):
    rows += [r["row"] for r in json.load(open(f))["rows"]]

rng = random.Random(a.seed)
no_viol = [r for r in rows if not r["labels"]]
viol = [r for r in rows if r["labels"]]
rng.shuffle(no_viol)
rng.shuffle(viol)
half = a.n // 2
picked = no_viol[: min(half, len(no_viol))]
picked += viol[: a.n - len(picked)]
rng.shuffle(picked)

with open(a.out, "w") as out:
    for i, r in enumerate(picked):
        facts = "\n".join(r["text"])
        if len(facts) > MAX_FACT_CHARS:
            facts = facts[:MAX_FACT_CHARS] + "\n[... facts truncated ...]"
        violated = r["labels"]
        case = {
            "id": f"ecthr-{i:03d}",
            "title": f"ECtHR application {i:03d} (LexGLUE ecthr_a test)",
            "jurisdiction": "Council of Europe (European Convention on Human Rights)",
            "court": "European Court of Human Rights",
            "caseType": "human rights application against a State",
            "questionPresented": (
                "Did the respondent State violate any of the applicant's rights under "
                "Articles 2, 3, 5, 6, 8, 9, 10, 11 or 14 of the Convention, or Article 1 "
                "of Protocol No. 1?"
            ),
            "facts": facts,
            "plaintiffArguments": (
                "The applicant contends that the acts and omissions of the State authorities "
                "described in the facts violated their Convention rights and seeks a finding "
                "of violation and just satisfaction."
            ),
            "defendantArguments": (
                "The respondent Government contends that the complaints are inadmissible or "
                "that the authorities acted lawfully, pursued a legitimate aim and were "
                "proportionate, so that no violation occurred."
            ),
            "applicableLaw": (
                "European Convention on Human Rights, Articles 2, 3, 5, 6, 8, 9, 10, 11, 14 "
                "and Article 1 of Protocol No. 1. The applicant (plaintiff) prevails if the "
                "Court finds at least one violation; the State (defendant) prevails if it finds none."
            ),
            "additionalContext": (
                "Facts are taken verbatim from the judgment's statement of facts. The Court's "
                "own legal assessment is not included."
            ),
            "actualPrevailingParty": "plaintiff" if violated else "defendant",
            "actualOutcome": (
                "Violation found of " + "; ".join(ARTICLES[l] for l in sorted(violated))
                if violated
                else "No violation of the Convention found"
            ),
        }
        out.write(json.dumps(case) + "\n")
print(f"wrote {len(picked)} cases ({len([p for p in picked if p['labels']])} violation) to {a.out}")
