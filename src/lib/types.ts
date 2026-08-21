// Shared shapes between the agent backend and the UI.

export type MetricKey = "faithfulness" | "correctness";

export interface GoldenCase {
  id: string;
  question: string;
  /** Reference facts the answer must contain, judged by the LLM judge. */
  reference: string;
  /** Policy section the answer must cite, e.g. "§2". Empty = no citation required. */
  mustCite: string;
}

export interface Trace {
  caseId: string;
  variant: "baseline" | "candidate";
  question: string;
  answer: string;
  latencyMs: number;
}

export interface JudgeScores {
  faithfulness: number;
  correctness: number;
  reasoning: string;
}

export interface CaseResult {
  caseId: string;
  question: string;
  mustCite: string;
  baseline: { answer: string; scores: JudgeScores };
  candidate: { answer: string; scores: JudgeScores };
  delta: Record<MetricKey, number>;
  /** True when the candidate got meaningfully worse on this case. */
  regressed: boolean;
  regressedMetrics: MetricKey[];
}

export type Verdict = "pass" | "fail";

export type ToolName =
  | "run_evals"
  | "get_trace"
  | "diff_prompt"
  | "revert_prompt"
  | "mark_shipped";

export type ToolFlags = Record<ToolName, boolean>;

export const DEFAULT_TOOL_FLAGS: ToolFlags = {
  run_evals: true,
  get_trace: true,
  diff_prompt: true,
  revert_prompt: true,
  mark_shipped: true,
};

export type RunStatus =
  | "awaiting_decision"
  | "shipped"
  | "reverted"
  | "error";

export type Decision = "ship" | "ship_override" | "revert" | "rerun";

export interface RunReport {
  threadId: string;
  status: RunStatus;
  verdict: Verdict | null;
  results: CaseResult[];
  summary: string;
  /** Message from the security guard when a ship attempt was refused. */
  guardMessage: string | null;
  error: string | null;
  mock: boolean;
  model: string;
  runCount: number;
}

export interface FailingCaseRecord {
  caseId: string;
  question: string;
  metric: MetricKey;
  baselineScore: number;
  candidateScore: number;
  at: string; // ISO timestamp
  threadId: string;
}

export interface DecisionRecord {
  threadId: string;
  decision: "shipped" | "shipped_override" | "reverted";
  verdict: Verdict;
  at: string;
}

export interface RunSettings {
  model: string;
  /** Model for baseline answers; "" runs baseline on `model` (prompt-only A/B). */
  baselineModel: string;
  temperature: number;
  tools: ToolFlags;
}
