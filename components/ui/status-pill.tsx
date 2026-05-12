import { cn } from "@/lib/cn";

export type Tone = "success" | "warning" | "info" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-[var(--tint-success-bg)] text-[var(--tint-success-text)]",
  warning: "bg-[var(--tint-warning-bg)] text-[var(--tint-warning-text)]",
  info:    "bg-[var(--tint-info-bg)] text-[var(--tint-info-text)]",
  danger:  "bg-[var(--tint-danger-bg)] text-[var(--tint-danger-text)]",
};

type Props = {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
};

/**
 * Compact status badge used for ticket states, transaction-type chips,
 * filter counts, etc. Theme-aware via --tint-* tokens — works in both
 * light and dark without per-instance overrides.
 */
export default function StatusPill({ tone, children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
