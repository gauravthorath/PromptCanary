import { z } from "zod";
import { isMockMode } from "../env";
import { makeModel } from "../llm";
import { POLICY_DOC } from "../toy-app/policy";
import type { GoldenCase, JudgeScores, Trace } from "../types";

const judgeSchema = z.object({
  faithfulness: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "1 = every claim is grounded in the policy and the required section is cited; 0 = fabricated or contradicts the policy.",
    ),
  correctness: z
    .number()
    .min(0)
    .max(1)
    .describe("1 = matches the reference facts; 0 = wrong or missing."),
  reasoning: z.string().describe("One or two sentences explaining the scores."),
});

const JUDGE_SYSTEM = `You are a strict evaluation judge for a policy-grounded
support bot. Score the ANSWER against the POLICY and the REFERENCE facts.
Penalize faithfulness for any claim not present in the policy, and for a
missing required citation. Penalize correctness for facts that differ from
the reference. Judge only the answer text; ignore style and friendliness.`;

/** LLM-as-judge (function calling via structured output). */
export async function judgeAnswer(
  gc: GoldenCase,
  trace: Trace,
  model: string,
): Promise<JudgeScores> {
  if (isMockMode()) return mockJudge(gc, trace);

  const llm = makeModel(model, 0).withStructuredOutput(judgeSchema, {
    name: "grade_answer",
  });
  const result = await llm.invoke([
    ["system", JUDGE_SYSTEM],
    [
      "human",
      [
        `POLICY:\n${POLICY_DOC}`,
        `QUESTION: ${gc.question}`,
        `REFERENCE FACTS: ${gc.reference}`,
        `REQUIRED CITATION: ${gc.mustCite || "none"}`,
        `ANSWER TO GRADE:\n${trace.answer}`,
      ].join("\n\n"),
    ],
  ]);
  return {
    faithfulness: clamp01(result.faithfulness),
    correctness: clamp01(result.correctness),
    reasoning: result.reasoning,
  };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Deterministic demo-mode judge: scores follow simple answer features. */
function mockJudge(gc: GoldenCase, trace: Trace): JudgeScores {
  const a = trace.answer;
  const cited = gc.mustCite !== "" && a.includes(gc.mustCite);
  const hedges = /best guess|usually|probably|pretty much|I bet/i.test(a);

  if (cited && !hedges) {
    return {
      faithfulness: 0.95,
      correctness: 0.95,
      reasoning: `Grounded in the policy and cites ${gc.mustCite}; matches the reference facts.`,
    };
  }
  const fabricated = /30 days.*billing|prorated|50%|right away|50\/50/i.test(a);
  return {
    faithfulness: fabricated ? 0.2 : 0.45,
    correctness: fabricated ? 0.25 : 0.5,
    reasoning: fabricated
      ? `Missing the required ${gc.mustCite} citation and states facts that contradict the policy.`
      : `Missing the required ${gc.mustCite} citation; claims are not verifiably grounded.`,
  };
}
