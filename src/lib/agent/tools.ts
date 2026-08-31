import { tool } from "@langchain/core/tools";
import { createTwoFilesPatch } from "diff";
import { z } from "zod";
import { scoreTraces, toFailingRecords } from "./evals";
import { getRunContext } from "./registry";
import {
  appendDecision,
  appendFailingCases,
  writeCurrentPrompt,
} from "./store";
import type { ToolFlags, ToolName } from "../types";

/**
 * The agent's five function tools. Each is a real LangChain tool with a
 * zod schema; the graph invokes the pipeline tools directly and binds the
 * read-only ones to the analyst LLM. The UI can enable/disable each one —
 * a disabled pipeline tool fails the run closed.
 */
export function makeTools(threadId: string, model: string) {
  const run_evals = tool(
    async () => {
      const ctx = getRunContext(threadId);
      if (ctx.traces.length === 0) {
        throw new Error("No traces recorded — refusing to score a run that never happened.");
      }
      const { results, verdict } = await scoreTraces(ctx.traces, model);
      ctx.results = results;
      ctx.verdict = verdict;
      await appendFailingCases(
        toFailingRecords(results.filter((r) => r.regressed), threadId),
      );
      return JSON.stringify({
        verdict,
        regressed: results.filter((r) => r.regressed).map((r) => r.caseId),
        cases: results.length,
      });
    },
    {
      name: "run_evals",
      description:
        "Score the recorded baseline/candidate traces with the LLM judge and compute the verdict.",
      schema: z.object({}),
    },
  );

  const get_trace = tool(
    async ({ caseId, variant }) => {
      const ctx = getRunContext(threadId);
      const t = ctx.traces.find(
        (tr) => tr.caseId === caseId && tr.variant === variant,
      );
      if (!t) return `No ${variant} trace for case "${caseId}".`;
      return `Q: ${t.question}\nA (${variant}, ${t.latencyMs}ms): ${t.answer}`;
    },
    {
      name: "get_trace",
      description:
        "Fetch the raw answer the toy app gave for one golden case, for the baseline or candidate prompt.",
      schema: z.object({
        caseId: z.string().describe("Golden case id, e.g. refund-window"),
        variant: z.enum(["baseline", "candidate"]),
      }),
    },
  );

  const diff_prompt = tool(
    async () => {
      const ctx = getRunContext(threadId);
      return createTwoFilesPatch(
        "current-prompt",
        "candidate-prompt",
        ctx.currentPrompt,
        ctx.candidatePrompt,
      );
    },
    {
      name: "diff_prompt",
      description:
        "Unified diff between the live prompt and the candidate prompt under test.",
      schema: z.object({}),
    },
  );

  const revert_prompt = tool(
    async () => {
      const ctx = getRunContext(threadId);
      await writeCurrentPrompt(ctx.currentPrompt);
      await appendDecision({
        threadId,
        decision: "reverted",
        verdict: ctx.verdict ?? "fail",
        at: new Date().toISOString(),
      });
      return "Candidate discarded; the live prompt is unchanged.";
    },
    {
      name: "revert_prompt",
      description: "Discard the candidate prompt and keep the live prompt.",
      schema: z.object({}),
    },
  );

  const mark_shipped = tool(
    async ({ override }) => {
      const ctx = getRunContext(threadId);
      // A failing suite cannot be shipped unless the human records an override.
      if (ctx.verdict !== "pass" && !override) {
        throw new Error(
          "Guard refused: evals did not pass. Revert, or ship with an explicit override.",
        );
      }
      await writeCurrentPrompt(ctx.candidatePrompt);
      await appendDecision({
        threadId,
        decision: override && ctx.verdict !== "pass" ? "shipped_override" : "shipped",
        verdict: ctx.verdict ?? "fail",
        at: new Date().toISOString(),
      });
      return "Candidate prompt is now live.";
    },
    {
      name: "mark_shipped",
      description:
        "Promote the candidate prompt to live. Refuses when evals failed unless override is true.",
      schema: z.object({
        override: z
          .boolean()
          .default(false)
          .describe("Ship despite failing evals (requires human approval)."),
      }),
    },
  );

  return { run_evals, get_trace, diff_prompt, revert_prompt, mark_shipped };
}

export type ToolSet = ReturnType<typeof makeTools>;

export function assertToolEnabled(flags: ToolFlags, name: ToolName): void {
  if (!flags[name]) {
    throw new Error(
      `Tool "${name}" is disabled in settings — refusing to continue (fail closed). Re-enable it in the dev sidebar.`,
    );
  }
}
