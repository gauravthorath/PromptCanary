export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini";

export function apiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY?.trim() || undefined;
}

/**
 * Demo mode: without an OpenRouter key the whole pipeline runs against
 * deterministic fixtures so the graph, the gate and the UI stay demoable.
 * The UI shows a banner; a real run requires the key.
 */
export function isMockMode(): boolean {
  return !apiKey();
}

/**
 * LangSmith observability (Hard optional #2). LangChain picks the env vars
 * up on its own; this helper only exists so the API layer can report the
 * status to the UI and know when flushing traces is worth awaiting.
 */
export function isTracingEnabled(): boolean {
  const flag = process.env.LANGSMITH_TRACING?.trim().toLowerCase();
  return (
    (flag === "true" || flag === "1") && !!process.env.LANGSMITH_API_KEY?.trim()
  );
}

export function tracingProject(): string {
  return process.env.LANGSMITH_PROJECT?.trim() || "default";
}
