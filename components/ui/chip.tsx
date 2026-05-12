"use client";

import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  size?: "sm" | "default";
};

/**
 * Toggle pill used for category filters, period pickers, and segment
 * controls. Selected = foreground bg; unselected = surface bg with ring.
 */
export default function Chip({ selected, size = "default", className, children, ...rest }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] font-medium ring-1 transition-all active:scale-[var(--press-scale)]",
        size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
        selected
          ? "bg-[var(--foreground)] text-[var(--on-foreground)] ring-[var(--foreground)]"
          : "bg-[var(--surface)] text-[var(--foreground)] ring-[var(--ring-default)]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
