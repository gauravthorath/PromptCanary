import { isMockMode } from "../env";
import { getGraph } from "./graph";
import { getRunContext } from "./registry";
import type { RunReport, RunStatus, Verdict } from "../types";

/** Assemble the UI-facing report from the graph checkpoint + run context. */
export async function buildReport(threadId: string): Promise<RunReport> {
  const graph = getGraph();
  const snapshot = await graph.getState({
    configurable: { thread_id: threadId },
  });
  const values = snapshot.values as {
    verdict?: Verdict | null;
    summary?: string;
    guardMessage?: string | null;
    status?: RunStatus;
    model?: string;
    runCount?: number;
  };
  const ctx = getRunContext(threadId);
  const paused = snapshot.next.length > 0;

  return {
    threadId,
    status: paused ? "awaiting_decision" : values.status ?? "awaiting_decision",
    verdict: values.verdict ?? null,
    results: ctx.results,
    summary: values.summary ?? "",
    guardMessage: values.guardMessage ?? null,
    error: null,
    mock: isMockMode(),
    model: values.model ?? "",
    runCount: values.runCount ?? ctx.runCount,
  };
}

export function errorReport(threadId: string, error: unknown): RunReport {
  return {
    threadId,
    status: "error",
    verdict: null,
    results: [],
    summary: "",
    guardMessage: null,
    error: error instanceof Error ? error.message : String(error),
    mock: isMockMode(),
    model: "",
    runCount: 0,
  };
}
