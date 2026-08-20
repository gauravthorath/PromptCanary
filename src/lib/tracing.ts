import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { isTracingEnabled } from "./env";

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
