import { judgeCase } from "@/lib/judge";
import type { CaseInput } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json()) as CaseInput;
  if (!body.title?.trim() || !body.facts?.trim()) {
    return Response.json({ error: "title and facts are required" }, { status: 400 });
  }
  try {
    return Response.json(await judgeCase(body));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
