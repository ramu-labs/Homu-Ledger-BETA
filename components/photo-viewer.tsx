"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";

type Props = {
  /** Public URL of the photo, or null to hide. */
  url: string | null;
  /** Filename suggestion for download (defaults to "transaction-photo.jpg"). */
  downloadName?: string;
  onClose: () => void;
};

/**
 * Fullscreen photo viewer with a download button.
 *
 * Why fetch + blob for download: the photo lives on the Supabase Storage
 * domain, not ours. iOS Safari/Chrome ignore the `download` attribute on
 * cross-origin <a> tags and just navigate to the image instead. Fetching
 * the bytes ourselves into a blob URL makes the link same-origin from
 * the browser's POV, so the download attribute kicks in properly.
 */
export default function PhotoViewer({ url, downloadName, onClose }: Props) {
  const tr = useT();
  const open = !!url;
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Slide/fade in on mount. Two-step so the transition has a starting frame.
  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // ESC closes — useful on desktop, harmless on mobile.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleDownload() {
    if (!url) return;
    setDownloading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName ?? "transaction-photo.jpg";
      // Some browsers (Safari) require the anchor to be in the DOM.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Give the click handler a tick to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("Photo download failed:", err);
      // Last-resort fallback: open in a new tab so the user can long-press
      // or use the browser's native save-image action.
      window.open(url, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[120] flex flex-col bg-black/95 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
      // Tap on the backdrop to close — but ignore taps on the image itself
      // and on the buttons (they have their own handlers).
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between p-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <span className="text-[14px] font-medium text-white/80">
          {tr("tx.photo")}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center px-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Transaction photo"
          className="max-h-full max-w-full select-none rounded-2xl object-contain"
          draggable={false}
        />
      </div>

      <div
        className="shrink-0 px-5 pt-3"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-black transition-opacity active:opacity-80 disabled:opacity-60"
        >
          <Download className="h-[18px] w-[18px]" strokeWidth={2.25} />
          {downloading ? tr("photo.downloading") : tr("photo.download")}
        </button>
      </div>
    </div>
  );
}
