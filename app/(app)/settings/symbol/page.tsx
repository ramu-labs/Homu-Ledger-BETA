"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { updateHouseholdSymbol } from "@/app/actions/households";
import { cn } from "@/lib/cn";

const SYMBOL_GRID = [
  "🏠", "🏡", "🏘", "🏰", "🏯",
  "🌊", "🌿", "🌸", "🌺", "🌻",
  "🌴", "🍀", "🌈", "🌙", "⭐",
  "🌟", "💫", "☀️", "🔥", "❄️",
  "❤️", "💙", "💚", "💜", "🧡",
  "🐾", "🦁", "🐬", "🦋", "🦅",
  "🐉", "🎵", "🎨", "📚", "🎯",
  "🔑", "💡", "🎪", "🌍", "🎄",
];

type Props = {
  searchParams: Promise<{ current?: string }>;
};

export default function SymbolPickerPage({ searchParams }: Props) {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePick(symbol: string) {
    setLoading(true);
    await updateHouseholdSymbol(symbol);
    router.back();
  }

  async function handleApplyCustom() {
    const val = custom.trim();
    if (!val) return;
    await handlePick(val);
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-4 pb-2 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Ledger Symbol</h1>
        <div className="h-9 w-9" />
      </header>

      <p className="mt-2 px-6 text-[13px] text-[var(--label-secondary)]">
        Pick an emoji to represent this ledger.
      </p>

      <div className="mx-5 mt-4 grid grid-cols-5 gap-3">
        {SYMBOL_GRID.map((emoji) => (
          <button
            key={emoji}
            disabled={loading}
            onClick={() => handlePick(emoji)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-2xl bg-[var(--surface)] text-[28px] ring-1 ring-black/[0.06] transition-all active:scale-95 active:bg-black/[0.04] disabled:opacity-50"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Custom emoji input */}
      <div className="mx-5 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-black/[0.07]" />
          <span className="text-[11px] text-[var(--label-tertiary)]">or type your own</span>
          <div className="h-px flex-1 bg-black/[0.07]" />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Paste any emoji ✨"
            className="flex-1 h-12 rounded-2xl bg-[var(--surface)] px-4 text-center text-[22px] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow placeholder:text-[16px] placeholder:text-[var(--label-tertiary)]"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!custom.trim() || loading}
            className="h-12 px-5 rounded-2xl bg-[var(--foreground)] text-[14px] font-semibold text-white disabled:opacity-40 transition-opacity"
          >
            Use
          </button>
        </div>
      </div>
    </div>
  );
}
