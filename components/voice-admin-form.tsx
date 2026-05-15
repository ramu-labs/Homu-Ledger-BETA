"use client";

// Voice transactions admin form — Groq key + feature flag in one page.
// Dev-only. Reuses the same arming-Clear pattern as ai-key-form.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, AlertTriangle, Trash2, Mic } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { saveGroqKey, clearGroqKey, setVoiceInputEnabled } from "@/app/actions/ai";

type Props = {
  keyConfigured: boolean;
  keyUpdatedAt: string | null;
  flagEnabled: boolean;
};

export default function VoiceAdminForm({ keyConfigured, keyUpdatedAt, flagEnabled }: Props) {
  const router = useRouter();
  const t = useT();
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [flagSaving, setFlagSaving] = useState(false);

  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    const res = await saveGroqKey(keyInput);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setKeyInput("");
    setSaved(true);
    router.refresh();
  }

  function handleClearTap() {
    if (clearing) return;
    if (!confirmClear) {
      setConfirmClear(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmClear(false);
        confirmTimerRef.current = null;
      }, 3000);
      return;
    }
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setConfirmClear(false);
    void runClear();
  }

  async function runClear() {
    setError(null);
    setSaved(false);
    setClearing(true);
    const res = await clearGroqKey();
    setClearing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function toggleFlag(next: boolean) {
    setFlagSaving(true);
    const res = await setVoiceInputEnabled(next);
    setFlagSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pb-2 pt-2 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back") || "Back"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.05] transition-transform active:scale-95"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          Voice transactions
        </h1>
        <div className="h-9 w-9" />
      </header>

      {/* Feature flag toggle */}
      <section className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-black/[0.04]">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.04]">
            <Mic className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="flex-1">
            <p className="text-[14px] font-medium text-[var(--foreground)]">Enable voice FAB</p>
            <p className="text-[12px] text-[var(--label-secondary)]">
              Shows the coral mic button on /transactions.
            </p>
          </div>
          <button
            onClick={() => toggleFlag(!flagEnabled)}
            disabled={flagSaving || !keyConfigured}
            aria-pressed={flagEnabled}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
              flagEnabled ? "bg-emerald-500" : "bg-black/[0.10]",
              flagSaving && "opacity-60"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                flagEnabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        {!keyConfigured && (
          <p className="mt-2 text-[11px] text-amber-700">
            Add a Groq API key below before enabling.
          </p>
        )}
      </section>

      {/* Groq key */}
      <section className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-black/[0.04]">
        <p className="mb-1 text-[14px] font-medium text-[var(--foreground)]">Groq API key</p>
        <p className="mb-3 text-[12px] text-[var(--label-secondary)]">
          {keyConfigured ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
              Stored — last updated{" "}
              {keyUpdatedAt ? new Date(keyUpdatedAt).toLocaleString() : "—"}
            </span>
          ) : (
            <>Free at <span className="font-mono">console.groq.com</span>. Whisper-large-v3, ~28,800 audio-seconds/day on the free tier.</>
          )}
        </p>

        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="gsk_…"
          spellCheck={false}
          autoComplete="off"
          className="h-11 w-full rounded-2xl bg-[var(--background)] px-4 font-mono text-[14px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] transition-shadow placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20"
        />

        <div className="mt-3">
          <button
            onClick={handleSave}
            disabled={saving || keyInput.trim().length === 0}
            className="flex h-11 w-full items-center justify-center rounded-2xl bg-[#EE6452] text-[14px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? t("common.saving") || "Saving…" : "Save key"}
          </button>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 ring-1 ring-emerald-200">
            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {t("common.saved") || "Saved"}
          </p>
        )}
      </section>

      {keyConfigured && (
        <section className="mx-5 mt-5">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            Danger zone
          </p>
          <button
            onClick={handleClearTap}
            disabled={clearing}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-colors disabled:opacity-60",
              confirmClear ? "bg-rose-600 text-white ring-1 ring-rose-600" : "bg-[var(--surface)] text-rose-600 ring-1 ring-black/[0.06]"
            )}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
            {clearing ? "Clearing…" : confirmClear ? "Tap again to clear" : "Clear key"}
          </button>
          <p className="mt-2 px-1 text-[11px] text-[var(--label-tertiary)]">
            Clearing the key disables voice transactions until a new one is saved.
          </p>
        </section>
      )}
    </div>
  );
}
