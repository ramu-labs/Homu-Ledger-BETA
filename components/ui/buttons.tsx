"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type CommonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Visual variant. */
  variant?: "primary" | "secondary" | "danger";
  /** Stretch to fill the parent's width. */
  full?: boolean;
  /** Size: default (h-12) or sm (h-9). */
  size?: "default" | "sm";
};

/**
 * Project-wide button. Three variants mapped to the design tokens:
 *  - primary:   bg-[var(--foreground)] text-[var(--on-foreground)]
 *  - secondary: bg-[var(--surface)] ring-[var(--ring-default)]
 *  - danger:    --tint-danger-bg / --tint-danger-text
 */
const Button = forwardRef<HTMLButtonElement, CommonProps>(function Button(
  { variant = "primary", full, size = "default", className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-xl)] font-semibold transition-opacity active:opacity-90 disabled:opacity-50 [touch-action:manipulation]",
        size === "default" ? "h-12 px-5 text-[15px]" : "h-9 px-3 text-[13px]",
        full && "w-full",
        variant === "primary"   && "bg-[var(--foreground)] text-[var(--on-foreground)]",
        variant === "secondary" && "bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--ring-default)]",
        variant === "danger"    && "bg-[var(--tint-danger-bg)] text-[var(--tint-danger-text)]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
