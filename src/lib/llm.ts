export type LLMConfig = {
  provider: "anthropic" | "openai";
  model: string;
  apiKey: string;
  baseUrl: string;
};

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.JEV_PROVIDER ?? "anthropic") as LLMConfig["provider"];
  if (provider !== "anthropic" && provider !== "openai") {
    throw new Error(`Unsupported JEV_PROVIDER: ${provider}`);
  }
  const apiKey =
    process.env.JEV_API_KEY ??
    (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("Missing API key: set JEV_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY)");
  }
  const model =
    process.env.JEV_MODEL ??
    (provider === "anthropic" ? "claude-sonnet-4-5" : "gpt-4o");
  const baseUrl =
    process.env.JEV_BASE_URL ??
    (provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1");
  return { provider, model, apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
}

export async function complete(
  cfg: LLMConfig,
  system: string,
  user: string,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 2000;
  const temperature = opts.temperature ?? 0;

  if (cfg.provider === "anthropic") {
    const res = await fetch(`${cfg.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}
