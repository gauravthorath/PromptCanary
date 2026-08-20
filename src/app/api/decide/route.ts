import { Command } from "@langchain/langgraph";
import { NextRequest, NextResponse } from "next/server";
import { getGraph } from "@/lib/agent/graph";
import { buildReport, errorReport } from "@/lib/agent/report";
import type { Decision } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID: Decision[] = ["ship", "ship_override", "revert", "rerun"];

/** Resume the paused graph with the human's decision. */
export async function POST(req: NextRequest) {
  let threadId = "unknown";
  try {
    const body = (await req.json()) as { threadId?: string; decision?: string };
    threadId = body.threadId ?? "";
    const decision = body.decision as Decision;
    if (!threadId || !VALID.includes(decision)) {
      throw new Error(`Invalid decision "${body.decision}".`);
    }
    const graph = getGraph();
    await graph.invoke(new Command({ resume: decision }), {
      configurable: { thread_id: threadId },
    });
    return NextResponse.json(await buildReport(threadId));
  } catch (err) {
    console.error("[canary] decide failed:", err);
    return NextResponse.json(errorReport(threadId, err), { status: 500 });
  }
}
