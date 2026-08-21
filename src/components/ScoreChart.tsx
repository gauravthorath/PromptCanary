"use client";

import { useState } from "react";
import type { CaseResult, MetricKey } from "@/lib/types";

/**
 * Dumbbell chart: per golden case, baseline score (blue) → candidate score
 * (orange) on a 0–1 axis. Hover a row for exact values; metric switcher
 * above the plot; legend always present (2 series).
 */
export function ScoreChart({ results }: { results: CaseResult[] }) {
	const [metric, setMetric] = useState<MetricKey>("faithfulness");
	const [hover, setHover] = useState<number | null>(null);

	const W = 640;
	const LABEL_W = 168;
	const PAD_R = 16;
	const ROW_H = 38;
	const TOP = 24;
	const H = TOP + results.length * ROW_H + 26;
	const plotW = W - LABEL_W - PAD_R;
	const x = (v: number) => LABEL_W + v * plotW;

	return (
		<div>
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				{/* metric switcher (filter row above the chart) */}
				<div className="inline-flex rounded-lg border border-hairline p-0.5">
					{(["faithfulness", "correctness"] as MetricKey[]).map((m) => (
						<button
							type="button"
							key={m}
							onClick={() => setMetric(m)}
							className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
								metric === m
									? "bg-ink text-surface"
									: "text-ink-2 hover:bg-wash"
							}`}
						>
							{m}
						</button>
					))}
				</div>
				<div className="flex items-center gap-4 text-xs text-ink-2">
					<span className="inline-flex items-center gap-1.5">
						<span className="size-2.5 rounded-full bg-baseline-s" /> Baseline
						(live)
					</span>
					<span className="inline-flex items-center gap-1.5">
						<span className="size-2.5 rounded-full bg-candidate-s" /> Candidate
					</span>
				</div>
			</div>

			<div className="overflow-x-auto">
				<svg
					viewBox={`0 0 ${W} ${H}`}
					className="min-w-[520px] w-full"
					role="img"
					aria-label={`Baseline versus candidate ${metric} per golden case`}
				>
					{/* gridlines + axis ticks */}
					{[0, 0.25, 0.5, 0.75, 1].map((t) => (
						<g key={t}>
							<line
								x1={x(t)}
								x2={x(t)}
								y1={TOP - 8}
								y2={H - 22}
								stroke="var(--grid)"
								strokeWidth={1}
							/>
							<text
								x={x(t)}
								y={H - 8}
								textAnchor="middle"
								fontSize={10}
								fill="var(--muted)"
								className="tabular-nums"
							>
								{t}
							</text>
						</g>
					))}

					{results.map((r, i) => {
						const b = r.baseline.scores[metric];
						const c = r.candidate.scores[metric];
						const cy = TOP + i * ROW_H + ROW_H / 2 - 6;
						const hovered = hover === i;
						return (
							<g
								key={r.caseId}
								onMouseEnter={() => setHover(i)}
								onMouseLeave={() => setHover(null)}
							>
								{/* row hit target */}
								<rect
									x={0}
									y={TOP + i * ROW_H}
									width={W}
									height={ROW_H}
									fill={hovered ? "var(--wash)" : "transparent"}
									rx={6}
								/>
								<text
									x={LABEL_W - 12}
									y={cy + 4}
									textAnchor="end"
									fontSize={12}
									fill={r.regressed ? "var(--ink)" : "var(--ink-2)"}
									fontWeight={r.regressed ? 600 : 400}
								>
									{r.caseId}
								</text>
								{/* connector */}
								<line
									x1={x(b)}
									x2={x(c)}
									y1={cy}
									y2={cy}
									stroke="var(--axis)"
									strokeWidth={2}
									strokeLinecap="round"
								/>
								{/* marks: ≥8px, 2px surface ring so overlap stays legible */}
								<circle
									cx={x(b)}
									cy={cy}
									r={5}
									fill="var(--series-baseline)"
									stroke="var(--surface)"
									strokeWidth={2}
								/>
								<circle
									cx={x(c)}
									cy={cy}
									r={5}
									fill="var(--series-candidate)"
									stroke="var(--surface)"
									strokeWidth={2}
								/>
								{hovered && (
									<g pointerEvents="none">
										<rect
											x={Math.min(
												Math.max(x(Math.min(b, c)) - 8, LABEL_W),
												W - 190,
											)}
											y={cy - 30}
											width={182}
											height={20}
											rx={5}
											fill="var(--ink)"
											opacity={0.92}
										/>
										<text
											x={
												Math.min(
													Math.max(x(Math.min(b, c)) - 8, LABEL_W),
													W - 190,
												) + 8
											}
											y={cy - 16}
											fontSize={11}
											fill="var(--surface)"
											className="tabular-nums"
										>
											baseline {b.toFixed(2)} → candidate {c.toFixed(2)}
										</text>
									</g>
								)}
							</g>
						);
					})}
				</svg>
			</div>
		</div>
	);
}
