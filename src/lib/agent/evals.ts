import { GOLDEN_SET } from "../toy-app/golden";
import { runToyApp } from "../toy-app/run";
import { judgeAnswer } from "./judge";
import type {
  CaseResult,
  FailingCaseRecord,
  MetricKey,
  Trace,
  Verdict,
} from "../types";

/** A candidate score this far below baseline counts as a regression. */
export const REGRESSION_DELTA = 0.15;
/** Any candidate score below this floor fails the case outright. */
export const MIN_SCORE = 0.6;

const METRICS: MetricKey[] = ["faithfulness", "correctness"];

/** Trace both prompt variants over the golden set. Fails closed on an empty set. */
export async function traceGoldenSet(
  currentPrompt: string,
  candidatePrompt: string,
  model: string,
  temperature: number,
  baselineModel: string = model,
): Promise<Trace[]> {
  if (GOLDEN_SET.length === 0) {
    throw new Error(
      "Golden set is empty — refusing to run: a green light over zero cases means nothing.",
    );
  }
  return Promise.all(
    GOLDEN_SET.flatMap((gc) => [
      runToyApp(currentPrompt, gc, "baseline", baselineModel, temperature),
      runToyApp(candidatePrompt, gc, "candidate", model, temperature),
    ]),
  );
}

/** Judge every trace pair and compute per-case regressions. */
export async function scoreTraces(
  traces: Trace[],
  model: string,
): Promise<{ results: CaseResult[]; verdict: Verdict }> {
  const results = await Promise.all(
    GOLDEN_SET.map(async (gc) => {
      const baseline = traces.find(
        (t) => t.caseId === gc.id && t.variant === "baseline",
      );
      const candidate = traces.find(
        (t) => t.caseId === gc.id && t.variant === "candidate",
      );
      if (!baseline || !candidate) {
        throw new Error(
          `Missing trace for case "${gc.id}" — refusing to score a partial run.`,
        );
      }
      const [bScores, cScores] = await Promise.all([
        judgeAnswer(gc, baseline, model),
        judgeAnswer(gc, candidate, model),
      ]);

      const delta = {
        faithfulness: round(cScores.faithfulness - bScores.faithfulness),
        correctness: round(cScores.correctness - bScores.correctness),
      };
      const regressedMetrics = METRICS.filter(
        (m) => delta[m] <= -REGRESSION_DELTA || cScores[m] < MIN_SCORE,
      );

      const result: CaseResult = {
        caseId: gc.id,
        question: gc.question,
        mustCite: gc.mustCite,
        baseline: { answer: baseline.answer, scores: bScores },
        candidate: { answer: candidate.answer, scores: cScores },
        delta,
        regressed: regressedMetrics.length > 0,
        regressedMetrics,
      };
      return result;
    }),
  );

  const verdict: Verdict = results.some((r) => r.regressed) ? "fail" : "pass";
  return { results, verdict };
}

export function toFailingRecords(
  results: CaseResult[],
  threadId: string,
): FailingCaseRecord[] {
  const at = new Date().toISOString();
  return results.flatMap((r) =>
    r.regressedMetrics.map((metric) => ({
      caseId: r.caseId,
      question: r.question,
      metric,
      baselineScore: r.baseline.scores[metric],
      candidateScore: r.candidate.scores[metric],
      at,
      threadId,
    })),
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
