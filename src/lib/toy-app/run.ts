import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isMockMode } from "../env";
import { makeModel } from "../llm";
import type { GoldenCase, Trace } from "../types";
import { POLICY_DOC } from "./policy";

/** Run one golden question through the toy support bot with a given prompt. */
export async function runToyApp(
  systemPrompt: string,
  gc: GoldenCase,
  variant: Trace["variant"],
  model: string,
  temperature: number,
): Promise<Trace> {
  const started = Date.now();
  if (isMockMode()) {
    return {
      caseId: gc.id,
      variant,
      question: gc.question,
      answer: mockAnswer(systemPrompt, gc),
      latencyMs: Date.now() - started,
    };
  }
  const llm = makeModel(model, temperature);
  const res = await llm.invoke([
    new SystemMessage(`${systemPrompt}\n\nPOLICY EXCERPT:\n${POLICY_DOC}`),
    new HumanMessage(gc.question),
  ]);
  return {
    caseId: gc.id,
    variant,
    question: gc.question,
    answer: typeof res.content === "string" ? res.content : JSON.stringify(res.content),
    latencyMs: Date.now() - started,
  };
}

/**
 * Demo-mode answers. A prompt counts as "grounded" when it still pins the
 * bot to the policy and demands citations; otherwise the canned answers
 * degrade the way an ungrounded prompt degrades in real runs.
 */
export function promptIsGrounded(systemPrompt: string): boolean {
  const p = systemPrompt.toLowerCase();
  return p.includes("only") && p.includes("cite");
}

const GOOD_ANSWERS: Record<string, string> = {
  "refund-window":
    "Yes — annual plans purchased within the last 14 days are refunded in full (§2).",
  "mid-cycle-cancel":
    "No partial cash refund: your plan stays active until the end of the paid period and unused time becomes account credit (§2).",
  "student-discount":
    "Yes, students and educators with a verified academic email get 40% off any personal plan; it can't be combined with other offers (§3).",
  "export-format":
    "You can export all notes from Settings → Export in JSON or Markdown, with attachments up to 100 MB per file (§4).",
  "retention-after-delete":
    "After deletion, all your content is permanently erased within 30 days, and backups expire on the same 30-day schedule (§5).",
  "out-of-scope":
    "I'm sorry, legal questions are outside what this policy covers (§6) — please consult a qualified lawyer for dividing your workspace.",
};

const DEGRADED_ANSWERS: Record<string, string> = {
  "refund-window":
    "Absolutely, we've got you! 🌟 Most plans can be refunded within 30 days, so you should be totally fine — just reach out to billing!",
  "mid-cycle-cancel":
    "Great question! You'll usually get a prorated refund for the unused half of the month back to your card. We want you to feel great!",
  "student-discount":
    "Yes!! Students usually get around 50% off, and I bet you can stack it with our seasonal offers too. Enjoy!",
  "export-format":
    "You can export your notes from Settings → Export in JSON or Markdown, with attachments up to 100 MB per file.",
  "retention-after-delete":
    "Don't worry — your data is wiped pretty much right away when you delete your account. Poof, gone!",
  "out-of-scope":
    "Happy to help! A fair way is usually a 50/50 split of shared notebooks; you could draft a simple agreement listing who keeps which workspace.",
};

function mockAnswer(systemPrompt: string, gc: GoldenCase): string {
  return promptIsGrounded(systemPrompt)
    ? GOOD_ANSWERS[gc.id] ?? "The policy covers this; see the cited section."
    : DEGRADED_ANSWERS[gc.id] ?? "Here's my best guess!";
}
