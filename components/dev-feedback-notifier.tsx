"use client";

// Mounted once in the (app) layout for developer accounts. Subscribes to
// INSERT events on `public.feedback` via Realtime and shows a small toast
// in the top-center area when a new ticket arrives. Tapping the toast
// routes to /settings/feedback-admin?ticket=<id>.
//
// Implementation notes:
// - Toasts are stacked (newest on top), each auto-dismisses after 8s, max 3
//   visible at once.
// - We de-dupe by ticket id in case Realtime delivers a duplicate event.
// - The container sits below the status-bar shield (z-30) but above page
//   content. We use z-[40] so it stays clear of opened sheets (z-[55+]).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DbFeedback } from "@/lib/types";

const TOAST_DURATION_MS = 8000;
const MAX_VISIBLE = 3;

type Toast = {
  id: string;
  ticketId: string;
  subject: string;
};

export default function DevFeedbackNotifier() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    const channel = supabase
      .channel("dev-new-feedback")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback" },
        (payload) => {
          const row = payload.new as DbFeedback;
          if (seenIdsRef.current.has(row.id)) return;
          seenIdsRef.current.add(row.id);
          const toastId = `${row.id}-${Date.now()}`;
          setToasts((prev) => [
            { id: toastId, ticketId: row.id, subject: row.subject },
            ...prev,
          ].slice(0, MAX_VISIBLE));
          setTimeout(() => dismiss(toastId), TOAST_DURATION_MS);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[40] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            dismiss(t.id);
            router.push(`/settings/feedback-admin?ticket=${t.ticketId}`);
          }}
          className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3 text-left shadow-lg ring-1 ring-black/[0.06] animate-toast-slide-down"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100/80 text-rose-700">
            <MessageSquare className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              New feedback
            </p>
            <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">
              {t.subject}
            </p>
          </div>
          <span
            role="presentation"
            onClick={(e) => {
              // Tapping the X dismisses without navigating
              e.stopPropagation();
              dismiss(t.id);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)] active:scale-95 transition-transform"
            aria-label="Dismiss"
          >
            <X className="h-[14px] w-[14px]" strokeWidth={2.5} />
          </span>
        </button>
      ))}
    </div>
  );
}
