"use client";

// Wallet picker — v1.44.0 floating-bento redesign.
//
// Same bento treatment as CategoryPicker (see that file's header for
// the full rationale): floating card, 2-col icon-left grid, double-RAF
// slide-up, coordinated `onCloseStart` exit, inline-add preserved.
//
// `title` lets the caller relabel the header ("From wallet" / "To
// wallet") when the picker fills a transfer slot.

import { useState, useEffect } from "react";
import { X, Plus, Check } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import AddWalletSheet from "@/components/add-wallet-sheet";
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
  /** Header label override — e.g. "From wallet" / "To wallet". */
  title?: string;
  /** v1.44.0 — fired synchronously when the exit animation starts,
   *  before onClose. Lets the parent sheet rise in sync. Optional. */
  onCloseStart?: () => void;
};

export default function WalletPickerSheet({
  wallets,
  selected,
  onSelect,
  onClose,
  onWalletAdded,
  iconStyle = "3d",
  currency = "IDR",
  title,
  onCloseStart,
}: Props) {
  const tr = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [localWallets, setLocalWallets] = useState<DbWallet[]>(wallets);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let r2: number | null = null;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
    };
  }, []);

  function startClose() {
    setVisible(false);
    onCloseStart?.();
    setTimeout(onClose, 560);
  }

  function handleAdded(w: DbWallet) {
    setLocalWallets((prev) => [...prev, w]);
    onWalletAdded(w);
    setShowAdd(false);
    onSelect(w.id);
    startClose();
  }

  return (
    <>
      <div
        onClick={startClose}
        className="fixed inset-0 z-[80] flex items-end justify-center"
        style={{
          background: visible ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
          backdropFilter: visible ? "blur(2px)" : "blur(0px)",
          WebkitBackdropFilter: visible ? "blur(2px)" : "blur(0px)",
          transition: visible
            ? "background 560ms ease, backdrop-filter 560ms ease"
            : "background 280ms ease, backdrop-filter 280ms ease",
          padding: "0 10px 18px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-md flex-col bg-[var(--surface)] text-[var(--foreground)]"
          style={{
            maxHeight: "88%",
            borderRadius: 28,
            padding: "10px 0 16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            transform: visible ? "translateY(0)" : "translateY(110%)",
            transition: "transform 560ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <div className="flex justify-center pb-2 pt-1">
            <div className="h-1 w-9 rounded-full bg-black/[0.16]" />
          </div>

          <div className="flex items-center justify-between px-[18px] pb-2.5 pt-1">
            <span className="text-[15px] font-bold text-[var(--foreground)]">
              {title ?? tr("wallet.title")}
            </span>
            <button
              onClick={startClose}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
              aria-label={tr("common.close")}
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>

          <div className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto px-3">
            {localWallets.length === 0 ? (
              <p className="col-span-2 py-8 text-center text-[14px] text-[var(--label-secondary)]">
                {tr("wallet.empty")}
              </p>
            ) : (
              localWallets.map((w) => {
                const active = w.id === selected;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      onSelect(w.id);
                      startClose();
                    }}
                    className="flex min-w-0 items-center gap-2.5 rounded-[20px] bg-[var(--background)] px-3 py-[11px] text-left transition-transform active:scale-[0.97]"
                    style={{
                      border: active
                        ? `1.5px solid ${w.color}`
                        : "1px solid var(--separator)",
                    }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${w.color}26` }}
                    >
                      <CategoryIcon
                        symbol={w.symbol}
                        iconStyle={iconStyle}
                        size={16}
                        emojiSize="14px"
                        color={iconStyle === "2d" ? w.color : undefined}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                      {w.name}
                    </span>
                    {active && (
                      <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} style={{ color: w.color }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[var(--background)] py-3 text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] transition-colors active:bg-black/[0.04]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} />
              {tr("wallet.addNew")}
            </button>
          </div>
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
