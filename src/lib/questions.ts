import { choice, noul, score } from "./typesafe";

// ---------------------------------------------------------------------------
// Questions: one parallel battery of atomic Choice / Score / Noul questions.
// Every question is evaluated independently, so each one is self-contained:
// no question refers to the answer of another. Shared guidance lives in
// named fields of a structured `instructions` object, per
// https://docs.typesafe.ai/concepts/how-to-build-with-system-one#use-structure-in-the-questions
// ---------------------------------------------------------------------------

/** "plaintiff" = the party seeking relief; "defendant" = the party opposing it. */
const PARTY_CONVENTION =
  '"plaintiff" means the party seeking relief in `case` (plaintiff, prosecution, petitioner, appellant, claimant, or movant). "defendant" means the party opposing that relief (defendant, respondent, appellee, accused).';

const BASIS =
  "Decide on the record in `case` only: `case.facts`, `case.evidence`, `case.arguments`, and `case.law`. Do not rely on knowing how the real case was decided.";

/** Generalizes the tort/contract/criminal vocabulary so one battery fits all case types. */
const ELEMENT_CONVENTION =
  "Read each element in the sense appropriate to `case.case_type`: in tort, duty of care and its breach; in contract, an enforceable obligation and its non-performance; in a statutory or constitutional claim, a rule the defendant was bound by and its violation; in a criminal matter, the elements of the charged offense.";

const q = (question: string, extra: Record<string, string> = {}) => ({
  question,
  ...extra,
  basis: BASIS,
});

const STRENGTH_SCALE = [
  {
    what: "No viable case; fails on the record as a matter of law",
    examples: ["Claim barred outright by settled law", "Essential element has no factual support at all"],
  },
  {
    what: "Weak; significant gaps in facts, evidence, or legal support",
    examples: ["Key element rests on speculation", "Controlling authority cuts against this party"],
  },
  {
    what: "Arguable; a genuine dispute that could go either way",
    examples: ["Credible evidence on both sides", "Law unsettled on the decisive point"],
  },
  {
    what: "Strong; well supported by the record and the applicable law",
    examples: ["Elements supported by documents or admissions", "Authority favors this party"],
  },
  {
    what: "Compelling; the record and law point clearly to this party",
    examples: ["Undisputed facts and squarely controlling law"],
  },
];

