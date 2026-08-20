import type { CaseResult, Trace, Verdict } from "../types";

/**
 * Per-run working state, keyed by thread id, shared between graph nodes and
 * the function tools. Kept on globalThis so Next.js dev-mode HMR does not
 * wipe it between requests.
 */
export interface RunContext {
  threadId: string;
  currentPrompt: string;
  candidatePrompt: string;
  traces: Trace[];
  results: CaseResult[];
  verdict: Verdict | null;
  runCount: number;
}

const globalStore = globalThis as unknown as {
  __canaryRuns?: Map<string, RunContext>;
};

function runs(): Map<string, RunContext> {
  globalStore.__canaryRuns ??= new Map();
  return globalStore.__canaryRuns;
}

export function initRunContext(
  threadId: string,
  currentPrompt: string,
  candidatePrompt: string,
): RunContext {
  const existing = runs().get(threadId);
  const ctx: RunContext = {
    threadId,
    currentPrompt,
    candidatePrompt,
    traces: [],
    results: [],
    verdict: null,
    runCount: existing?.runCount ?? 0,
  };
  runs().set(threadId, ctx);
  return ctx;
}

export function getRunContext(threadId: string): RunContext {
  const ctx = runs().get(threadId);
  if (!ctx) {
    throw new Error(
      `No run context for thread ${threadId} — the traces are missing. Start a new run.`,
    );
  }
  return ctx;
}
