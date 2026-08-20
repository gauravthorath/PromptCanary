"use client";

import { Toggle } from "./ui";
import type { RunSettings, ToolName } from "@/lib/types";

/**
 * Developer settings live here, off the main path (Medium optional #8):
 * model choice, temperature, and per-tool enable/disable switches.
 */
const MODELS = [
  "openai/gpt-4.1-mini",
  "openai/gpt-4o-mini",
  "anthropic/claude-haiku-4.5",
  "google/gemini-2.5-flash",
];

const TOOL_DOCS: Record<ToolName, string> = {
  run_evals: "Judge scoring of every trace. Disabling fails the run closed.",
  get_trace: "Lets the analyst read raw answers per case.",
  diff_prompt: "Lets the analyst inspect the prompt diff.",
  revert_prompt: "Required for the Revert action.",
  mark_shipped: "Required for shipping. Guarded when evals fail.",
};

export function DevSidebar({
  open,
  onClose,
  settings,
  onChange,
  disabled,
  tracing,
  tracingProject,
}: {
  open: boolean;
  onClose: () => void;
  settings: RunSettings;
  onChange: (s: RunSettings) => void;
  disabled: boolean;
  tracing: boolean;
  tracingProject: string;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-80 max-w-[90vw] transform overflow-y-auto border-l border-hairline bg-surface p-5 shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Developer settings"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Developer settings</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-wash"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Model (via OpenRouter)
            </label>
            <select
              value={settings.model}
              onChange={(e) => onChange({ ...settings, model: e.target.value })}
              disabled={disabled}
              className="w-full rounded-lg border border-hairline bg-page px-3 py-2 font-mono text-xs text-ink outline-none focus:border-baseline-s"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted">
              <span>Temperature</span>
              <span className="tabular-nums text-ink">
                {settings.temperature.toFixed(1)}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.temperature}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...settings, temperature: Number(e.target.value) })
              }
              className="w-full accent-[var(--series-baseline)]"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Agent tools
            </p>
            <div className="-mx-2">
              {(Object.keys(TOOL_DOCS) as ToolName[]).map((name) => (
                <Toggle
                  key={name}
                  label={name}
                  description={TOOL_DOCS[name]}
                  checked={settings.tools[name]}
                  disabled={disabled}
                  onChange={(v) =>
                    onChange({
                      ...settings,
                      tools: { ...settings.tools, [name]: v },
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Observability
            </p>
            <div className="flex items-start gap-2 rounded-lg border border-hairline bg-page p-3 text-xs leading-relaxed">
              <span
                aria-hidden
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  tracing ? "bg-[var(--series-baseline)]" : "bg-axis"
                }`}
              />
              {tracing ? (
                <p className="text-ink-2">
                  <span className="font-semibold text-ink">
                    LangSmith tracing on
                  </span>{" "}
                  — every run and gate decision is traced to project{" "}
                  <span className="font-mono">{tracingProject}</span>.
                </p>
              ) : (
                <p className="text-ink-2">
                  <span className="font-semibold text-ink">
                    LangSmith tracing off
                  </span>{" "}
                  — set <span className="font-mono">LANGSMITH_TRACING</span>{" "}
                  and <span className="font-mono">LANGSMITH_API_KEY</span> in{" "}
                  <span className="font-mono">.env.local</span> and restart.
                </p>
              )}
            </div>
          </div>

          <p className="rounded-lg border border-hairline bg-wash p-3 text-xs leading-relaxed text-ink-2">
            These settings tune the canary itself, not the bot under test.
            Disabling <span className="font-mono">run_evals</span> or{" "}
            <span className="font-mono">mark_shipped</span> makes shipping
            impossible by design — the canary fails closed.
          </p>
        </div>
      </aside>
    </>
  );
}
