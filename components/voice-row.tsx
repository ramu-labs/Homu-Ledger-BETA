"use client";

// One row inside the voice screen's draft list.
//
// Visual mirrors components/transaction-list.tsx (40×40 icon, sub-line
// with category + wallet pills, right-aligned amount). Adds:
//   • Tap-to-edit pill for category + wallet (popover anchored under
//     the pill). Wallet picker = 2-col swatches; category picker =
//     3-col tile grid filtered by row type.
//   • Edit feedback: parent row gets a soft emerald tint flash, AND
//     the specific cell that changed (icon / name / wallet / amount)
//     gets a coral halo + scale pop. Re-armed every time the row's
//     `version` bumps — that's how the voice shell triggers the
//     animation after an "update" action lands.
//   • Smooth enter / exit class swap.
//
// Why not reuse transaction-list.tsx directly? Two reasons:
//   1. These are CLIENT-ONLY drafts — no DbTransaction shape, no
//      transfer_pair_id pairing, no recurring_item_id pulldown.
//   2. The tap interactions are voice-specific (only category +
//      wallet are tap-editable; amount/description are voice-only).
//      Wedging that into the existing list would muddy its props.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import type { DbCategory, DbWallet } from "@/lib/types";
import type { ParsedTransaction, ParsedTransfer } from "@/lib/voice/types";

type Props = {
  row: ParsedTransaction | ParsedTransfer;
  categories: DbCategory[];
  wallets: DbWallet[];
  currency: string;
  /** Picking a new wallet from the popover. */
  onSetWallet: (walletId: string) => void;
  /** Picking a new category from the popover. */
  onSetCategory: (categoryId: string) => void;
};

const VOICE_FALLBACK_CAT: Pick<DbCategory, "name" | "symbol" | "color"> = {
  name: "Uncategorized",
  symbol: "📋",
  color: "#6b7280",
};

