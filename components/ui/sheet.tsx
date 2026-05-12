"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Optional title rendered in the sheet's header row. If provided, an
   *  X close button is also rendered on the right. Omit for fully custom
   *  headers (e.g. when you want an icon + multiline meta block). */
  title?: string;
  children: React.ReactNode;
  /** Optional override for max-height (defaults to 80vh). */
  maxHeight?: string;
  /** Optional className appended to the inner panel for content-specific
   *  styling. */
  className?: string;
};

/**
 * Bottom sheet with overlay, slide-up animation, X close button, click-
 * outside-to-close, and document.body scroll lock while open. Replaces the
 * hand-rolled fixed-position pattern duplicated across AddTransactionSheet,
 * AddRecurringSheet, AddCategorySheet, LedgerSwitcherSheet, and
 * CategoryDrilldownSheet.
 */
export default function Sheet({ open, onClose, title, children, maxHeight = "80vh", className }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[var(--z-sheet-overlay)] bg-black/30 backdrop-blur-[2px] animate-overlay-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed bottom-0 left-1/2 z-[var(--z-sheet-content)] w-full max-w-md -translate-x-1/2 rounded-t-[var(--radius-2xl)] bg-[var(--background)] shadow-[var(--shadow-sheet)] flex flex-col animate-sheet-slide-up",
          className
        )}
        style={{ maxHeight }}
      >
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--ring-strong)]" />
          {title !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ring-subtle)] text-[var(--foreground)] active:scale-95 transition-transform"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-8">{children}</div>
      </div>
    </>
  );
}
