"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
import { updateHouseholdCurrency } from "@/app/actions/households";
import { CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/cn";

export default function CurrencyPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSelect(code: string) {
    setSelected(code);
    setSaving(true);
    const result = await updateHouseholdCurrency(code);
    setSaving(false);
    if (!result.error) {
      startTransition(() => { router.back(); });
    }
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-4 pb-4 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Currency</h1>
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-3 text-[13px] text-[var(--label-secondary)]">
        Choose the default currency for this ledger. Existing transactions are not converted.
      </p>

      <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {CURRENCIES.map((c) => {
          const isSelected = selected === c.code;
          return (
            <li key={c.code}>
              <button
                onClick={() => handleSelect(c.code)}
                disabled={saving}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-black/[0.02] disabled:opacity-60"
              >
                <span className="w-10 shrink-0 text-[18px] font-semibold text-[var(--label-secondary)]">{c.symbol}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-[var(--foreground)]">{c.name}</p>
                  <p className="text-[12px] text-[var(--label-secondary)]">{c.code}</p>
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