export default function VoiceRow({
  row,
  categories,
  wallets,
  currency,
  onSetWallet,
  onSetCategory,
}: Props) {
  const isTransfer = row.type === "transfer";
  const category = !isTransfer
    ? categories.find((c) => c.id === row.category_id)
    : undefined;
  const cat = category ?? VOICE_FALLBACK_CAT;

  // Wallet lookup. Transfers always have both ends; non-transfers may
  // have null (Gemini didn't name a wallet). Fall back to the household
  // default for display purposes; the row's wallet_id stays null so
  // the save path uses the server's "default wallet" semantics.
  const defaultWallet = wallets.find((w) => w.is_default) ?? wallets[0];
  const wallet = isTransfer
    ? wallets.find((w) => w.id === row.from_wallet_id) ?? defaultWallet
    : wallets.find((w) => w.id === row.wallet_id) ?? defaultWallet;
  const peerWallet = isTransfer ? wallets.find((w) => w.id === row.to_wallet_id) ?? null : null;

  // Refs for the edit-pulse animations. `lastVersion` lets us detect a
  // bump without firing on first mount (the row-enter class handles that).
  const rowRef = useRef<HTMLLIElement | null>(null);
  const iconRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLSpanElement | null>(null);
  const walletRef = useRef<HTMLButtonElement | null>(null);
  const amountRef = useRef<HTMLParagraphElement | null>(null);
  const lastVersion = useRef<number>(row.version ?? 0);

  useEffect(() => {
    if ((row.version ?? 0) === lastVersion.current) return;
    lastVersion.current = row.version ?? 0;

    const el = rowRef.current;
    if (el) {
      el.classList.remove("voice-row-flash");
      // Force reflow so removing + re-adding actually restarts the
      // animation (browsers batch class mutations within a frame).
      void el.offsetWidth;
      el.classList.add("voice-row-flash");
    }

    const target =
      row.changed === "category"
        ? iconRef.current
        : row.changed === "name"
          ? nameRef.current
          : row.changed === "wallet"
            ? walletRef.current
            : row.changed === "amount"
              ? amountRef.current
              : null;
    if (target) {
      target.classList.remove("voice-cell-pop");
      void target.offsetWidth;
      target.classList.add("voice-cell-pop");
    }
  }, [row.version, row.changed]);

  // Picker state
  const [walletOpen, setWalletOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const anyOpen = walletOpen || categoryOpen;

  function toggleWallet() {
    setCategoryOpen(false);
    setWalletOpen((v) => !v);
  }
  function toggleCategory() {
    setWalletOpen(false);
    setCategoryOpen((v) => !v);
  }

  // Outside-tap dismissal. {capture: true} so we see the pointerdown
  // before the row's own click handlers stopPropagation it.
  useEffect(() => {
    if (!anyOpen) return;
    function onOutside(e: PointerEvent) {
      const node = rowRef.current;
      if (node && !node.contains(e.target as Node)) {
        setWalletOpen(false);
        setCategoryOpen(false);
      }
    }
    document.addEventListener("pointerdown", onOutside, true);
    return () => document.removeEventListener("pointerdown", onOutside, true);
  }, [anyOpen]);

  const amountColor = isTransfer
    ? "#EE6452"
    : row.type === "income"
      ? "var(--color-income)"
      : "var(--color-expense)";
  const amountPrefix = isTransfer ? "" : row.type === "income" ? "+" : "-";

  return (
    <li
      ref={rowRef}
      className={cn(
        "voice-row relative flex items-center gap-3 px-4 py-3 min-h-[64px]",
        row.exiting ? "voice-row-exit" : "voice-row-enter"
      )}
      style={{
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--ring-subtle)",
        boxShadow: "var(--shadow-card)",
        // Lift the row above its siblings while a picker is open so the
        // absolutely-positioned popover escapes the next row's stacking
        // context.
        zIndex: anyOpen ? 50 : "auto",
      }}
    >
      {/* Icon — either category symbol or transfer arrow */}
      {isTransfer ? (
        <div
          ref={iconRef}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#EE645220" }}
        >
          <ArrowRightLeft className="h-[18px] w-[18px] text-[#EE6452]" strokeWidth={2.25} />
        </div>
      ) : (
        <div
          ref={iconRef}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]"
          style={{ backgroundColor: `${cat.color}26` }}
        >
          <span>{cat.symbol}</span>
        </div>
      )}

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-medium text-[var(--foreground)]">
          <span ref={nameRef} className="inline-block truncate">
            {row.name}
          </span>
        </p>

        {isTransfer ? (
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--label-secondary)]">
            <span className="inline-flex items-center gap-1 truncate">
              <span className="text-[12px]">{wallet?.symbol}</span>
              <span>{wallet?.name}</span>
              <ArrowRightLeft className="mx-0.5 h-2.5 w-2.5" strokeWidth={2.5} />
              <span className="text-[12px]">{peerWallet?.symbol}</span>
              <span>{peerWallet?.name}</span>
            </span>
          </div>
        ) : (
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--label-secondary)]">
            <button
              type="button"
              onClick={toggleCategory}
              className="inline-flex max-w-[120px] items-center gap-1 truncate rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)] transition-transform active:scale-95 dark:bg-white/[0.08]"
            >
              <span className="text-[12px]">{cat.symbol}</span>
              <span className="truncate">{cat.name}</span>
              <ChevronDown className="h-2.5 w-2.5 shrink-0" strokeWidth={2.25} />
            </button>
            <span>·</span>
            <button
              ref={walletRef}
              type="button"
              onClick={toggleWallet}
              className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)] transition-transform active:scale-95 dark:bg-white/[0.08]"
            >
              <span className="text-[12px]">{wallet?.symbol ?? "💳"}</span>
              <span>{wallet?.name ?? "Wallet"}</span>
              <ChevronDown className="h-2.5 w-2.5" strokeWidth={2.25} />
            </button>
          </div>
        )}

        {/* Wallet picker — 2-col swatches */}
        {walletOpen && !isTransfer && (
          <div
            className="absolute z-[60] mt-1 grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--ring-default)] p-2 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
            style={{ left: 56, right: 8, top: "100%", background: "var(--surface)" }}
          >
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  onSetWallet(w.id);
                  setWalletOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-transform active:scale-[0.97]"
                style={{
                  background: !isTransfer && w.id === row.wallet_id ? `${w.color}26` : "transparent",
                  border: !isTransfer && w.id === row.wallet_id ? `1px solid ${w.color}55` : "1px solid transparent",
                }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${w.color}33` }}
                >
                  <span className="text-[12px]">{w.symbol}</span>
                </span>
                <span className="text-[12px] font-medium">{w.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Category picker — 3-col tiles, filtered by row type */}
        {categoryOpen && !isTransfer && (
          <div
            className="absolute z-[60] mt-1 grid max-h-[220px] grid-cols-3 gap-1.5 overflow-y-auto rounded-2xl border border-[var(--ring-default)] p-2 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
            style={{ left: 56, right: 8, top: "100%", background: "var(--surface)" }}
          >
            {categories
              .filter((c) => c.type === row.type)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSetCategory(c.id);
                    setCategoryOpen(false);
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-transform active:scale-[0.97]"
                  style={{
                    background: !isTransfer && c.id === row.category_id ? `${c.color}26` : "transparent",
                    border: !isTransfer && c.id === row.category_id ? `1px solid ${c.color}55` : "1px solid transparent",
                  }}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${c.color}33` }}
                  >
                    <span className="text-[14px]">{c.symbol}</span>
                  </span>
                  <span className="text-[10.5px] font-medium leading-tight">{c.name}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Amount */}
      <p
        ref={amountRef}
        className="shrink-0 text-[15px] font-semibold tracking-tight tabular-nums"
        style={{ color: amountColor }}
      >
        {amountPrefix}
        {formatAmount(row.amount, currency)}
      </p>
    </li>
  );
}
