export const OPTION_LABELS: Record<string, string> = {
  // prevailing_party
  plaintiff: "Plaintiff", defendant: "Defendant", mixed: "Mixed result", other: "Other",
  // appellate_disposition
  affirmed: "Affirmed", reversed: "Reversed",
  affirmed_in_part_reversed_in_part: "Affirmed in part, reversed in part",
  vacated_and_remanded: "Vacated and remanded", dismissed: "Appeal dismissed",
  not_on_appeal: "Not an appeal",
  // remedy
  compensatory_damages: "Compensatory damages", nominal_or_limited_damages: "Nominal or limited damages",
  punitive_damages: "Punitive damages", specific_performance_or_injunction: "Specific performance or injunction",
  declaratory_relief: "Declaratory relief", restitution: "Restitution",
  dismissal_or_judgment_for_defendant: "Dismissal or judgment for defendant",
  new_trial_or_remand: "New trial or remand", criminal_sentence: "Criminal sentence", acquittal: "Acquittal",
  // findings (noul ids)
  duty_or_obligation: "Duty or obligation owed", breach_or_violation: "Breach or violation",
  causation: "Causation", harm_or_damages_proven: "Harm or damages proven",
  standard_of_proof_met: "Standard of proof met", affirmative_defense_succeeds: "Affirmative defense succeeds",
  procedural_bar: "Procedural bar", precedent_favors_plaintiff: "Precedent favors plaintiff",
  statute_favors_plaintiff: "Statute favors plaintiff", novel_question_of_law: "Novel question of law",
  // scores
  plaintiff_case_strength: "Plaintiff's case strength", defendant_case_strength: "Defendant's case strength",
  record_sufficiency: "Record sufficiency", legal_clarity: "Legal clarity", harm_severity: "Harm severity",
};
export const label = (id: string) => OPTION_LABELS[id] ?? id.replace(/_/g, " ");
