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
