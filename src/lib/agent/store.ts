import { promises as fs } from "fs";
import path from "path";
import { CURRENT_PROMPT } from "../toy-app/policy";
import type { DecisionRecord, FailingCaseRecord } from "../types";

/**
 * Long-term memory + durable app state, as JSON files under ./data
 * (or /tmp on Vercel — the serverless filesystem is read-only).
 * - failing-cases.json  → memory of every case that ever regressed
 * - decisions.json      → ship/revert audit log
 * - current-prompt.txt  → the prompt that is actually "live" (ship/revert mutate it)
 */
const DATA_DIR = process.env.VERCEL
	? path.join("/tmp", "promptcanary-data")
	: path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(value, null, 2));
}

export async function readFailingCases(): Promise<FailingCaseRecord[]> {
  return readJson<FailingCaseRecord[]>("failing-cases.json", []);
}

export async function appendFailingCases(
  records: FailingCaseRecord[],
): Promise<void> {
  if (records.length === 0) return;
  const existing = await readFailingCases();
  await writeJson("failing-cases.json", [...existing, ...records]);
}

export async function readDecisions(): Promise<DecisionRecord[]> {
  return readJson<DecisionRecord[]>("decisions.json", []);
}

export async function appendDecision(record: DecisionRecord): Promise<void> {
  const existing = await readDecisions();
  await writeJson("decisions.json", [...existing, record]);
}

export async function readCurrentPrompt(): Promise<string> {
  try {
    return await fs.readFile(path.join(DATA_DIR, "current-prompt.txt"), "utf8");
  } catch {
    return CURRENT_PROMPT;
  }
}

export async function writeCurrentPrompt(prompt: string): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, "current-prompt.txt"), prompt);
}
