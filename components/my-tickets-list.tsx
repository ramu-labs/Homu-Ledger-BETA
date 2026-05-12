"use client";

// User-facing list of tickets the signed-in user has submitted, with the
// dev's reply (if any) shown inside a tappable detail sheet. RLS already
// restricts SELECT to `created_by = auth.uid()`, so a plain `*` query is
// safe — no extra `eq("created_by", userId)` filter needed.
//
// Realtime: we subscribe to UPDATE events on `feedback` filtered to the
// current user's rows so a dev reply / status change appears live without
// a refresh. INSERT/DELETE aren't needed here (only the dev can delete; the
// user creates via the form, which already pushes a navigation).

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import type { DbFeedback, FeedbackStatus } from "@/lib/types";
import MyTicketDetailSheet from "@/components/my-ticket-detail-sheet";

const STATUS_PILL: Record<FeedbackStatus, { label: string; classes: string }> = {
  open:        { label: "Open",        classes: "bg-amber-100/80 text-amber-800" },
  in_progress: { label: "In progress", classes: "bg-blue-100/80 text-blue-800" },
  closed:      { label: "Closed",      classes: "bg-emerald-100/80 text-emerald-800" },
};

const CATEGORY_LABEL: Record<DbFeedback["category"], string> = {
  bug: "Bug",
  feature: "Feature",
  question: "Question",
  other: "Other",
};

export default function MyTicketsList({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [tickets, setTickets] = useState<DbFeedback[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Initial fetch + Realtime subscription.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("feedback")
        .select("id, created_at, created_by, household_id, subject, body, category, status, attachments, reply, replied_at, replied_by")
        .order("created_at", { ascending: false });
      if (!cancelled) setTickets(data ?? []);
    }
    load();

    // UPDATE: dev replied / changed status. The realtime payload contains
    // the new row; merge it in-place.
    const channel = supabase
      .channel(`my-feedback-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "feedback",
          filter: `created_by=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as DbFeedback;
          setTickets((prev) =>
            prev ? prev.map((t) => (t.id === next.id ? { ...t, ...next } : t)) : prev
          );
        }
      )
      .on(
        "postgres_changes",
        {
          // Dev deleted the ticket — drop it from the list silently.
          event: "DELETE",
          schema: "public",
          table: "feedback",
          filter: `created_by=eq.${userId}`,
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setTickets((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
          setOpenId((cur) => (cur === id ? null : cur));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const openTicket = tickets?.find((t) => t.id === openId) ?? null;

  if (tickets === null) {
    // Loading skeleton matches the card height so the layout doesn't jump.
    return (
      <ul className="mx-5 mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-[68px] animate-pulse rounded-2xl bg-black/[0.04]" />
        ))}
      </ul>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="mx-5 mt-12 rounded-2xl bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-black/[0.04]">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">No tickets yet</p>
        <p className="mt-1.5 text-[13px] text-[var(--label-secondary)]">
          Submit one from the other tab — replies from the dev will show up here.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="mx-5 mt-4 space-y-3">
        {tickets.map((t) => {
          const pill = STATUS_PILL[t.status];
          const hasReply = !!t.reply && t.reply.trim().length > 0;
          return (
            <li key={t.id}>
              <button
                onClick={() => setOpenId(t.id)}
                className="flex w-full flex-col items-start gap-1.5 rounded-2xl bg-[var(--surface)] px-4 py-3.5 text-left ring-1 ring-black/[0.04] active:bg-black/[0.02] transition-colors"
              >
                <div className="flex w-full items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--foreground)]">
                    {t.subject}
                  </p>
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", pill.classes)}>
                    {pill.label}
                  </span>
                </div>
                <p className="line-clamp-2 text-[13px] text-[var(--label-secondary)]">
                  {t.body}
                </p>
                <div className="flex w-full items-center gap-2 text-[11px] text-[var(--label-tertiary)]">
                  <span>{CATEGORY_LABEL[t.category]}</span>
                  <span>·</span>
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  {hasReply && (
                    <span className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <MessageCircle className="h-3 w-3" strokeWidth={2.5} />
                      Reply
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {openTicket && (
        <MyTicketDetailSheet ticket={openTicket} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
