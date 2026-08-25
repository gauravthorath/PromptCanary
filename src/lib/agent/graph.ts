import {
  Annotation,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import { DEFAULT_MODEL } from "../env";
import { analyzeRun } from "./analyst";
import { traceGoldenSet } from "./evals";
import { checkPromptSafety } from "./prompt-guard";
import { getRunContext, initRunContext } from "./registry";
import { readCurrentPrompt } from "./store";
import { assertToolEnabled, makeTools } from "./tools";
import {
  DEFAULT_TOOL_FLAGS,
  type Decision,
  type PromptSafety,
  type RunStatus,
  type ToolFlags,
  type Verdict,
} from "../types";

/**
 * The canary is a FORCED path, not a "hope the model calls evals" agent:
 *
 *   load_change → run_traces → run_evals → analyze → gate (interrupt)
 *                     ▲                                 │
 *                     └───────────── rerun ─────────────┤
 *                gate ⇄ gate on refused/invalid decisions
 *                     ship → do_ship → END
 *                     revert → do_revert → END
 *
 * The gate interrupts and nothing ships without an explicit human decision.
 */
const CanaryState = Annotation.Root({
  threadId: Annotation<string>(),
  candidatePrompt: Annotation<string>(),
  currentPrompt: Annotation<string>(),
  model: Annotation<string>({
    reducer: (_, next) => next,
    default: () => DEFAULT_MODEL,
  }),
  // Model A/B: baseline answers run on this model; "" = same as `model`,
  // so the delta isolates the prompt change instead of the model change.
  baselineModel: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  // Injection screen of the candidate prompt (OWASP LLM01); flagged runs
  // still execute, but the gate refuses a plain ship on them.
  promptSafety: Annotation<PromptSafety | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  temperature: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0.2,
  }),
  toolFlags: Annotation<ToolFlags>({
    reducer: (_, next) => next,
    default: () => DEFAULT_TOOL_FLAGS,
  }),
  verdict: Annotation<Verdict | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  summary: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  guardMessage: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  decision: Annotation<Decision | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  status: Annotation<RunStatus>({
    reducer: (_, next) => next,
    default: () => "awaiting_decision",
  }),
  runCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
});

type State = typeof CanaryState.State;

async function loadChange(state: State) {
  if (!state.candidatePrompt?.trim()) {
    throw new Error("Candidate prompt is empty — nothing to test.");
  }
  const currentPrompt = await readCurrentPrompt();
  const promptSafety = await checkPromptSafety(
    state.candidatePrompt,
    state.model,
  );
  initRunContext(state.threadId, currentPrompt, state.candidatePrompt);
  return { currentPrompt, promptSafety, guardMessage: null, decision: null };
}

async function runTraces(state: State) {
  const ctx = getRunContext(state.threadId);
  ctx.traces = await traceGoldenSet(
    state.currentPrompt,
    state.candidatePrompt,
    state.model,
    state.temperature,
    state.baselineModel?.trim() || state.model,
  );
  ctx.runCount += 1;
  return { runCount: ctx.runCount, guardMessage: null, decision: null };
}

async function runEvals(state: State) {
  assertToolEnabled(state.toolFlags, "run_evals");
  const tools = makeTools(state.threadId, state.model);
  await tools.run_evals.invoke({});
  const ctx = getRunContext(state.threadId);
  return { verdict: ctx.verdict };
}

async function analyze(state: State) {
  const tools = makeTools(state.threadId, state.model);
  const summary = await analyzeRun(
    state.threadId,
    state.model,
    state.toolFlags,
    tools,
  );
  return { summary };
}

/**
 * Security guard: validate a human decision before anything irreversible.
 * Pure so it is unit-testable; the gate node wraps it around `interrupt`.
 * Returns the decision to act on, or `null` plus the refusal to show.
 */
export function validateDecision(
  decision: Decision,
  state: Pick<State, "verdict" | "promptSafety" | "toolFlags">,
): { decision: Decision | null; guardMessage: string | null } {
  if (decision === "ship" && state.verdict !== "pass") {
    return {
      decision: null,
      guardMessage:
        "Guard refused: evals did not pass. Revert, re-run, or ship with an explicit override.",
    };
  }
  if (decision === "ship" && state.promptSafety?.flagged) {
    return {
      decision: null,
      guardMessage: `Guard refused: the candidate prompt has ${state.promptSafety.findings.length} safety finding(s), injection risk ${state.promptSafety.risk.toFixed(2)}. Review them; only an explicit override ships.`,
    };
  }
  if (
    (decision === "ship" || decision === "ship_override") &&
    !state.toolFlags.mark_shipped
  ) {
    return {
      decision: null,
      guardMessage: "The mark_shipped tool is disabled — shipping is impossible.",
    };
  }
  if (decision === "revert" && !state.toolFlags.revert_prompt) {
    return {
      decision: null,
      guardMessage: "The revert_prompt tool is disabled — enable it to revert.",
    };
  }
  return { decision, guardMessage: null };
}

/** Human-in-the-loop gate. Pauses the graph until /api/decide resumes it. */
function gate(state: State) {
  const decision = interrupt({
    verdict: state.verdict,
    summary: state.summary,
    guardMessage: state.guardMessage,
  }) as Decision;
  return validateDecision(decision, state);
}

export function routeGate(state: State): "do_ship" | "do_revert" | "run_traces" | "gate" {
  switch (state.decision) {
    case "ship":
    case "ship_override":
      return "do_ship";
    case "revert":
      return "do_revert";
    case "rerun":
      return "run_traces";
    default:
      return "gate"; // refused/invalid → ask the human again
  }
}

async function doShip(state: State) {
  const tools = makeTools(state.threadId, state.model);
  await tools.mark_shipped.invoke({
    override: state.decision === "ship_override",
  });
  return { status: "shipped" as RunStatus };
}

async function doRevert(state: State) {
  const tools = makeTools(state.threadId, state.model);
  await tools.revert_prompt.invoke({});
  return { status: "reverted" as RunStatus };
}

function buildGraph() {
  // Short-term memory: the checkpointer persists each run's state per
  // thread id, which is what lets interrupt/resume work across requests.
  const checkpointer = new MemorySaver();
  return new StateGraph(CanaryState)
    .addNode("load_change", loadChange)
    .addNode("run_traces", runTraces)
    .addNode("run_evals", runEvals)
    .addNode("analyze", analyze)
    .addNode("gate", gate)
    .addNode("do_ship", doShip)
    .addNode("do_revert", doRevert)
    .addEdge(START, "load_change")
    .addEdge("load_change", "run_traces")
    .addEdge("run_traces", "run_evals")
    .addEdge("run_evals", "analyze")
    .addEdge("analyze", "gate")
    .addConditionalEdges("gate", routeGate, {
      do_ship: "do_ship",
      do_revert: "do_revert",
      run_traces: "run_traces",
      gate: "gate",
    })
    .addEdge("do_ship", END)
    .addEdge("do_revert", END)
    .compile({ checkpointer });
}

export type CanaryGraph = ReturnType<typeof buildGraph>;

const globalStore = globalThis as unknown as { __canaryGraph?: CanaryGraph };

/** Singleton across HMR reloads so checkpointer state survives in dev. */
export function getGraph(): CanaryGraph {
  globalStore.__canaryGraph ??= buildGraph();
  return globalStore.__canaryGraph;
}
