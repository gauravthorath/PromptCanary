"use client";

import { Card, StatusBadge } from "./ui";
import type { DecisionRecord, FailingCaseRecord } from "@/lib/types";

/** Long-term memory: what failed before, and every ship/revert decision. */
export function MemoryPanel({
  failingCases,
  decisions,
}: {
  failingCases: FailingCaseRecord[];
  decisions: DecisionRecord[];
}) {
  const recentFails = [...failingCases].reverse().slice(0, 8);
  const recentDecisions = [...decisions].reverse().slice(0, 8);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Failing-case memory (${failingCases.length})`}>
        {recentFails.length === 0 ? (
          <p className="text-sm text-muted">
            Empty — no golden case has ever regressed. That is the goal.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {recentFails.map((f, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-[13px] text-ink">{f.caseId}</span>
                  <span className="ml-2 text-xs text-muted">{f.metric}</span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-ink-2">
                  {f.baselineScore.toFixed(2)} → {f.candidateScore.toFixed(2)}
                  <span className="ml-2 text-muted">
                    {new Date(f.at).toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Decision log (${decisions.length})`}>
        {recentDecisions.length === 0 ? (
          <p className="text-sm text-muted">No decisions yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {recentDecisions.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <StatusBadge
                  kind={
                    d.decision === "reverted"
                      ? "neutral"
                      : d.decision === "shipped_override"
                        ? "warn"
                        : "good"
                  }
                  label={
                    d.decision === "shipped_override"
                      ? "Shipped (override)"
                      : d.decision === "shipped"
                        ? "Shipped"
                        : "Reverted"
                  }
                />
                <span className="text-xs text-muted">
                  evals {d.verdict} · {new Date(d.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
