"use client";

// AI categorisation language picker (v1.27.0).
//
// Why this is per-household and not per-user: the AI category cache is
// also per-household, and what matters to the model is the language
// the typed descriptions are in — which is a property of the ledger,
// not the person looking at it. Two members of the same Indonesian
// family share one "language=id" preference.
//
// Auto-detect works fine when the description is unambiguously one
// language ("Pampers" → Baby's Health). It trips on Indonesian phrases
// that LOOK like English root words ("Babi Cincang" → "Baby Needs"
// instead of pork → Groceries). Setting language explicitly to 'id'
// inserts a one-line instruction in the Gemini prompt that fixes this.

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { setHouseholdAiLanguage } from "@/app/actions/households";
import type { HouseholdAiLanguage } from "@/app/actions/households";
import { useT } from "@/lib/i18n/provider";

type Choice = {
  code: HouseholdAiLanguage;
  flag: string;
  // Two strings per row: the human-facing label and the
  // explainer beneath it. The labels come from the i18n bundle so
  // they translate with the rest of Settings.
  labelKey: string;
  hintKey: string;
};

const CHOICES: Choice[] = [
  { code: "auto", flag: "✨", labelKey: "ai.lang.auto", hintKey: "ai.lang.autoHint" },
  { code: "en",   flag: "🇬🇧", labelKey: "ai.lang.en",   hintKey: "ai.lang.enHint" },
  { code: "id",   flag: "🇮🇩", labelKey: "ai.lang.id",   hintKey: "ai.lang.idHint" },
];

export default function AiLanguagePage() {
  return (
    <Suspense fallback={null}>
      <AiLanguagePageInner />
    </Suspense>
  );
}

function AiLanguagePageInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  // Initial value comes from the URL ?current= param, written by the
  // RowLink on /settings. Keeps the page non-blocking — no server
  // round-trip just to render the checkmark.
  const initialRaw = params.get("current");
  const initial: HouseholdAiLanguage =
    initialRaw === "en" || initialRaw === "id" || initialRaw === "auto"
      ? initialRaw
      : "auto";

  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<HouseholdAiLanguage>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(code: HouseholdAiLanguage) {
    if (code === selected || saving) return;
    setSelected(code);
    setError(null);
    setSaving(true);
    const result = await setHouseholdAiLanguage(code);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      // Revert the selection on failure so the checkmark doesn't lie.
      setSelected(initial);
      return;
    }
    // Brief beat before navigating back so the user sees the check
    // settle on their new choice. Same pattern as the user-language
    // picker.
    startTransition(() => {
      router.back();
    });
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-4 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("settings.aiLanguage")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-3 text-[13px] text-[var(--label-secondary)]">
        {t("ai.lang.subtitle")}
      </p>

      <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {CHOICES.map((c) => {
          const isSelected = selected === c.code;
          return (
            <li key={c.code}>
              <button
                onClick={() => handleSelect(c.code)}
                disabled={saving}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-black/[0.02] disabled:opacity-60"
              >
                <span className="w-10 shrink-0 text-[22px] leading-none">{c.flag}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-[var(--foreground)]">
                    {t(c.labelKey as any)}
                  </p>
                  <p className="text-[12px] text-[var(--label-secondary)]">
                    {t(c.hintKey as any)}
                  </p>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-[var(--foreground)]" strokeWidth={2.5} />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mx-5 mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
