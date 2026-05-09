"use client";

import { useState, useEffect } from "react";
import { X, Plus, Check } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import AddWalletSheet from "@/components/add-wallet-sheet";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import type { DbWallet } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type Props = {
  wallets: DbWallet[];
  selected: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onWalletAdded: (w: DbWallet) => void;
  iconStyle?: IconStyle;
  currency?: string;
};

export default function WalletPickerSheet({
  wallets, selected, onSelect, onClose, onWalletAdded, iconStyle = "3d", currency = "IDR",
}: Props) {
  const tr = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [localWallets, setLocalWallets] = useState<DbWallet[]>(wallets);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleAdded(w: DbWallet) {
    setLocalWallets((prev) => [...prev, w]);
    onWalletAdded(w);
    setShowAdd(false);
    onSelect(w.id);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50" onClick={onClose} />

      <div
        className={cn(
          "fixed bottom-0 left-1/2 z-[90] flex max-h-[80dvh] w-full max-w-md -translate-x-1/2 flex-col rounded-t-3xl bg-[var(--surface)] transition-transform duration-[360ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          visible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-1">
          <h3 className="text-[17px] font-semibold text-[var(--foreground)]">{tr("wallet.title")}</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-1">
          {localWallets.length === 0 ? (
            <div className="flex h-24 items-center justify-center">
              <p className="text-[14px] text-[var(--label-secondary)]">{tr("wallet.empty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 px-0.5">
              {localWallets.map((w) => {
                const isSelected = selected === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => { onSelect(w.id); onClose(); }}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-all active:scale-[0.97]",
                      isSelected
                        ? "ring-2 ring-[var(--foreground)]/30"
                        : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                    )}
                    style={isSelected ? { backgroundColor: `${w.color}22` } : undefined}
                  >
                    {isSelected && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--foreground)]">
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${w.color}20` }}
                    >
                      <CategoryIcon
                        symbol={w.symbol}
                        iconStyle={iconStyle}
                        size={20}
                        emojiSize="20px"
                        color={iconStyle === "2d" ? w.color : undefined}
                      />
                    </span>
                    <span className="w-full text-center text-[11px] font-medium leading-tight text-[var(--foreground)] line-clamp-2">
                      {w.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-3"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--background)] py-3 text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] transition-colors active:bg-black/[0.04]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            {tr("wallet.addNew")}
          </button>
        </div>
      </div>

      <AddWalletSheet
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={handleAdded}
        iconStyle={iconStyle}
        currency={currency}
      />
    </>
  );
}
