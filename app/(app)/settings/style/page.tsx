"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { updateUserIconStyle } from "@/app/actions/auth";
import { CategoryIcon } from "@/components/category-icon";
import { useT } from "@/lib/i18n/provider";
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
  const [selected, setSelected] = useState<IconStyle>(initial);
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

  async function handleSelect(code: IconStyle) {
    setSelected(code);
    setSaving(true);
    const result = await updateUserIconStyle(code);
    setSaving(false);
    if (!result.error) {
      startTransition(() => { router.back(); });
    }
  }

  return (
    <div className="pb-10">
      <header className="flex items-center justify-between px-5 pt-4 pb-4">
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
              onClick={() => handleSelect(s.code)}
              disabled={saving}
              className={`w-full rounded-2xl p-4 text-left transition-all active:scale-[0.99] disabled:opacity-60 ${
                isSelected
                  ? "bg-[var(--foreground)] ring-2 ring-[var(--foreground)]"
                  : "bg-[var(--surface)] ring-1 ring-black/[0.06]"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Icon previews */}
                <div className="flex gap-2">
                  {s.previewSymbols.map((sym) => (
                    <div
                      key={sym}
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        isSelected ? "bg-white/10" : "bg-black/[0.04]"
                      }`}
                    >
                      <CategoryIcon
                        symbol={sym}
                        iconStyle={s.code}
                        size={20}
                        emojiSize="20px"
                        color={isSelected ? "white" : undefined}
                        strokeWidth={2}
                      />
                    </div>
                  ))}
                </div>

                {/* Label + check */}
                <div className="ml-1 flex-1">
                  <p className={`text-[15px] font-semibold ${isSelected ? "text-white" : "text-[var(--foreground)]"}`}>
                    {s.label}
                  </p>
                  <p className={`text-[12px] ${isSelected ? "text-white/70" : "text-[var(--label-secondary)]"}`}>
                    {s.description}
                  </p>
                </div>

                {isSelected && (
                  <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
