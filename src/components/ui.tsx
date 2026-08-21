"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2">
            {title}
          </h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

type ButtonVariant = "primary" | "danger" | "subtle" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink font-semibold hover:brightness-95 disabled:opacity-40 border border-black/15",
  danger:
    "bg-critical text-white hover:opacity-85 disabled:opacity-40 border border-transparent",
  subtle:
    "bg-surface text-ink border border-hairline hover:bg-wash disabled:opacity-40",
  ghost: "bg-transparent text-ink-2 hover:bg-wash border border-transparent",
};

export function Button({
  variant = "subtle",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${buttonStyles[variant]} ${className}`}
    />
  );
}

/** Icon button that copies `text` to the clipboard; flips to a check for 1.5s. */
export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — do nothing.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-wash"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
            <path
              d="M2.5 8.5 6 12l7.5-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-delta-up">Copied</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

/** Geometric canary in profile — tail, body, head, beak, eye. Inherits currentColor. */
export function CanaryMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <path d="M1.5 11.5 10 15.5l-5.5 4z" fill="currentColor" />
      <circle cx="14" cy="18" r="9" fill="currentColor" />
      <circle cx="21" cy="10" r="6" fill="currentColor" />
      <path d="M26.5 7.5 32 10.2l-5.5 2.7z" fill="currentColor" />
      <circle cx="23" cy="8.6" r="1.4" fill="var(--accent)" />
      <path d="M12.5 27.2v2.8M16.5 27.2v2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="loading"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle ${className}`}
    />
  );
}

/** Status chip — icon + label, never color alone. */
export function StatusBadge({
  kind,
  label,
}: {
  kind: "good" | "critical" | "warn" | "neutral";
  label: string;
}) {
  const styles = {
    good: "text-delta-up border-good/40 bg-good/10",
    critical: "text-delta-down border-critical/40 bg-critical/10",
    warn: "text-ink border-warn/50 bg-warn/15",
    neutral: "text-ink-2 border-hairline bg-wash",
  }[kind];
  const icon = { good: "✓", critical: "✕", warn: "!", neutral: "•" }[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

/** Signed score delta: arrow + tabular number, text tokens + icon (not color alone). */
export function DeltaChip({ value }: { value: number }) {
  const eps = 0.005;
  const cls =
    value > eps
      ? "text-delta-up"
      : value < -eps
        ? "text-delta-down"
        : "text-muted";
  const arrow = value > eps ? "▲" : value < -eps ? "▼" : "–";
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${cls}`}
      title={`Change vs baseline: ${value >= 0 ? "+" : ""}${value.toFixed(2)}`}
    >
      {arrow} {Math.abs(value).toFixed(2)}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg px-2 py-2 hover:bg-wash ${disabled ? "opacity-50" : ""}`}
    >
      <span>
        <span className="block font-mono text-[13px] text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-axis"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
            checked ? "left-4.5" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}
