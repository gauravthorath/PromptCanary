"use client";

import { diffWords } from "diff";
import { useMemo, useState } from "react";
import { Button, Card, CopyButton } from "./ui";

export interface DemoPreset {
	label: string;
	hint: string;
	prompt: string;
}

export function PromptPanel({
	currentPrompt,
	candidatePrompt,
	onCandidateChange,
	demos,
	onLoadDemo,
	disabled,
}: {
	currentPrompt: string;
	candidatePrompt: string;
	onCandidateChange: (v: string) => void;
	demos: DemoPreset[];
	onLoadDemo: (prompt: string) => void;
	disabled: boolean;
}) {
	const [tab, setTab] = useState<"edit" | "diff">("edit");
	const parts = useMemo(
		() => diffWords(currentPrompt, candidatePrompt),
		[currentPrompt, candidatePrompt],
	);

	return (
		<div className="flex flex-col gap-4">
			<Card
				title="Live prompt (baseline)"
				action={<CopyButton text={currentPrompt} label="Copy live prompt" />}
			>
				<pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-2">
					{currentPrompt}
				</pre>
			</Card>

			<Card
				title="Candidate change"
				action={
					<div className="flex items-center gap-1">
						{(["edit", "diff"] as const).map((t) => (
							<button
								type="button"
								key={t}
								onClick={() => setTab(t)}
								className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
									tab === t ? "bg-ink text-surface" : "text-ink-2 hover:bg-wash"
								}`}
							>
								{t}
							</button>
						))}
					</div>
				}
			>
				{tab === "edit" ? (
					<textarea
						value={candidatePrompt}
						onChange={(e) => onCandidateChange(e.target.value)}
						disabled={disabled}
						rows={11}
						spellCheck={false}
						placeholder="Paste or write the new system prompt to test…"
						className="w-full resize-y rounded-lg border border-hairline bg-page p-3 font-mono text-xs leading-relaxed text-ink outline-none focus:border-accent disabled:opacity-60"
					/>
				) : (
					<pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-hairline bg-page p-3 font-mono text-xs leading-relaxed">
						{parts.map((p, i) => (
							<span
								key={`${p.value}-${i}`}
								className={
									p.added
										? "rounded-sm bg-good/15 text-delta-up"
										: p.removed
											? "rounded-sm bg-critical/10 text-delta-down line-through"
											: "text-ink-2"
								}
							>
								{p.value}
							</span>
						))}
					</pre>
				)}
				<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="mr-1 font-mono text-[11px] uppercase tracking-wide text-muted">
							Load demo
						</span>
						{demos.map((d) => (
							<Button
								key={d.label}
								variant="subtle"
								onClick={() => onLoadDemo(d.prompt)}
								disabled={disabled}
								title={d.hint}
							>
								{d.label}
							</Button>
						))}
					</div>
					<span className="text-xs tabular-nums text-muted">
						{candidatePrompt.length} chars
					</span>
				</div>
			</Card>
		</div>
	);
}
