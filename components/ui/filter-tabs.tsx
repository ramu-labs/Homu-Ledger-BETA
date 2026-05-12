"use client";

import { cn } from "@/lib/cn";

type Option<T extends string> = { code: T; label: string; count?: number };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
};

/**
 * Segmented filter inside a pill-shaped container. Used by the feedback-
 * admin All/Open/In progress/Closed switch and is suitable for any small
 * mutually-exclusive choice set.
 */
export default function FilterTabs<T extends string>({ options, value, onChange, className }: Props<T>) {
  return (
    <div className={cn("flex gap-1 rounded-[var(--radius-pill)] bg-[var(--ring-subtle)] p-1", className)}>
      {options.map((opt) => {
        const active = value === opt.code;
        return (
          <button
            key={opt.code}
            onClick={() => onChange(opt.code)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1 rounded-[var(--radius-pill)] px-2 py-1.5 text-[12px] font-medium transition-all",
              active
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-card)]"
                : "text-[var(--label-secondary)]"
            )}
          >
            {opt.label}
            {typeof opt.count === "number" && (
              <span className="rounded-full bg-[var(--ring-subtle)] px-1.5 text-[10px] font-semibold">{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
