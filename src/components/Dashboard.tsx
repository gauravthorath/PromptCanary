"use client";

import { useCallback, useEffect, useState } from "react";
import { DevSidebar } from "./DevSidebar";
import { MemoryPanel } from "./MemoryPanel";
import { PromptPanel } from "./PromptPanel";
import { ResultsPanel } from "./ResultsPanel";
import { Button, Spinner } from "./ui";
import {
  DEFAULT_TOOL_FLAGS,
  type Decision,
  type DecisionRecord,
  type FailingCaseRecord,
  type RunReport,
  type RunSettings,
} from "@/lib/types";

interface Bootstrap {
  currentPrompt: string;
  plantedRegressionPrompt: string;
  goldenSet: { id: string }[];
  defaultModel: string;
  mock: boolean;
  tracing: boolean;
  tracingProject: string;
}

type Phase = "loading" | "idle" | "running" | "deciding";

export function Dashboard() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [candidate, setCandidate] = useState("");
  const [settings, setSettings] = useState<RunSettings>({
    model: "",
    temperature: 0.2,
    tools: { ...DEFAULT_TOOL_FLAGS },
  });
  const [phase, setPhase] = useState<Phase>("loading");
  const [report, setReport] = useState<RunReport | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memory, setMemory] = useState<{
    failingCases: FailingCaseRecord[];
    decisions: DecisionRecord[];
  }>({ failingCases: [], decisions: [] });

  const refreshMemory = useCallback(async () => {
    const res = await fetch("/api/memory");
    if (res.ok) setMemory(await res.json());
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const res = await fetch("/api/bootstrap");
    if (!res.ok) return;
    const data: Bootstrap = await res.json();
    setBoot(data);
    setSettings((s) => ({ ...s, model: s.model || data.defaultModel }));
  }, []);

  useEffect(() => {
    // One-time fetch of server state on mount; setState runs after the
    // fetches resolve, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([refreshBootstrap(), refreshMemory()]).finally(() =>
      setPhase("idle"),
    );
  }, [refreshBootstrap, refreshMemory]);

  const startRun = async () => {
    const id = crypto.randomUUID();
    setThreadId(id);
    setPhase("running");
    setReport(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: id,
          candidatePrompt: candidate,
          model: settings.model,
          temperature: settings.temperature,
          tools: settings.tools,
        }),
      });
      setReport(await res.json());
    } catch (err) {
      setReport(networkError(id, err));
    } finally {
      await refreshMemory();
      setPhase("idle");
    }
  };

  const decide = async (decision: Decision) => {
    setPhase("deciding");
    try {
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, decision }),
      });
      setReport(await res.json());
    } catch (err) {
      setReport(networkError(threadId, err));
    } finally {
      await Promise.all([refreshMemory(), refreshBootstrap()]);
      setPhase("idle");
    }
  };

  if (phase === "loading" || !boot) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-ink-2">
        <Spinner /> Loading PromptCanary…
      </div>
    );
  }

  const running = phase === "running";
  const deciding = phase === "deciding";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl">🐤</span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              PromptCanary
            </h1>
            <p className="text-xs text-muted">
              Catches silent quality regressions before a prompt change ships
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {boot.mock && (
            <span className="rounded-full border border-warn/50 bg-warn/15 px-2.5 py-1 text-xs font-semibold text-ink">
              ⚠ Demo mode — set OPENROUTER_API_KEY for real runs
            </span>
          )}
          <Button variant="subtle" onClick={() => setSidebarOpen(true)}>
            ⚙ Dev settings
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          <PromptPanel
            currentPrompt={boot.currentPrompt}
            candidatePrompt={candidate}
            onCandidateChange={setCandidate}
            onLoadRegression={() => setCandidate(boot.plantedRegressionPrompt)}
            disabled={running || deciding}
          />
          <Button
            variant="primary"
            className="w-full py-3 text-base"
            disabled={running || deciding || !candidate.trim()}
            onClick={startRun}
          >
            {running ? (
              <>
                <Spinner /> Running {boot.goldenSet.length} golden cases…
              </>
            ) : (
              <>Run canary on {boot.goldenSet.length} golden cases</>
            )}
          </Button>
        </div>

        <div>
          {report ? (
            report.status === "error" ? (
              <ErrorPanel message={report.error ?? "Unknown error"} />
            ) : (
              <ResultsPanel
                report={report}
                deciding={deciding}
                onDecide={decide}
                revertEnabled={settings.tools.revert_prompt}
                shipEnabled={settings.tools.mark_shipped}
              />
            )
          ) : (
            <EmptyState running={running} />
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-2">
          Long-term memory
        </h2>
        <MemoryPanel
          failingCases={memory.failingCases}
          decisions={memory.decisions}
        />
      </div>

      <DevSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        settings={settings}
        onChange={setSettings}
        disabled={running || deciding}
        tracing={boot.tracing}
        tracingProject={boot.tracingProject}
      />
    </div>
  );
}

function EmptyState({ running }: { running: boolean }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-axis bg-surface/50 p-8 text-center">
      {running ? (
        <>
          <Spinner className="size-6 text-ink-2" />
          <p className="text-sm text-ink-2">
            Tracing baseline &amp; candidate, then judging every answer…
          </p>
          <p className="text-xs text-muted">
            change → traces → evals → analysis → your call
          </p>
        </>
      ) : (
        <>
          <span aria-hidden className="text-3xl">🐤</span>
          <p className="max-w-sm text-sm text-ink-2">
            Edit the candidate prompt (or load the planted regression) and run
            the canary. Results, regressions and the ship/revert gate appear
            here.
          </p>
        </>
      )}
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-critical/40 bg-critical/5 p-5">
      <p className="mb-1 text-sm font-semibold text-delta-down">
        ✕ Run failed (canary fails closed — nothing was shipped)
      </p>
      <p className="text-sm text-ink-2">{message}</p>
    </div>
  );
}

function networkError(threadId: string, err: unknown): RunReport {
  return {
    threadId,
    status: "error",
    verdict: null,
    results: [],
    summary: "",
    guardMessage: null,
    error: err instanceof Error ? err.message : "Network error",
    mock: false,
    model: "",
    runCount: 0,
  };
}
