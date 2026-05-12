"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const FIELD_CLASS =
  "w-full rounded-[var(--radius-xl)] bg-[var(--surface)] px-4 py-3 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-[var(--ring-default)] focus:ring-2 focus:ring-[var(--foreground)]/20 placeholder:text-[var(--label-tertiary)]";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(FIELD_CLASS, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...rest },
  ref
) {
  return <textarea ref={ref} className={cn(FIELD_CLASS, "resize-none", className)} {...rest} />;
});
