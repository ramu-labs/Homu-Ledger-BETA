"use client";

// Read-only bottom sheet showing a single ticket the user submitted, plus
// the developer's reply (if any). Mirrors the visual conventions of the
// CategoryDrilldownSheet in reports-shell.tsx (overlay z-[55], sheet z-[60],
// body-scroll lock, X close button).
//
// Signed URLs for the user's own attachments are generated on demand —
// the storage RLS policy from 0020 allows the submitter to SELECT their
// own objects.

import { useEffect, useMemo, useState } from "react";
import { X, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import type { DbFeedback, FeedbackStatus } from "@/lib/types";

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

export default function MyTicketDetailSheet({
  ticket,
  onClose,
}: {
  ticket: DbFeedback;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

  // Lock background scroll while the sheet is mounted (same pattern as the
  // Reports drilldown sheet).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Sign each attachment for 1 hour. We do it sequentially; the attachment
  // count cap is small (a handful of screenshots + at most one video).
  useEffect(() => {
    let cancelled = false;
    if (ticket.attachments.length === 0) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const path of ticket.attachments) {
        const { data } = await supabase.storage
          .from("feedback-attachments")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) map[path] = data.signedUrl;
      }
      if (!cancelled) setAttachmentUrls(map);
    })();
    return () => { cancelled = true; };
  }, [supabase, ticket.attachments]);

  const pill = STATUS_PILL[ticket.status];

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-[2px] animate-overlay-fade-in"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-1/2 z-[60] w-full max-w-md -translate-x-1/2 rounded-t-3xl bg-[var(--background)] shadow-2xl max-h-[85vh] flex flex-col animate-sheet-slide-up">
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/[0.12]" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
                {ticket.subject}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--label-secondary)]">
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", pill.classes)}>
                  {pill.label}
                </span>
                <span>{CATEGORY_LABEL[ticket.category]}</span>
                <span>·</span>
                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[var(--foreground)] active:scale-95 transition-transform"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
          <p className="whitespace-pre-wrap text-[14px] text-[var(--foreground)]">
            {ticket.body}
          </p>

          {ticket.attachments.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {ticket.attachments.map((path) => {
                const url = attachmentUrls[path];
                const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(path);
                if (!url) {
                  return (
                    <div
                      key={path}
                      className="aspect-square animate-pulse rounded-xl bg-black/[0.05]"
                    />
                  );
                }
                return isVideo ? (
                  <video
                    key={path}
                    src={url}
                    controls
                    className="aspect-square w-full rounded-xl bg-black object-cover"
                  />
                ) : (
                  <a key={path} href={url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  </a>
                );
              })}
            </div>
          )}

          {ticket.reply && ticket.reply.trim().length > 0 ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3.5 ring-1 ring-emerald-100">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
                Reply from the dev
                {ticket.replied_at && (
                  <span className="ml-auto font-normal normal-case tracking-normal text-emerald-700/70">
                    {new Date(ticket.replied_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-emerald-900">
                {ticket.reply}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-black/[0.03] px-4 py-3.5 text-[13px] text-[var(--label-secondary)]">
              No reply from the dev yet — you&apos;ll see it here when one comes in.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
