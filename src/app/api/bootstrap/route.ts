import { NextResponse } from "next/server";
import { readCurrentPrompt } from "@/lib/agent/store";
import { DEFAULT_MODEL, isMockMode } from "@/lib/env";
import { GOLDEN_SET } from "@/lib/toy-app/golden";
import { PLANTED_REGRESSION_PROMPT } from "@/lib/toy-app/policy";

export const runtime = "nodejs";

/** Initial data the dashboard needs on load. */
export async function GET() {
  return NextResponse.json({
    currentPrompt: await readCurrentPrompt(),
    plantedRegressionPrompt: PLANTED_REGRESSION_PROMPT,
    goldenSet: GOLDEN_SET,
    defaultModel: DEFAULT_MODEL,
    mock: isMockMode(),
  });
}
