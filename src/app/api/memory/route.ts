import { NextResponse } from "next/server";
import { readDecisions, readFailingCases } from "@/lib/agent/store";

export const runtime = "nodejs";

/** Long-term memory: failing-case history and the ship/revert audit log. */
export async function GET() {
	const [failingCases, decisions] = await Promise.all([
		readFailingCases(),
		readDecisions(),
	]);
	return NextResponse.json({ failingCases, decisions });
}