export const QUESTIONS = {
  // -------------------------------------------------------------------------
  // Choices
  // -------------------------------------------------------------------------
  prevailing_party: choice(
    q(
      "Applying `case.law` to `case.facts` and `case.evidence`, which party should prevail on `case.question_presented` (or, if absent, on the dispute as a whole)?",
      { party_convention: PARTY_CONVENTION },
    ),
    {
      plaintiff: {
        what: "The party seeking relief wins the dispositive issue: its claim, motion, or appeal is granted, or the conviction it seeks is entered",
        not_for: "Relief granted only on a minor point while the main claim fails",
        examples: ["Judgment for plaintiff", "Appeal allowed; new trial on plaintiff's damages theory", "Conviction affirmed on the prosecution's appeal"],
      },
      defendant: {
        what: "The party opposing relief wins the dispositive issue: the claim, motion, or appeal is denied or dismissed, or the accused is acquitted",
        not_for: "Defendant loses the main claim but defeats a secondary one",
        examples: ["Complaint dismissed", "Judgment below for plaintiff reversed", "Verdict of not guilty"],
      },
      mixed: {
        what: "Each side wins a substantial part on the merits",
        not_for: "One side clearly wins and the other gets only a token concession",
        examples: ["Affirmed in part, reversed in part", "Liability found but damages sharply cut on the defendant's cross-appeal"],
      },
      other: {
        what: "No party prevails on the merits",
        not_for: "Any ruling that decides the dispositive issue for one side",
        examples: ["Remand for further findings without deciding", "Dismissal for want of jurisdiction", "Record too thin to decide"],
      },
    },
  ),

  appellate_disposition: choice(
    q(
      "If `case.procedural_history` shows this matter is an appeal or review of a lower court's decision, what should the reviewing court do with the decision below? If there is no decision below to review, choose not_on_appeal.",
    ),
    {
      affirmed: { what: "Lower decision upheld in full", not_for: "Any change to the judgment below" },
      reversed: { what: "Lower decision overturned; the opposite result is entered or the case returns for a new trial on the correct rule", not_for: "Partial reversals" },
      affirmed_in_part_reversed_in_part: { what: "Some holdings upheld and others overturned", not_for: "Full affirmance or full reversal" },
      vacated_and_remanded: { what: "Lower decision set aside and sent back without the reviewing court deciding the merits", not_for: "Reversal that resolves the merits" },
      dismissed: { what: "Appeal dismissed without reaching the merits", examples: ["untimely", "moot", "no appellate jurisdiction"] },
      not_on_appeal: { what: "First-instance matter (trial, motion, or hearing); there is no lower decision under review" },
    },
  ),

  remedy: choice(
    q(
      "Given the relief sought in `case.arguments.plaintiff` and the outcome `case.facts`, `case.evidence`, and `case.law` support, what remedy or order should the court enter?",
      { party_convention: PARTY_CONVENTION },
    ),
    {
      compensatory_damages: { what: "Money damages measured by the plaintiff's actual loss", not_for: "Damages limited to a token sum, or restitution of what the defendant holds" },
      nominal_or_limited_damages: { what: "Token damages, or damages sharply limited by a legal rule", examples: ["Nominal damages for a technical breach", "Lost profits excluded as unforeseeable"] },
      punitive_damages: { what: "Damages to punish, awarded on top of compensation" },
      specific_performance_or_injunction: { what: "Order compelling performance, or compelling or forbidding conduct" },
      declaratory_relief: { what: "Declaration of the parties' rights without a coercive order" },
      restitution: { what: "Return of money or property the defendant holds, or disgorgement of gains", examples: ["Refund of a security deposit", "Return of an overpayment"] },
      dismissal_or_judgment_for_defendant: { what: "Claim dismissed or judgment entered against the party seeking relief; no relief awarded" },
      new_trial_or_remand: { what: "Case returned for a new trial or further proceedings", not_for: "A reviewing court that itself enters final judgment" },
      criminal_sentence: { what: "Conviction with a sentence (fine, probation, imprisonment)" },
      acquittal: { what: "Criminal defendant found not guilty or charges dismissed" },
      other: { what: "Some other remedy, or none of the above fits" },
    },
  ),

  // -------------------------------------------------------------------------
  // Nouls: element-by-element findings (probabilities, not verdicts)
  // -------------------------------------------------------------------------
  duty_or_obligation: noul(
    q(
      "On `case.facts` and `case.law`, did the defendant owe the plaintiff a legal duty or obligation enforceable in this action?",
      { party_convention: PARTY_CONVENTION, element_convention: ELEMENT_CONVENTION },
    ),
    {
      true: "A duty of care, enforceable promise, statutory obligation, or (criminal) applicable prohibition ran from the defendant to the plaintiff",
      false: "No such duty or obligation existed, or it did not extend to this plaintiff (e.g. harm to this plaintiff was unforeseeable, no privity, no valid contract formed)",
    },
  ),
  breach_or_violation: noul(
    q(
      "On `case.facts` and `case.evidence`, did the defendant fail to perform, breach, or violate a legal duty or obligation it owed to the plaintiff?",
      { party_convention: PARTY_CONVENTION, element_convention: ELEMENT_CONVENTION },
    ),
    {
      true: "The defendant's conduct fell short of what the applicable duty, promise, statute, or rule required (e.g. refused to pay a promised reward, delivered late, drove negligently, committed the charged act)",
      false: "The defendant performed as required, or the conduct complained of did not violate any obligation",
    },
  ),
  causation: noul(
    q(
      "On `case.facts` and `case.evidence`, was the defendant's conduct the legal (proximate) cause of the loss or harm the plaintiff complains of?",
      { party_convention: PARTY_CONVENTION },
    ),
    {
      true: "The plaintiff's loss or injury flowed from the defendant's conduct and was within the scope of risk or the reasonable contemplation of the parties",
      false: "The loss was too remote, unforeseeable, caused by an independent intervening act, or would have occurred anyway",
    },
  ),
  harm_or_damages_proven: noul(
    q(
      "Has the plaintiff proven, on `case.evidence`, a cognizable loss, injury, or harm, rather than merely alleging one?",
      { party_convention: PARTY_CONVENTION },
    ),
    {
      true: "The record contains concrete evidence of a legally recognized loss (medical evidence, receipts, lost money, physical injury, unlawfully retained funds)",
      false: "Harm is asserted only in argument, is speculative, or is not of a kind the law compensates",
    },
  ),
  standard_of_proof_met: noul(
    q(
      "Does `case.evidence`, taken as a whole and against the contrary evidence, satisfy the plaintiff's burden under the standard of proof that governs this kind of case?",
      {
        party_convention: PARTY_CONVENTION,
        standards: "Civil claims: preponderance of the evidence (more likely than not). Fraud, punitive damages, and some statutory claims: clear and convincing evidence. Criminal charges: beyond a reasonable doubt.",
      },
    ),
    {
      true: "The plaintiff's evidence on each contested element clears the applicable standard",
      false: "On at least one contested element the plaintiff's evidence does not clear the applicable standard, or the defendant's contrary evidence is at least as strong",
    },
  ),
  affirmative_defense_succeeds: noul(
    q(
      "Does an affirmative defense or justification raised in `case.arguments.defendant` defeat or substantially reduce the plaintiff's claim on `case.facts` and `case.law`?",
      {
        party_convention: PARTY_CONVENTION,
        examples: "consent, assumption of risk, comparative or contributory negligence, statute of limitations, statute of frauds, impossibility, waiver, estoppel, self-defense, necessity, immunity, duress, lack of consideration",
      },
    ),
    {
      true: "A defense actually raised is supported by the facts and would bar or materially cut the recovery",
      false: "No affirmative defense is raised, or those raised fail on the facts or the law. Arguments that the plaintiff simply has not proven its case are not affirmative defenses",
    },
  ),
  procedural_bar: noul(
    q(
      "Does a procedural or jurisdictional defect prevent the court from reaching the merits of `case.question_presented`?",
      { examples: "lack of standing, lack of subject-matter or personal jurisdiction, untimely filing or appeal, failure to preserve the issue below, mootness, failure to exhaust remedies, res judicata" },
    ),
    {
      true: "A defect apparent from `case.procedural_history` or `case.arguments.defendant` requires dismissal or refusal to decide the merits",
      false: "The court can properly decide the merits",
    },
  ),
  precedent_favors_plaintiff: noul(
    q(
      "Do the precedents described in `case.law.precedents`, taken as described, on balance support the plaintiff's position rather than the defendant's?",
      { party_convention: PARTY_CONVENTION },
    ),
    {
      true: "The holdings or rules of the cited cases, applied to these facts, point toward relief for the plaintiff",
      false: "The cited cases point toward the defendant, are distinguishable in the defendant's favor, or no precedents are provided",
    },
  ),
  statute_favors_plaintiff: noul(
    q(
      "Does the plain text of the statutes, rules, or contract terms in `case.law.applicable` on balance support the plaintiff's position rather than the defendant's?",
      { party_convention: PARTY_CONVENTION },
    ),
    {
      true: "The governing text, read naturally and applied to these facts, points toward relief for the plaintiff",
      false: "The text points toward the defendant, is silent on the decisive point, or no applicable text is provided",
    },
  ),
  novel_question_of_law: noul(
    q(
      "Does resolving `case.question_presented` require the court to decide a question of law that `case.law` does not clearly settle?",
    ),
    {
      true: "The decisive legal rule is unsettled, contested between the parties with plausible authority on each side, or must be extended to new facts",
      false: "The decisive rule is settled by the cited law and the dispute is mainly about applying it to the facts",
    },
  ),

  // -------------------------------------------------------------------------
  // Scores: ordered scales with described levels
  // -------------------------------------------------------------------------
  plaintiff_case_strength: score(
    q("How strong is the plaintiff's overall case on the record in `case`?", {
      party_convention: PARTY_CONVENTION,
    }),
    STRENGTH_SCALE,
  ),
  defendant_case_strength: score(
    q(
      "How strong is the defendant's overall position (the defenses and counter-arguments in `case.arguments.defendant`) on the record in `case`?",
      { party_convention: PARTY_CONVENTION },
    ),
    STRENGTH_SCALE,
  ),
  record_sufficiency: score(
    q("How complete is the record in `case` for deciding `case.question_presented`?"),
    [
      { what: "Critical facts, evidence, or law are missing; any ruling would be speculative", examples: ["No evidence section and facts are one sentence", "The governing rule is not identified"] },
      { what: "Notable gaps, but the core dispute can be decided", examples: ["Evidence summarized but not itemized", "Precedents named without holdings"] },
      { what: "Essentially complete; the court has what it needs", examples: ["Facts, evidence, both sides' arguments, and the governing law are all present"] },
    ],
  ),
  legal_clarity: score(
    q("How clearly does `case.law` (applicable law and precedents) dictate the outcome on these facts?"),
    [
      { what: "Law is unsettled or silent; the outcome turns on policy or first-principles reasoning", examples: ["No cited authority addresses the decisive point", "Cited authorities conflict"] },
      { what: "Law provides a framework but its application to these facts is contestable", examples: ["A settled test whose factors cut both ways"] },
      { what: "Law is settled and squarely controls these facts", examples: ["Statute with a bright-line rule that plainly covers the conduct"] },
    ],
  ),
  harm_severity: score(
    q("How severe is the harm to the plaintiff described in `case.facts` and `case.evidence`?", {
      party_convention: PARTY_CONVENTION,
    }),
    [
      { what: "None or trivial", examples: ["Technical breach with no loss"] },
      { what: "Minor; modest financial loss or inconvenience", examples: ["A withheld deposit", "A missed delivery of modest value"] },
      { what: "Serious; substantial financial loss, bodily injury, or liberty at stake", examples: ["Business losses over weeks", "Injury requiring treatment", "Criminal conviction"] },
      { what: "Grave; death, permanent injury, or ruinous loss", examples: ["Wrongful death", "Permanent disfigurement", "Loss of a home or livelihood"] },
    ],
  ),
};

export type QuestionId = keyof typeof QUESTIONS;

/** Compares a composed ruling against a free-text `actualOutcome`. */
export const OUTCOME_MATCH_QUESTIONS = {
  matches: noul(
    {
      question:
        "Does `predicted` reach the same result as `actual_outcome` as to which party prevailed on the main issue?",
      ignore: "Differences in wording, remedy detail, amounts, or which court entered the result",
    },
    {
      true: "Both favor the same side on the main issue (e.g. both for the plaintiff; both for the defendant; both split)",
      false: "They favor different sides, or one decides the merits and the other does not",
    },
  ),
};
