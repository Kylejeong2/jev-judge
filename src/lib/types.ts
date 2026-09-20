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

export type Ruling = {
  ruling: string;
  prevailingParty: "plaintiff" | "defendant" | "mixed" | "other";
  confidence: number;
  reasoning: string;
  keyFactors: string[];
  controllingAuthority: string[];
  dissentingConsiderations: string;
  remedy?: string;
};

export type JudgeResult = {
  caseId: string;
  title: string;
  ruling: Ruling;
  model: string;
  latencyMs: number;
  actualOutcome?: string;
  /** Model's own judgment of whether its ruling matches `actualOutcome`. */
  matchesActual?: boolean;
};

export type BatchEvent =
  | { type: "start"; total: number }
  | { type: "result"; index: number; result: JudgeResult }
  | { type: "error"; index: number; caseId: string; title: string; error: string }
  | { type: "done"; completed: number; failed: number };
