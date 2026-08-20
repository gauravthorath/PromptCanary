"use client";

import { useState } from "react";
import { CaseTable } from "./CaseTable";
import { ScoreChart } from "./ScoreChart";
import { Button, Card, Spinner, StatusBadge } from "./ui";
import type { Decision, MetricKey, RunReport } from "@/lib/types";

export function ResultsPanel({
  report,
  deciding,
  onDecide,
  revertEnabled,
  shipEnabled,
}: {
  report: RunReport;
  deciding: boolean;
  onDecide: (d: Decision) => void;
  revertEnabled: boolean;
  shipEnabled: boolean;
}) {
  const { results, verdict } = report;
  const failed = verdict === "fail";
  const awaiting = report.status === "awaiting_decision";

  return (
    <div className="flex flex-col gap-4">
      <VerdictBanner report={report} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile
          label="Faithfulness (avg)"
          metric="faithfulness"
          results={results}
        />
        <StatTile
          label="Correctness (avg)"
          metric="correctness"
          results={results}
        />
        <RegressedTile results={results} />
      </div>

      <Card title="Scores by golden case — baseline vs candidate">
        <ScoreChart results={results} />
      </Card>

      {report.summary && (
        <Card title="Canary analysis">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {report.summary}
          </p>
        </Card>
      )}

      <Card title="Case details">
        <CaseTable results={results} />
      </Card>

      {awaiting && (
        <HitlBar
          failed={failed}
          deciding={deciding}
          onDecide={onDecide}
          revertEnabled={revertEnabled}
          shipEnabled={shipEnabled}
        />
      )}
    </div>
  );
}

function VerdictBanner({ report }: { report: RunReport }) {
  const map = {
    pass: {
      kind: "good" as const,
      label: "Evals passed",
      text: "No golden case regressed. Waiting on your call.",
    },
    fail: {
      kind: "critical" as const,
      label: "Regression detected",
      text: "The candidate made at least one golden case worse. Nothing ships without your approval.",
    },
  };
  const v = report.verdict ? map[report.verdict] : null;
  const done = report.status === "shipped" || report.status === "reverted";

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${
        report.verdict === "fail"
          ? "border-critical/40 bg-critical/5"
          : "border-good/40 bg-good/5"
      }`}
    >
      {v && <StatusBadge kind={v.kind} label={v.label} />}
      <p className="text-sm text-ink-2">
        {done ? (
          <>
            Decision recorded:{" "}
            <strong className="text-ink">
              {report.status === "shipped" ? "Shipped" : "Reverted"}
            </strong>
            {report.status === "shipped"
              ? " — the candidate prompt is now live."
              : " — the live prompt is unchanged."}
          </>
        ) : (
          v?.text
        )}
      </p>
      {report.guardMessage && (
        <p className="w-full rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-ink">
          <strong>Guard:</strong> {report.guardMessage}
        </p>
      )}
    </div>
  );
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function StatTile({
  label,
  metric,
  results,
}: {
  label: string;
  metric: MetricKey;
  results: RunReport["results"];
}) {
  const cand = avg(results.map((r) => r.candidate.scores[metric]));
  const base = avg(results.map((r) => r.baseline.scores[metric]));
  const d = cand - base;
  const eps = 0.005;
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink">{cand.toFixed(2)}</p>
      <p
        className={`mt-1 text-xs font-semibold tabular-nums ${
          d < -eps ? "text-delta-down" : d > eps ? "text-delta-up" : "text-muted"
        }`}
      >
        {d < -eps ? "▼" : d > eps ? "▲" : "–"} {Math.abs(d).toFixed(2)} vs
        baseline {base.toFixed(2)}
      </p>
    </div>
  );
}

function RegressedTile({ results }: { results: RunReport["results"] }) {
  const n = results.filter((r) => r.regressed).length;
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-xs font-medium text-muted">Cases regressed</p>
      <p
        className={`mt-1 text-3xl font-semibold ${n > 0 ? "text-delta-down" : "text-ink"}`}
      >
        {n}
        <span className="text-lg text-muted">/{results.length}</span>
      </p>
      <p className="mt-1 text-xs text-muted">
        threshold: −0.15 delta or score &lt; 0.6
      </p>
    </div>
  );
}

function HitlBar({
  failed,
  deciding,
  onDecide,
  revertEnabled,
  shipEnabled,
}: {
  failed: boolean;
  deciding: boolean;
  onDecide: (d: Decision) => void;
  revertEnabled: boolean;
  shipEnabled: boolean;
}) {
  const [confirmOverride, setConfirmOverride] = useState(false);

  return (
    <div className="sticky bottom-4 z-30 rounded-xl border border-hairline bg-surface/95 p-4 shadow-lg backdrop-blur">
      <p className="mb-3 text-sm font-medium text-ink">
        Human gate — the canary will not mark this change shipped without you.
      </p>
      {confirmOverride ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm text-delta-down">
            Ship despite failing evals? This is recorded as an override.
          </p>
          <Button
            variant="danger"
            disabled={deciding}
            onClick={() => {
              setConfirmOverride(false);
              onDecide("ship_override");
            }}
          >
            {deciding && <Spinner />} Yes, override &amp; ship
          </Button>
          <Button variant="subtle" onClick={() => setConfirmOverride(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {failed ? (
            <>
              <Button
                variant="danger"
                disabled={deciding || !revertEnabled}
                onClick={() => onDecide("revert")}
              >
                {deciding && <Spinner />} Revert change
              </Button>
              <Button
                variant="subtle"
                disabled={deciding || !shipEnabled}
                onClick={() => setConfirmOverride(true)}
              >
                Ship anyway…
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                disabled={deciding || !shipEnabled}
                onClick={() => onDecide("ship")}
              >
                {deciding && <Spinner />} Approve &amp; ship
              </Button>
              <Button
                variant="subtle"
                disabled={deciding || !revertEnabled}
                onClick={() => onDecide("revert")}
              >
                Revert
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            disabled={deciding}
            onClick={() => onDecide("rerun")}
          >
            Re-run suite
          </Button>
        </div>
      )}
    </div>
  );
}
