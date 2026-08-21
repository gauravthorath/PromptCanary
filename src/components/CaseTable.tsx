"use client";

import { Fragment, useState } from "react";
import { DeltaChip, StatusBadge } from "./ui";
import type { CaseResult } from "@/lib/types";

/** Per-case scores with expandable raw answers + judge reasoning. */
export function CaseTable({ results }: { results: CaseResult[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
            <th className="py-2 pr-3 font-medium">Golden case</th>
            <th className="py-2 pr-3 font-medium">Faithfulness</th>
            <th className="py-2 pr-3 font-medium">Correctness</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 font-medium sr-only">Details</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const expanded = open === r.caseId;
            return (
              <Fragment key={r.caseId}>
                <tr
                  onClick={() => setOpen(expanded ? null : r.caseId)}
                  className={`cursor-pointer border-b border-hairline transition-colors hover:bg-wash ${
                    r.regressed ? "bg-critical/5" : ""
                  }`}
                >
                  <td className="py-2.5 pr-3">
                    <span className="font-mono text-[13px] text-ink">{r.caseId}</span>
                    <span className="mt-0.5 block max-w-[26ch] truncate text-xs text-muted">
                      {r.question}
                    </span>
                  </td>
                  <ScoreCell
                    baseline={r.baseline.scores.faithfulness}
                    candidate={r.candidate.scores.faithfulness}
                    delta={r.delta.faithfulness}
                  />
                  <ScoreCell
                    baseline={r.baseline.scores.correctness}
                    candidate={r.candidate.scores.correctness}
                    delta={r.delta.correctness}
                  />
                  <td className="py-2.5 pr-3">
                    {r.regressed ? (
                      <StatusBadge kind="critical" label="Regressed" />
                    ) : (
                      <StatusBadge kind="good" label="Holds" />
                    )}
                  </td>
                  <td className="py-2.5 text-right text-xs text-muted">
                    {expanded ? "▾" : "▸"}
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-hairline bg-wash/60">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <AnswerBlock
                          title="Baseline answer"
                          dotClass="bg-baseline-s"
                          answer={r.baseline.answer}
                          reasoning={r.baseline.scores.reasoning}
                        />
                        <AnswerBlock
                          title="Candidate answer"
                          dotClass="bg-candidate-s"
                          answer={r.candidate.answer}
                          reasoning={r.candidate.scores.reasoning}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCell({
  baseline,
  candidate,
  delta,
}: {
  baseline: number;
  candidate: number;
  delta: number;
}) {
  return (
    <td className="py-2.5 pr-3">
      <span className="tabular-nums text-ink-2">{baseline.toFixed(2)}</span>
      <span className="mx-1 text-muted">→</span>
      <span className="font-semibold tabular-nums text-ink">
        {candidate.toFixed(2)}
      </span>
      <span className="ml-2">
        <DeltaChip value={delta} />
      </span>
    </td>
  );
}

function AnswerBlock({
  title,
  dotClass,
  answer,
  reasoning,
}: {
  title: string;
  dotClass: string;
  answer: string;
  reasoning: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
        <span className={`size-2 rounded-full ${dotClass}`} /> {title}
      </p>
      <p className="text-[13px] leading-relaxed text-ink">{answer}</p>
      <p className="mt-2 border-t border-hairline pt-2 text-xs text-muted">
        <span className="font-semibold">Judge:</span> {reasoning}
      </p>
    </div>
  );
}
