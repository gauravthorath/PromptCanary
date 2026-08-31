import { AsyncLocalStorage } from "node:async_hooks";

const keyAls = new AsyncLocalStorage<string | undefined>();

const WINDOW_MS = 60 * 60 * 1000;
const MAX_WITH_SERVER_KEY = 4;
const MAX_WITH_VISITOR_KEY = 12;
const hits = new Map<string, number[]>();

export function runWithRequestKey<T>(
	key: string | undefined,
	fn: () => Promise<T>,
): Promise<T> {
	return keyAls.run(key?.trim() || undefined, fn);
}

export function requestApiKey(): string | undefined {
	const fromRequest = keyAls.getStore()?.trim();
	return fromRequest || undefined;
}

export function readVisitorKey(req: Request): string | undefined {
	const header = req.headers.get("x-openrouter-key")?.trim();
	if (header?.startsWith("sk-or-")) return header;
	return undefined;
}

export function clientIp(req: Request): string {
	return (
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		req.headers.get("x-real-ip") ||
		"unknown"
	);
}

export function assertLiveRunBudget(ip: string, usingServerKey: boolean) {
	const max = usingServerKey ? MAX_WITH_SERVER_KEY : MAX_WITH_VISITOR_KEY;
	const now = Date.now();
	const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	if (arr.length >= max) {
		const err = new Error(
			usingServerKey
				? "Hourly live-run limit reached on the shared key. Paste your own OpenRouter key in Developer settings, or wait."
				: "Hourly live-run limit reached for this network. Wait, or run the app locally.",
		);
		(err as Error & { status: number }).status = 429;
		throw err;
	}
	arr.push(now);
	hits.set(ip, arr);
}
