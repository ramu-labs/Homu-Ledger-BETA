"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ImagePlus, Video, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createFeedback } from "@/app/actions/feedback";
import type { FeedbackCategory } from "@/lib/types";
import { cn } from "@/lib/cn";

const CATEGORIES: { code: FeedbackCategory; label: string }[] = [
  { code: "bug",      label: "Bug" },
  { code: "feature",  label: "Feature" },
  { code: "question", label: "Question" },
  { code: "other",    label: "Other" },
];

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

type Props = {
  userId: string;
};

type PendingAttachment = {
  localUrl: string;
  file: File;
  kind: "image" | "video";
  /** Storage path after upload (null while pending) */
  path: string | null;
  uploading: boolean;
  error: string | null;
};

export default function FeedbackForm({ userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The browser sometimes restores a non-zero scroll position when navigating
  // back into a long form, leaving the user mid-page. Force the viewport to
  // the top on mount so the subject field and helper text are visible.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const hasVideo = attachments.some((a) => a.kind === "video");

  async function uploadFile(att: PendingAttachment, index: number) {
    const ext = att.file.name.split(".").pop() ?? (att.kind === "video" ? "mp4" : "jpg");
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("feedback-attachments")
      .upload(path, att.file, { contentType: att.file.type });
    setAttachments((prev) => {
      const next = [...prev];
      if (uploadError) {
        next[index] = { ...att, uploading: false, error: uploadError.message };
      } else {
        next[index] = { ...att, uploading: false, path, error: null };
      }
      return next;
    });
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    const newOnes: PendingAttachment[] = Array.from(files).map((file) => ({
      localUrl: URL.createObjectURL(file),
      file,
      kind: "image",
      path: null,
      uploading: true,
      error: null,
    }));
    const baseLen = attachments.length;
    setAttachments((prev) => [...prev, ...newOnes]);
    newOnes.forEach((att, i) => uploadFile(att, baseLen + i));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function addVideo(file: File) {
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`Video is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 50 MB.`);
      return;
    }
    setError(null);
    const att: PendingAttachment = {
      localUrl: URL.createObjectURL(file),
      file,
      kind: "video",
      path: null,
      uploading: true,
      error: null,
    };
    const baseLen = attachments.length;
    setAttachments((prev) => [...prev, att]);
    uploadFile(att, baseLen);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.path) {
        supabase.storage.from("feedback-attachments").remove([removed.path]);
      }
      if (removed) URL.revokeObjectURL(removed.localUrl);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are required.");
      return;
    }
    if (attachments.some((a) => a.uploading)) {
      setError("Attachments are still uploading. Hang on a moment.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const fd = new FormData();
    fd.set("subject", subject.trim());
    fd.set("body", body.trim());
    fd.set("category", category);
    for (const att of attachments) {
      if (att.path) fd.append("attachments", att.path);
    }
    const result = await createFeedback(fd);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    setTimeout(() => router.push("/settings"), 1500);
  }

  if (submitted) {
    return (
      <div className="mx-5 mt-12 rounded-2xl bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-black/[0.04]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100/70 text-emerald-700">
          <Check className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <p className="text-[17px] font-semibold text-[var(--foreground)]">Thanks for the feedback!</p>
        <p className="mt-1.5 text-[13px] text-[var(--label-secondary)]">
          We&apos;ll take a look as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-5 mt-2 space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          maxLength={120}
          placeholder="Short summary"
          className="w-full rounded-2xl bg-[var(--surface)] px-4 py-3 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.06] focus:ring-2 focus:ring-[var(--foreground)]/20 placeholder:text-[var(--label-tertiary)]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setCategory(c.code)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-all active:scale-95",
                category === c.code
                  ? "bg-[var(--foreground)] text-[var(--on-foreground)] ring-[var(--foreground)]"
                  : "bg-[var(--surface)] text-[var(--foreground)] ring-black/[0.08]"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          placeholder="What happened, or what would you like to see?"
          className="w-full rounded-2xl bg-[var(--surface)] px-4 py-3 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.06] focus:ring-2 focus:ring-[var(--foreground)]/20 placeholder:text-[var(--label-tertiary)] resize-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          Attachments
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-3 text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.06] active:scale-[0.98]"
          >
            <ImagePlus className="h-[18px] w-[18px]" strokeWidth={2} />
            Add screenshot
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={hasVideo}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-3 text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.06] active:scale-[0.98] disabled:opacity-40"
          >
            <Video className="h-[18px] w-[18px]" strokeWidth={2} />
            {hasVideo ? "Video attached" : "Add video (≤ 50 MB)"}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => addImages(e.target.files)}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files?.[0] && addVideo(e.target.files[0])}
            className="hidden"
          />
        </div>

        {attachments.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {attachments.map((att, i) => (
              <li
                key={att.localUrl}
                className="relative aspect-square overflow-hidden rounded-xl bg-black/[0.05] ring-1 ring-black/[0.06]"
              >
                {att.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={att.localUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={att.localUrl} className="h-full w-full object-cover" muted />
                )}
                {att.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-semibold text-white">
                    Uploading…
                  </div>
                )}
                {att.error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-rose-600/80 px-2 text-center text-[10px] font-medium text-white">
                    {att.error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-rose-100/60 px-3 py-2 text-[13px] font-medium text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[var(--foreground)] py-3.5 text-[15px] font-semibold text-[var(--on-foreground)] disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
