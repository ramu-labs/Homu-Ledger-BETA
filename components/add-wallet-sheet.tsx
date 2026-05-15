"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { queuedAddWallet, isQueued } from "@/lib/queue-actions";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { WALLET_ICONS, makeWalletLucideSymbol } from "@/lib/wallet-icons";
import { CategoryIcon } from "@/components/category-icon";
import type { DbWallet } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

const COLOR_PALETTE = [
  "#22c55e", "#3b82f6", "#8b5cf6", "#f97316",
  "#ef4444", "#ec4899", "#eab308", "#14b8a6", "#6b7280",
];

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (w: DbWallet) => void;
  iconStyle?: IconStyle;
  currency?: string;
};

export default function AddWalletSheet({ open, onClose, onAdded, iconStyle = "3d", currency = "IDR" }: Props) {
  const tr = useT();
  const [name, setName] = useState("");
  // Default to the first wallet icon (Banknote / 💵), matching what the
  // wallet style toggle expects for the current iconStyle.
  const initialSymbol = iconStyle === "2d"
    ? makeWalletLucideSymbol(WALLET_ICONS[0].lucideId)
    : WALLET_ICONS[0].emoji;
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [initialBalance, setInitialBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSelectedSymbol(initialSymbol);
    setSelectedColor(COLOR_PALETTE[0]);
    setInitialBalance("");
    setError(null);
    setLoading(false);
  }

  // Re-sync default symbol when the user's icon style preference changes
  // (e.g. they opened the sheet while in a different style).
  useEffect(() => {
    if (open) setSelectedSymbol(initialSymbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, iconStyle]);

  function handleClose() { reset(); onClose(); }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInitialBalance(e.target.value.replace(/\D/g, ""));
  }
  const balanceDisplay = initialBalance ? initialBalance.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("symbol", selectedSymbol);
    fd.set("color", selectedColor);
    fd.set("initial_balance", initialBalance || "0");
    const result = await queuedAddWallet(fd);
    // Offline / network drop: queued; the replay loop will hit the server
    // when we're back. Close the sheet; the pill shows pending state.
    if (isQueued(result)) {
      reset();
      onClose();
      return;
    }
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else if (result.wallet) {
      onAdded(result.wallet);
      reset();
      onClose();
    }
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[100] bg-black/40 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />
      <div
        className={cn(
          "fixed bottom-0 left-1/2 z-[110] w-full max-w-md -translate-x-1/2 flex flex-col rounded-t-3xl bg-[var(--surface)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">{tr("wallet.newWallet")}</h2>
          <button onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
          <div className="overflow-y-auto px-5 pb-4 space-y-4" style={{ maxHeight: "70dvh" }}>
            {/* Preview */}
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--background)] px-4 py-3 ring-1 ring-black/[0.06]">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${selectedColor}22` }}
              >
                <CategoryIcon
                  symbol={selectedSymbol}
                  iconStyle={iconStyle}
                  size={22}
                  emojiSize="22px"
                  color={iconStyle === "2d" ? selectedColor : undefined}
                />
              </div>
              <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">
                {name || tr("wallet.namePlaceholder")}
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("category.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={tr("wallet.namePlaceholder")}
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {/* Initial balance */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("wallet.initialBalance")} ({currency})
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={balanceDisplay}
                onChange={handleAmountChange}
                placeholder="0"
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
              <p className="mt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
                {tr("wallet.initialBalanceHint")}
              </p>
            </div>

            {/* Icon picker — 6 options, 2D or 3D depending on global pref */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("category.icon")}
              </label>
              {iconStyle === "2d" ? (
                <div className="grid grid-cols-6 gap-2">
                  {WALLET_ICONS.map(({ lucideId, icon: Icon }) => {
                    const sym = makeWalletLucideSymbol(lucideId);
                    const isActive = selectedSymbol === sym;
                    return (
                      <button
                        key={lucideId}
                        type="button"
                        onClick={() => setSelectedSymbol(sym)}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-xl transition-all",
                          isActive
                            ? "ring-2 ring-[var(--foreground)]/30 scale-95"
                            : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                        )}
                        style={isActive ? { backgroundColor: `${selectedColor}22`, color: selectedColor } : undefined}
                      >
                        <Icon
                          size={20}
                          strokeWidth={2}
                          style={{ color: isActive ? selectedColor : undefined }}
                          className={isActive ? "" : "text-[var(--label-secondary)]"}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {WALLET_ICONS.map(({ emoji }) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedSymbol(emoji)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl text-[20px] transition-all",
                        selectedSymbol === emoji
                          ? "bg-[var(--foreground)]/10 ring-2 ring-[var(--foreground)]/30 scale-95"
                          : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("category.color")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "h-9 w-9 rounded-full transition-all",
                      selectedColor === c ? "ring-2 ring-offset-2 ring-[var(--foreground)]/50 scale-110" : ""
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">{error}</p>
            )}
          </div>

          <div
            className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-3"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="submit"
              disabled={loading}
              className="flex h-13 w-full items-center justify-center rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {loading ? tr("common.adding") : tr("wallet.newWallet")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
