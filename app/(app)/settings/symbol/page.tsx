"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { updateHouseholdSymbol } from "@/app/actions/households";
import FilterTabs from "@/components/ui/filter-tabs";
import Button from "@/components/ui/buttons";
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

type Tab = "default" | "custom";

export default function SymbolPickerPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("default");
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
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
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

      {/* Default / Custom subtabs */}
      <div className="px-5 mt-3">
        <FilterTabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { code: "default", label: "Default" },
            { code: "custom",  label: "Custom" },
          ]}
        />
      </div>

      {tab === "default" ? (
        <div className="mx-5 mt-4 grid grid-cols-5 gap-3">
          {SYMBOL_GRID.map((emoji) => (
            <button
              key={emoji}
              disabled={loading}
              onClick={() => handlePick(emoji)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-2xl bg-[var(--surface)] text-[28px] ring-1 ring-[var(--ring-default)] transition-all active:scale-95 active:bg-black/[0.04] disabled:opacity-50"
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <div className="mx-5 mt-5 space-y-4">
          {/* Big live preview — shows whatever the user is typing, or a
              dimmed hint when empty. */}
          <div className="flex h-32 items-center justify-center rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--ring-default)]">
            {custom.trim() ? (
              <span style={{ fontSize: 64, lineHeight: 1 }}>{custom.trim()}</span>
            ) : (
              <span className="text-[13px] text-[var(--label-tertiary)]">
                Your emoji will appear here
              </span>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              Emoji
            </label>
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Paste any emoji ✨"
              className="w-full h-14 rounded-2xl bg-[var(--surface)] px-4 text-center text-[28px] outline-none ring-1 ring-[var(--ring-default)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow placeholder:text-[16px] placeholder:text-[var(--label-tertiary)]"
            />
            <p className="mt-2 text-[12px] text-[var(--label-secondary)]">
              Use any emoji your keyboard supports — drop it in the field and tap Use.
            </p>
          </div>
          <Button
            variant="primary"
            full
            onClick={handleApplyCustom}
            disabled={!custom.trim() || loading}
          >
            {loading ? "Saving…" : "Use this emoji"}
          </Button>
        </div>
      )}
    </div>
  );
}
