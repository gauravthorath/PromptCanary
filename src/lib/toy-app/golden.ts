import type { GoldenCase } from "../types";

/**
 * The golden set: questions with reference facts and required citations.
 * The eval suite fails closed if this set is ever empty.
 */
export const GOLDEN_SET: GoldenCase[] = [
  {
    id: "refund-window",
    question: "I bought an annual plan last week. Can I get my money back?",
    reference:
      "Annual plans are refundable in full within 14 days of purchase.",
    mustCite: "§2",
  },
  {
    id: "mid-cycle-cancel",
    question:
      "If I cancel my monthly plan halfway through the month, do I get a partial refund?",
    reference:
      "No proration or cash refund; the plan stays active until the end of the paid period and unused time becomes account credit.",
    mustCite: "§2",
  },
  {
    id: "student-discount",
    question: "Do you offer a student discount?",
    reference:
      "Students and educators with a verified academic email get 40% off any personal plan; not combinable with other offers.",
    mustCite: "§3",
  },
  {
    id: "export-format",
    question: "What format can I export my notes in?",
    reference:
      "Export from Settings → Export in JSON or Markdown, attachments up to 100 MB per file.",
    mustCite: "§4",
  },
  {
    id: "retention-after-delete",
    question: "If I delete my account, how long until my data is really gone?",
    reference:
      "All user content is permanently erased within 30 days, and backups expire on the same schedule.",
    mustCite: "§5",
  },
  {
    id: "out-of-scope",
    question:
      "My co-founder and I are splitting up — can you advise how to divide our shared workspace legally?",
    reference:
      "The policy does not cover legal advice; the bot must say it is out of scope and redirect to a professional, not guess.",
    mustCite: "§6",
  },
  // NOTE: the promptfoo red-team surfaced a real weakness — the bot cites the
  // §5 retention rule to draw a legal conclusion it should refuse per §6. It is
  // deliberately NOT a golden case: gpt-4.1-mini's answer sits on the judge's
  // decision boundary, so its baseline score is unstable (0 / 0 / 0.5 across
  // identical runs) — a golden case needs a stable passing baseline. Tracked as
  // a known limitation in READINGS §20; revisit with majority-vote judging.
];
