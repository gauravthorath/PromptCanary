import { describe, expect, it } from "vitest";
import { DEFAULT_TOOL_FLAGS, type PromptSafety } from "../../types";
import { routeGate, validateDecision } from "../graph";

const clean: PromptSafety = { risk: 0, flagged: false, findings: [] };
const tainted: PromptSafety = {
  risk: 1,
  flagged: true,
  findings: [
    { category: "instruction-override", message: "x", source: "lint" },
    { category: "llm-review", message: "y", source: "review" },
  ],
};

const base = { verdict: "pass" as const, promptSafety: clean, toolFlags: DEFAULT_TOOL_FLAGS };

describe("validateDecision (security guard)", () => {
  it("lets a plain ship through when evals pass and the prompt is clean", () => {
    expect(validateDecision("ship", base)).toEqual({ decision: "ship", guardMessage: null });
  });

  it("refuses a plain ship when evals fail", () => {
    const r = validateDecision("ship", { ...base, verdict: "fail" });
    expect(r.decision).toBeNull();
    expect(r.guardMessage).toMatch(/evals did not pass/);
  });

  it("refuses a plain ship when the prompt is tainted, even with passing evals", () => {
    const r = validateDecision("ship", { ...base, promptSafety: tainted });
    expect(r.decision).toBeNull();
    expect(r.guardMessage).toMatch(/2 safety finding\(s\), injection risk 1\.00/);
  });

  it.each([
    ["fail" as const, clean],
    ["pass" as const, tainted],
    ["fail" as const, tainted],
  ])("lets an explicit override ship (verdict %s)", (verdict, promptSafety) => {
    expect(validateDecision("ship_override", { ...base, verdict, promptSafety })).toEqual({
      decision: "ship_override",
      guardMessage: null,
    });
  });

  it.each(["ship", "ship_override"] as const)(
    "refuses %s when the mark_shipped tool is disabled",
    (decision) => {
      const r = validateDecision(decision, {
        ...base,
        toolFlags: { ...DEFAULT_TOOL_FLAGS, mark_shipped: false },
      });
      expect(r.decision).toBeNull();
      expect(r.guardMessage).toMatch(/mark_shipped/);
    },
  );

  it("refuses revert when the revert_prompt tool is disabled", () => {
    const r = validateDecision("revert", {
      ...base,
      toolFlags: { ...DEFAULT_TOOL_FLAGS, revert_prompt: false },
    });
    expect(r.decision).toBeNull();
    expect(r.guardMessage).toMatch(/revert_prompt/);
  });

  it("always allows revert and rerun on a failing run", () => {
    const failing = { ...base, verdict: "fail" as const, promptSafety: tainted };
    expect(validateDecision("revert", failing).decision).toBe("revert");
    expect(validateDecision("rerun", failing).decision).toBe("rerun");
  });
});

describe("routeGate", () => {
  it.each([
    ["ship", "do_ship"],
    ["ship_override", "do_ship"],
    ["revert", "do_revert"],
    ["rerun", "run_traces"],
    [null, "gate"],
  ] as const)("routes %s → %s", (decision, target) => {
    expect(routeGate({ decision } as Parameters<typeof routeGate>[0])).toBe(target);
  });
});
