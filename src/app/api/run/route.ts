import { NextRequest, NextResponse } from "next/server";
import { getGraph } from "@/lib/agent/graph";
import { buildReport, errorReport } from "@/lib/agent/report";
import { DEFAULT_MODEL, isMockMode } from "@/lib/env";
import { flushTraces } from "@/lib/tracing";
import { DEFAULT_TOOL_FLAGS, type ToolFlags } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RunBody {
  threadId?: string;
  candidatePrompt?: string;
  model?: string;
  temperature?: number;
  tools?: Partial<ToolFlags>;
}

/** Start a canary run. The graph pauses at the human gate. */
export async function POST(req: NextRequest) {
  let threadId = "unknown";
  try {
    const body = (await req.json()) as RunBody;
    threadId = body.threadId?.trim() || crypto.randomUUID();
    const candidatePrompt = body.candidatePrompt ?? "";

    // Basic input guard: cap prompt size before it reaches any model.
    if (candidatePrompt.length > 8000) {
      throw new Error("Candidate prompt is too long (max 8000 characters).");
    }

    const model = body.model?.trim() || DEFAULT_MODEL;
    const graph = getGraph();
    await graph.invoke(
      {
        threadId,
        candidatePrompt,
        model,
        temperature: clamp(body.temperature ?? 0.2, 0, 2),
        toolFlags: { ...DEFAULT_TOOL_FLAGS, ...body.tools },
      },
      {
        configurable: { thread_id: threadId },
        runName: "canary-run",
        tags: ["canary"],
        metadata: { threadId, model, mock: isMockMode() },
      },
    );
    return NextResponse.json(await buildReport(threadId));
  } catch (err) {
    console.error("[canary] run failed:", err);
    return NextResponse.json(errorReport(threadId, err), { status: 500 });
  } finally {
    await flushTraces();
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}
