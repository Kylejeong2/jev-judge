import type { JudgeResult, Party } from "./types";
import { label } from "./labels";
// true => proposition favors plaintiff when p is high; false => favors defendant when p is high
const PLAINTIFF_LEANING: Record<string, boolean> = {
  duty_or_obligation: true, breach_or_violation: true, causation: true, harm_or_damages_proven: true,
  standard_of_proof_met: true, precedent_favors_plaintiff: true, statute_favors_plaintiff: true,
  affirmative_defense_succeeds: false, procedural_bar: false,
};
/** One sentence explaining the strongest findings behind Jev's winner, contrasted with the court. Returns null if Jev's winner isn't plaintiff/defendant or no finding is strong enough. */
export function whyTheyDiffer(result: JudgeResult, courtParty: Party): string | null {
  const jev = result.ruling.prevailingParty;
  if (jev !== "plaintiff" && jev !== "defendant") return null;
  const wantPlaintiff = jev === "plaintiff";
  const reasons = Object.entries(result.ruling.findings)
    .filter(([id]) => id in PLAINTIFF_LEANING)
    .map(([id, p]) => {
      const favorsPlaintiffWhenTrue = PLAINTIFF_LEANING[id];
      // "likely" when p>=0.7, "unlikely" when p<=0.3; does that direction support Jev's winner?
      const likely = p >= 0.7, unlikely = p <= 0.3;
      const supports = wantPlaintiff
        ? (favorsPlaintiffWhenTrue && likely) || (!favorsPlaintiffWhenTrue && unlikely)
        : (favorsPlaintiffWhenTrue && unlikely) || (!favorsPlaintiffWhenTrue && likely);
      return supports ? { id, p, text: `${label(id).toLowerCase()} ${likely ? "likely" : "unlikely"} (${Math.round(p * 100)}%)` } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => Math.abs(b.p - 0.5) - Math.abs(a.p - 0.5))
    .slice(0, 2);
  if (reasons.length === 0) return null;
  const found = reasons.map((r) => r.text).join(" and ");
  return `Jev found ${found}; the court ruled for the ${label(courtParty).toLowerCase()}.`;
}
