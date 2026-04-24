"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { updateUserLanguage } from "@/app/actions/auth";

const LANGUAGES: { code: "en" | "id"; name: string; native: string; flag: string }[] = [
  { code: "en", name: "English", native: "English", flag: "🇬🇧" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", flag: "🇮🇩" },
];

export default function LanguagePage() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("current") as "en" | "id" | null) ?? "en";
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<"en" | "id">(initial);
  const [saving, setSaving] = useState(false);

  async function handleSelect(code: "en" | "id") {
    setSelected(code);
    setSaving(true);
    const result = await updateUserLanguage(code);
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
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Language</h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-3 text-[13px] text-[var(--label-secondary)]">
        Choose your preferred language. This applies to your account only.
      </p>

      <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {LANGUAGES.map((l) => {
          const isSelected = selected === l.code;
          return (
            <li key={l.code}>
              <button
                onClick={() => handleSelect(l.code)}
                disabled={saving}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-black/[0.02] disabled:opacity-60"
              >
                <span className="w-10 shrink-0 text-[22px] leading-none">{l.flag}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-[var(--foreground)]">{l.native}</p>
                  <p className="text-[12px] text-[var(--label-secondary)]">{l.name}</p>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-[var(--foreground)]" strokeWidth={2.5} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
