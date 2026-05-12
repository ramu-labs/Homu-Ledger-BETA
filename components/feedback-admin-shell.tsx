"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateFeedbackStatus, replyToFeedback, deleteFeedback } from "@/app/actions/feedback";
import { cn } from "@/lib/cn";
import type { DbFeedback, FeedbackStatus } from "@/lib/types";

const STATUS_OPTIONS: { code: FeedbackStatus; label: string; pill: string }[] = [
  { code: "open",        label: "Open",        pill: "bg-amber-100/80 text-amber-800" },
  { code: "in_progress", label: "In progress", pill: "bg-blue-100/80 text-blue-800" },
  { code: "closed",      label: "Closed",      pill: "bg-emerald-100/80 text-emerald-800" },
];

const CATEGORY_LABEL: Record<DbFeedback["category"], string> = {
  bug: "Bug",
  feature: "Feature",
  question: "Question",
  other: "Other",
};

type ProfileLite = { id: string; name: string; initials: string; avatar_color: string };

type Props = {
  tickets: DbFeedback[];
  profilesById: Record<string, ProfileLite>;
};

export default function FeedbackAdminShell({ tickets, profilesById }: Props) {
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const visible = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-3 backdrop-blur">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Feedback Tickets</h1>
        <div className="h-9 w-9" />
      </header>

      <div className="px-5 pt-2">
        <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
          <FilterTab active={filter === "all"} onClick={() => setFilter("all")} label="All" count={tickets.length} />
          {STATUS_OPTIONS.map((s) => (
            <FilterTab
              key={s.code}
              active={filter === s.code}
              onClick={() => setFilter(s.code)}
              label={s.label}
              count={tickets.filter((t) => t.status === s.code).length}
            />
          ))}
        </div>
      </div>

      <ul className="mx-5 mt-4 space-y-3">
        {visible.length === 0 ? (
          <li className="rounded-2xl bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-black/[0.04]">
            <p className="text-[15px] font-medium text-[var(--foreground)]">No tickets here.</p>
          </li>
        ) : (
          visible.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              author={t.created_by ? profilesById[t.created_by] ?? null : null}
              replier={t.replied_by ? profilesById[t.replied_by] ?? null : null}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function FilterTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[12px] font-medium transition-all",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
          : "text-[var(--label-secondary)]"
      )}
    >
      {label}
      <span className="rounded-full bg-black/[0.06] px-1.5 text-[10px] font-semibold">{count}</span>
    </button>
  );
}

function TicketCard({
  ticket,
  author,
  replier,
}: {
  ticket: DbFeedback;
  author: ProfileLite | null;
  replier: ProfileLite | null;
}) {
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replyText, setReplyText] = useState(ticket.reply ?? "");
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

  async function signAttachments() {
    if (Object.keys(attachmentUrls).length === ticket.attachments.length) return;
    const map: Record<string, string> = {};
    for (const path of ticket.attachments) {
      const { data } = await supabase.storage
        .from("feedback-attachments")
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) map[path] = data.signedUrl;
    }
    setAttachmentUrls(map);
  }

  async function changeStatus(status: FeedbackStatus) {
    setBusy(true);
    await updateFeedbackStatus(ticket.id, status);
    setBusy(false);
  }

  async function postReply() {
    if (!replyText.trim()) return;
    setBusy(true);
    await replyToFeedback(ticket.id, replyText);
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this ticket? This cannot be undone.")) return;
    setBusy(true);
    await deleteFeedback(ticket.id);
    setBusy(false);
  }

  const statusInfo = STATUS_OPTIONS.find((s) => s.code === ticket.status) ?? STATUS_OPTIONS[0];

  return (
    <li className="overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04]">
      <button
        onClick={() => {
          setExpanded((v) => !v);
          if (!expanded) signAttachments();
        }}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-black/[0.02]"
      >
        {author ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
            style={{ backgroundColor: author.avatar_color }}
          >
            {author.initials}
          </span>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]">
            ?
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">{ticket.subject}</p>
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusInfo.pill)}>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--label-secondary)]">
            {author?.name ?? "Unknown"} · {CATEGORY_LABEL[ticket.category]} · {new Date(ticket.created_at).toLocaleDateString()}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--separator)] px-4 py-3.5 space-y-3">
          <p className="whitespace-pre-wrap text-[13px] text-[var(--foreground)]">{ticket.body}</p>

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
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={path} href={url} target="_blank" rel="noreferrer" className="block">
                    <img src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  </a>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.code}
                onClick={() => changeStatus(s.code)}
                disabled={busy || s.code === ticket.status}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition-all",
                  s.code === ticket.status
                    ? "bg-[var(--foreground)] text-[var(--on-foreground)] ring-[var(--foreground)]"
                    : "bg-[var(--surface)] text-[var(--foreground)] ring-black/[0.08] active:scale-95"
                )}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={handleDelete}
              disabled={busy}
              className="ml-auto rounded-full bg-rose-100/70 px-3 py-1.5 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-200 active:scale-95 disabled:opacity-50"
            >
              Delete
            </button>
          </div>

          <div className="rounded-xl bg-black/[0.03] p-3">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              Developer reply
            </label>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              placeholder="Reply visible to the submitter"
              className="w-full resize-none rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.06] focus:ring-2 focus:ring-[var(--foreground)]/20"
            />
            <div className="mt-2 flex items-center justify-between">
              {ticket.replied_at && (
                <p className="text-[11px] text-[var(--label-secondary)]">
                  <MessageCircle className="inline h-3 w-3 mr-1" strokeWidth={2.25} />
                  Last reply by {replier?.name ?? "?"} on {new Date(ticket.replied_at).toLocaleDateString()}
                </p>
              )}
              <button
                onClick={postReply}
                disabled={busy || !replyText.trim() || replyText.trim() === (ticket.reply ?? "").trim()}
                className="ml-auto rounded-full bg-[var(--foreground)] px-3 py-1.5 text-[12px] font-semibold text-[var(--on-foreground)] disabled:opacity-50"
              >
                Save reply
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
