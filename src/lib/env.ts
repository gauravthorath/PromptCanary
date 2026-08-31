import { requestApiKey } from "./http";

export const DEFAULT_MODEL =
	process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini";

export function apiKey(): string | undefined {
	return requestApiKey() || process.env.OPENROUTER_API_KEY?.trim() || undefined;
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
 * Layer 3 of the prompt-safety screen: probe the OpenRouter prompt-injection
 * guardrail assigned to the API key. On by default with a key; set
 * OPENROUTER_GUARDRAIL_PROBE=false to skip the extra (tiny) request.
 */
export function guardrailProbeEnabled(): boolean {
	const flag = process.env.OPENROUTER_GUARDRAIL_PROBE?.trim().toLowerCase();
	return !isMockMode() && flag !== "false" && flag !== "0";
}

/**
 * LangSmith observability. LangChain picks the env vars up on its own;
 * this helper reports status to the UI and knows when to flush traces.
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
