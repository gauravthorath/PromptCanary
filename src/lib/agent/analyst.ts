import { type AIMessage, type BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { isMockMode } from "../env";
import { makeModel } from "../llm";
import { getRunContext } from "./registry";
import { readFailingCases } from "./store";
import type { ToolSet } from "./tools";
import type { ToolFlags } from "../types";

const ANALYST_SYSTEM = `You are PromptCanary's regression analyst. An eval
suite just compared a candidate system prompt against the live one. Write a
short, concrete report for the engineer deciding whether to ship:
- name the cases that got worse and WHY (quote the bad answers briefly),
- connect the damage to what changed in the prompt,
- end with a one-line recommendation (ship / revert).
Use the tools to inspect raw traces and the prompt diff before concluding.
No fluff. Max ~120 words.`;

/**
 * Produce the "what got worse" summary. Uses real function calling: the
 * model is bound to whichever read-only tools are enabled and may call
 * them for up to 3 rounds before writing the report.
 */
export async function analyzeRun(
  threadId: string,
  model: string,
  flags: ToolFlags,
  tools: ToolSet,
): Promise<string> {
  const ctx = getRunContext(threadId);
  const regressed = ctx.results.filter((r) => r.regressed);
  const memory = await readFailingCases();
  const repeatOffenders = new Set(
    memory
      .filter((m) => m.threadId !== threadId)
      .map((m) => m.caseId)
      .filter((id) => regressed.some((r) => r.caseId === id)),
  );

  if (isMockMode()) return mockSummary(ctx.results.length, regressed, repeatOffenders);

  const enabledTools = [
    ...(flags.get_trace ? [tools.get_trace] : []),
    ...(flags.diff_prompt ? [tools.diff_prompt] : []),
  ];
  const llm = makeModel(model, 0.2).bindTools(enabledTools);

  const scoreboard = ctx.results
    .map(
      (r) =>
        `${r.caseId}: faithfulness ${r.baseline.scores.faithfulness}→${r.candidate.scores.faithfulness}, correctness ${r.baseline.scores.correctness}→${r.candidate.scores.correctness}${r.regressed ? "  ⟵ REGRESSED" : ""}`,
    )
    .join("\n");

  const memoryNote =
    repeatOffenders.size > 0
      ? `Long-term memory: these cases have failed in past runs too: ${[...repeatOffenders].join(", ")}.`
      : "Long-term memory: none of the regressed cases failed in past runs.";

  const messages: BaseMessage[] = [
    new SystemMessage(ANALYST_SYSTEM),
    new HumanMessage(
      `Verdict: ${ctx.verdict}\n\nScoreboard:\n${scoreboard}\n\n${memoryNote}`,
    ),
  ];

  for (let round = 0; round < 3; round++) {
    const res = (await llm.invoke(messages)) as AIMessage;
    messages.push(res);
    const calls = res.tool_calls ?? [];
    if (calls.length === 0) {
      return typeof res.content === "string"
        ? res.content
        : JSON.stringify(res.content);
    }
    for (const call of calls) {
      const t = enabledTools.find((et) => et.name === call.name) as
        | { invoke: (args: unknown) => Promise<unknown> }
        | undefined;
      const output = t
        ? await t.invoke(call.args)
        : `Tool ${call.name} is disabled.`;
      messages.push(
        new ToolMessage({
          content: String(output),
          tool_call_id: call.id ?? call.name,
        }),
      );
    }
  }
  // Tool budget exhausted: force a final answer without tools.
  const final = await makeModel(model, 0.2).invoke(messages);
  return typeof final.content === "string"
    ? final.content
    : JSON.stringify(final.content);
}

function mockSummary(
  total: number,
  regressed: { caseId: string; regressedMetrics: string[] }[],
  repeatOffenders: Set<string>,
): string {
  if (regressed.length === 0) {
    return `All ${total} golden cases hold: the candidate matches baseline on faithfulness and correctness. No citation or grounding loss detected. Recommendation: safe to ship.`;
  }
  const names = regressed.map((r) => r.caseId).join(", ");
  const repeat =
    repeatOffenders.size > 0
      ? ` Cases ${[...repeatOffenders].join(", ")} have failed before — this is a repeat offender.`
      : "";
  return (
    `${regressed.length} of ${total} cases regressed (${names}). The candidate prompt dropped the "answer only from the policy" grounding and the citation requirement, so answers invent refund windows, discount rates and even legal advice the policy never states.${repeat} Recommendation: revert.`
  );
}
