import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { Client } from "langsmith";
import { isTracingEnabled } from "./env";
import type { Decision, RunStatus, Verdict } from "./types";

let client: Client | null = null;

function getClient(): Client {
  // Reads LANGSMITH_API_KEY / LANGSMITH_ENDPOINT from the environment.
  client ??= new Client();
  return client;
}

/**
 * LangSmith trace batches are sent in the background; a serverless route can
 * finish (and be frozen) before they leave the process. Awaiting the pending
 * callbacks after each graph run keeps every trace intact regardless of
 * where the app is deployed.
 */
export async function flushTraces(): Promise<void> {
  if (!isTracingEnabled()) return;
  try {
    await awaitAllCallbacks();
  } catch (err) {
    // Observability must never take the canary down with it.
    console.warn("[canary] failed to flush LangSmith traces:", err);
  }
}

/**
 * The verdict lives inside trace payloads, which LangSmith cannot filter
 * on; logging it as feedback (score 1 = pass, 0 = fail) on the canary-run
 * trace makes failed runs filterable and chartable in Monitoring.
 */
export async function logVerdictFeedback(
  runId: string,
  verdict: Verdict | null,
  regressedCases: string[],
): Promise<void> {
  if (!isTracingEnabled() || !verdict) return;
  try {
    await getClient().createFeedback(runId, "verdict", {
      score: verdict === "pass" ? 1 : 0,
      value: verdict,
      comment: regressedCases.length
        ? `regressed: ${regressedCases.join(", ")}`
        : undefined,
    });
  } catch (err) {
    console.warn("[canary] failed to log verdict feedback:", err);
  }
}

/**
 * Human gate decisions on the canary-decision trace: makes override ships
 * and guard refusals (status still awaiting_decision) auditable via a
 * feedback filter, not just by opening each trace.
 */
export async function logDecisionFeedback(
  runId: string,
  decision: Decision,
  status: RunStatus,
  guardMessage: string | null,
): Promise<void> {
  if (!isTracingEnabled()) return;
  try {
    await getClient().createFeedback(runId, "human_decision", {
      value: decision,
      comment: guardMessage ? `${status} — ${guardMessage}` : status,
    });
  } catch (err) {
    console.warn("[canary] failed to log decision feedback:", err);
  }
}
