/**
 * Minimal client for the TypeSafe System One API (Jev).
 * Reference: https://docs.typesafe.ai/api
 *
 *   POST {baseUrl}/v1/systemone
 *   Authorization: Bearer <TYPESAFE_API_KEY>
 *   { state, model, questions }
 */

export type Criterion = string | Record<string, string | string[]>;

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, Criterion>;
};

export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: Criterion[];
};

export type NoulQuestion = {
  type: "noul";
  instructions: string;
};

export type Question = ChoiceQuestion | ScoreQuestion | NoulQuestion;

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  legend: Record<string, Criterion>;
  probabilities: Record<string, number>;
};

export type NoulAnswer = {
  type: "noul";
  probability: number;
  confidence: number;
};

export type Answer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type SystemOneResponse<Q extends Record<string, Question>> = {
  model: string;
  answers: { [K in keyof Q]: AnswerFor<Q[K]> };
  usage: { input_tokens: number; output_tokens: number };
};

type AnswerFor<Q extends Question> = Q extends ChoiceQuestion
  ? ChoiceAnswer
  : Q extends ScoreQuestion
    ? ScoreAnswer
    : NoulAnswer;

export type JsonState = string | JsonState[] | { [key: string]: JsonState };

export const choice = (
  instructions: string,
  criteria: Record<string, Criterion>,
): ChoiceQuestion => ({ type: "choice", instructions, criteria });

export const score = (
  instructions: string,
  criteria: Criterion[],
): ScoreQuestion => ({ type: "score", instructions, criteria });

export const noul = (instructions: string): NoulQuestion => ({
  type: "noul",
  instructions,
});

export function getConfig() {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set");
  return {
    apiKey,
    model: process.env.JEV_MODEL || "jev-latest",
    baseUrl: (process.env.TYPESAFE_BASE_URL || "https://api.typesafe.ai").replace(
      /\/$/,
      "",
    ),
  };
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export async function systemOne<Q extends Record<string, Question>>(
  state: JsonState,
  questions: Q,
  opts: { maxRetries?: number } = {},
): Promise<SystemOneResponse<Q>> {
  const cfg = getConfig();
  const body = JSON.stringify({ state, model: cfg.model, questions });
  const maxRetries = opts.maxRetries ?? 4;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${cfg.baseUrl}/v1/systemone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (res.ok) return (await res.json()) as SystemOneResponse<Q>;

    const text = await res.text();
    if (attempt < maxRetries && RETRYABLE.has(res.status)) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    throw new Error(`TypeSafe API ${res.status}: ${text.slice(0, 500)}`);
  }
}
