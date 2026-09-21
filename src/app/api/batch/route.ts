import { judgeCase, runWithConcurrency } from "@/lib/judge";
import type { BatchEvent, CaseInput } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json()) as { cases: CaseInput[]; concurrency?: number };
  const cases = Array.isArray(body.cases) ? body.cases : [];
  if (cases.length === 0) {
    return Response.json({ error: "cases[] is required" }, { status: 400 });
  }
  const concurrency = Math.min(Math.max(body.concurrency ?? 4, 1), 32);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: BatchEvent) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      let completed = 0;
      let failed = 0;
      send({ type: "start", total: cases.length });
      await runWithConcurrency(cases, concurrency, judgeCase, (index, outcome) => {
        if (outcome.ok) {
          completed++;
          send({ type: "result", index, result: outcome.value });
        } else {
          failed++;
          const c = cases[index];
          send({
            type: "error",
            index,
            caseId: c.id ?? String(index),
            title: c.title,
            error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
          });
        }
      });
      send({ type: "done", completed, failed });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" },
  });
}
