"use client";

// Key-management form. Lives on its own page (/settings/ai-admin/key)
// so a misclick on Clear can't nuke the key while the dev is just
// glancing at usage stats. Clear uses a two-tap confirmation that
// auto-cancels after 3 s — same pattern as the promo-code delete.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Sparkles, Check, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { saveGeminiKey, clearGeminiKey, testGeminiConnection } from "@/app/actions/ai";

type Props = {
  keyConfigured: boolean;
  keyUpdatedAt: string | null;
};

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok"; category: string; tokens: number; model: string }
  | { status: "fail"; error: string; unconfigured?: boolean };

export default function AiKeyForm({ keyConfigured, keyUpdatedAt }: Props) {
  const router = useRouter();
  const t = useT();
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  // Auto-cancel the arming state for Clear after 3 s so an accidental
  // first tap can't sit around as a one-tap-from-disaster trap.
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
    const res = await saveGeminiKey(keyInput);
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
      // First tap — arm. Visible state change makes it obvious the
      // next tap is destructive. Auto-cancels after 3 s.
      setConfirmClear(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => {
        setConfirmClear(false);
        confirmTimerRef.current = null;
      }, 3000);
      return;
    }
    // Second tap — actually clear.
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
    const res = await clearGeminiKey();
    setClearing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleTest() {
    setTest({ status: "running" });
    const res = await testGeminiConnection();
    if (res.ok) {
      setTest({ status: "ok", category: res.category, tokens: res.tokens, model: res.model });
    } else {
      setTest({ status: "fail", error: res.error, unconfigured: res.unconfigured });
    }
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("ai.admin.keyHeading")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      <section className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] p-4">
        <p className="mb-2 text-[12px] text-[var(--label-secondary)]">
          {keyConfigured ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
              {t("ai.admin.keyMaskedHint")}
              {keyUpdatedAt && (
                <span className="text-[var(--label-tertiary)]">
                  · {new Date(keyUpdatedAt).toLocaleString()}
                </span>
              )}
            </span>
          ) : (
            t("ai.admin.keyHint")
          )}
        </p>

        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={t("ai.admin.keyPlaceholder")}
          spellCheck={false}
          autoComplete="off"
          className="h-11 w-full rounded-2xl bg-[var(--background)] px-4 text-[14px] font-mono text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || keyInput.trim().length === 0}
            className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-[#EE6452] text-[14px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? t("common.saving") : t("ai.admin.keySave")}
          </button>
          <button
            onClick={handleTest}
            disabled={test.status === "running"}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[var(--background)] text-[14px] font-semibold text-[var(--foreground)] ring-1 ring-black/[0.08] disabled:opacity-60"
          >
            {test.status === "running" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
                {t("ai.admin.keyTesting")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                {t("ai.admin.keyTest")}
              </>
            )}
          </button>
        </div>

        {test.status === "ok" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 ring-1 ring-emerald-200">
            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {t("ai.admin.testOk")
              .replace("{category}", test.category)
              .replace("{tokens}", String(test.tokens))}
            <span className="ml-auto text-[var(--label-tertiary)] font-mono">{test.model}</span>
          </p>
        )}
        {test.status === "fail" && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {t("ai.admin.testFail").replace("{error}", test.error)}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 ring-1 ring-emerald-200">
            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {t("common.saved")}
          </p>
        )}
      </section>

      {/* Danger zone — Clear button, isolated below the main form so
          it's harder to fat-finger when reaching for Save. Two-tap
          confirmation: tap once to arm (button turns red + label
          changes), tap again to actually clear. Auto-cancels in 3 s. */}
      {keyConfigured && (
        <section className="mx-5 mt-5">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            {t("ai.admin.dangerZone")}
          </p>
          <button
            onClick={handleClearTap}
            disabled={clearing}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-colors disabled:opacity-60 [touch-action:manipulation]",
              confirmClear
                ? "bg-rose-600 text-white ring-1 ring-rose-600"
                : "bg-[var(--surface)] text-rose-600 ring-1 ring-black/[0.06]"
            )}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
            {clearing
              ? t("common.loading")
              : confirmClear
              ? t("ai.admin.keyClearConfirm")
              : t("ai.admin.keyClear")}
          </button>
          <p className="mt-2 px-1 text-[11px] text-[var(--label-tertiary)]">
            {t("ai.admin.keyClearHint")}
          </p>
        </section>
      )}
    </div>
  );
}
