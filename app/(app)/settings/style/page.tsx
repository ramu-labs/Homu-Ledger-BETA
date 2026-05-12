"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { updateUserIconStyle } from "@/app/actions/auth";
import { CategoryIcon } from "@/components/category-icon";
import { useT } from "@/lib/i18n/provider";
import Sheet from "@/components/ui/sheet";
import Button from "@/components/ui/buttons";
import type { IconStyle } from "@/lib/category-icons";

export default function StylePage() {
  return (
    <Suspense fallback={null}>
      <StylePageInner />
    </Suspense>
  );
}

function StylePageInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("current") as IconStyle | null) ?? "3d";
  const [, startTransition] = useTransition();
  // `selected` shows the *currently saved* style. `pending` is what the user
  // tapped but hasn't yet confirmed via the sheet.
  const [selected, setSelected] = useState<IconStyle>(initial);
  const [pending, setPending] = useState<IconStyle | null>(null);
  const [saving, setSaving] = useState(false);

  const STYLES: {
    code: IconStyle;
    label: string;
    description: string;
    previewSymbols: string[];
  }[] = [
    {
      code: "2d",
      label: t("settings.iconStyle.2d"),
      description: t("settings.iconStyle.2d.desc"),
      previewSymbols: ["🏠", "🍔", "🚗", "💼"],
    },
    {
      code: "3d",
      label: t("settings.iconStyle.3d"),
      description: t("settings.iconStyle.3d.desc"),
      previewSymbols: ["🏠", "🍔", "🚗", "💼"],
    },
  ];

  function openConfirm(code: IconStyle) {
    setPending(code);
  }

  async function applyPending() {
    if (!pending) return;
    setSaving(true);
    const result = await updateUserIconStyle(pending);
    setSaving(false);
    if (!result.error) {
      setSelected(pending);
      setPending(null);
      startTransition(() => { router.back(); });
    }
  }

  const pendingStyle = pending ? STYLES.find((s) => s.code === pending) ?? null : null;

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-4 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">{t("settings.iconStyle.title")}</h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-4 text-[13px] text-[var(--label-secondary)]">
        {t("settings.iconStyle.subtitle")}
      </p>

      <div className="mx-5 space-y-3">
        {STYLES.map((s) => {
          const isSelected = selected === s.code;
          return (
            <button
              key={s.code}
              onClick={() => openConfirm(s.code)}
              disabled={saving}
              className={`w-full rounded-2xl p-4 text-left transition-all active:scale-[0.99] disabled:opacity-60 ${
                isSelected
                  ? "bg-[var(--foreground)] ring-2 ring-[var(--foreground)]"
                  : "bg-[var(--surface)] ring-1 ring-[var(--ring-default)]"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Icon previews — when selected, the card bg is --foreground so
                    we need theme-aware contrast for the bubble bg and icon
                    stroke. Use --on-foreground (white in light, dark cream-bg
                    in dark) so neither mode washes out. */}
                <div className="flex gap-2">
                  {s.previewSymbols.map((sym) => (
                    <div
                      key={sym}
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isSelected ? "bg-[var(--on-foreground)]/10" : "bg-[var(--ring-subtle)]"
                      }`}
                    >
                      <CategoryIcon
                        symbol={sym}
                        iconStyle={s.code}
                        size={20}
                        emojiSize="20px"
                        color={isSelected ? "var(--on-foreground)" : undefined}
                        strokeWidth={2}
                      />
                    </div>
                  ))}
                </div>

                {/* Label + check */}
                <div className="ml-1 flex-1">
                  <p className={`text-[15px] font-semibold ${isSelected ? "text-[var(--on-foreground)]" : "text-[var(--foreground)]"}`}>
                    {s.label}
                  </p>
                  <p className={`text-[12px] ${isSelected ? "text-[var(--on-foreground)]/70" : "text-[var(--label-secondary)]"}`}>
                    {s.description}
                  </p>
                </div>

                {isSelected && (
                  <Check className="h-5 w-5 text-[var(--on-foreground)]" strokeWidth={2.5} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirmation sheet — always shown on any selection, including the
          currently-saved style (per spec). Cancel dismisses without changes;
          Apply saves and navigates back. */}
      <Sheet
        open={pending !== null}
        onClose={() => { if (!saving) setPending(null); }}
        title={pendingStyle ? `Use ${pendingStyle.label}?` : undefined}
      >
        {pendingStyle && (
          <>
            <div className="flex justify-center gap-2 py-4">
              {pendingStyle.previewSymbols.map((sym) => (
                <div
                  key={sym}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ring-subtle)]"
                >
                  <CategoryIcon
                    symbol={sym}
                    iconStyle={pendingStyle.code}
                    size={24}
                    emojiSize="22px"
                    strokeWidth={2}
                  />
                </div>
              ))}
            </div>
            <p className="px-2 text-center text-[13px] text-[var(--label-secondary)]">
              {pendingStyle.description}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                full
                onClick={() => setPending(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                full
                onClick={applyPending}
                disabled={saving}
              >
                {saving ? "Saving…" : "Apply"}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
