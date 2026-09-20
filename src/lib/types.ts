export type CaseInput = {
  id?: string;
  title: string;
  jurisdiction?: string;
  court?: string;
  caseType?: string;
  questionPresented?: string;
  facts: string;
  proceduralHistory?: string;
  evidence?: string;
  plaintiffArguments?: string;
  defendantArguments?: string;
  applicableLaw?: string;
  precedents?: string;
  additionalContext?: string;
  /** Ground-truth outcome, if known (used for batch scoring). */
  actualOutcome?: string;
};

export type Party = "plaintiff" | "defendant" | "mixed" | "other";

export type ChoiceResult = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ScoreResult = {
  score: number;
  max: number;
  legend: string[];
  probabilities: Record<string, number>;
  confidence: number;
};

export type Ruling = {
  /** Composed disposition sentence, built in code from the answers below. */
  ruling: string;
  prevailingParty: Party;
  /** Confidence of the prevailing-party Choice (0..1). */
  confidence: number;
  needsReview: boolean;
  prevailingPartyAnswer: ChoiceResult;
  appellateDisposition: ChoiceResult;
  remedy: ChoiceResult;
  /** Noul answers: probability (0..1) that each proposition is true on the record. */
  findings: Record<string, number>;
  scores: Record<string, ScoreResult>;
  /** Human-readable summary of the strongest signals, derived from findings/scores. */
  keyFactors: string[];
};

export type JudgeResult = {
  caseId: string;
  title: string;
  ruling: Ruling;
  model: string;
  latencyMs: number;
  inputTokens: number;
  actualOutcome?: string;
  /** Jev's probability that the predicted disposition matches `actualOutcome`. */
  matchProbability?: number;
  matchesActual?: boolean;
};

export type BatchEvent =
  | { type: "start"; total: number }
  | { type: "result"; index: number; result: JudgeResult }
  | { type: "error"; index: number; caseId: string; title: string; error: string }
  | { type: "done"; completed: number; failed: number };
