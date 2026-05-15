"use client";

// One row inside the voice screen's draft list.
//
// v1.42.0 rework:
//   • Sub-line is now PLAIN TEXT — matches components/transaction-list.tsx.
//     No category pill, no wallet pill, no chevrons. Just "Category · Wallet".
//   • The big 40×40 icon is the category tap target. The wallet pill goes
//     away too — wallet edits happen via a small "Wallet ▾" affordance to
//     the right of the sub-line text.
//   • Category icon uses <CategoryIcon> so 2D mode is honoured.
//   • Ghost rows render with a pulsing skeleton state while the parse is
//     in flight (Whisper done, Gemini not yet).
//
// Edit feedback (unchanged):
//   • The parent row gets a soft emerald tint flash on every version bump.
//   • The specific cell that changed (icon / name / wallet / amount) gets
//     an emerald halo + scale pop.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";
import type { DbCategory, DbWallet } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";
import type { ParsedTransaction, ParsedTransfer } from "@/lib/voice/types";

type Props = {
  row: ParsedTransaction | ParsedTransfer;
  categories: DbCategory[];
  wallets: DbWallet[];
  currency: string;
  iconStyle: IconStyle;
  /** v1.42.0 — when true, the row plays the magical fly-out animation
   *  with a staggered animation-delay. Set by the parent on Save. */
  flying?: boolean;
  /** v1.42.0 — index in the visible list, for staggered fly-out delay. */
  flyIndex?: number;
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
  iconStyle,
  flying,
  flyIndex = 0,
  onSetWallet,
  onSetCategory,
}: Props) {
  const isTransfer = row.type === "transfer";
  const isGhost = "ghost" in row && row.ghost === true;
  const category = !isTransfer ? categories.find((c) => c.id === row.category_id) : undefined;
  const cat = category ?? VOICE_FALLBACK_CAT;

  const defaultWallet = wallets.find((w) => w.is_default) ?? wallets[0];
  const wallet = isTransfer
    ? wallets.find((w) => w.id === row.from_wallet_id) ?? defaultWallet
    : wallets.find((w) => w.id === row.wallet_id) ?? defaultWallet;
  const peerWallet = isTransfer ? wallets.find((w) => w.id === row.to_wallet_id) ?? null : null;

  // Refs for the edit-pulse animations.
  const rowRef = useRef<HTMLLIElement | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
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

  // Picker state — same component owns both because they're mutually
  // exclusive and share the outside-tap dismissal handler.
  const [walletOpen, setWalletOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const anyOpen = walletOpen || categoryOpen;

  function toggleWallet() {
    if (isGhost) return; // can't edit while parse is still resolving
    setCategoryOpen(false);
    setWalletOpen((v) => !v);
  }
  function toggleCategory() {
    if (isGhost || isTransfer) return;
    setWalletOpen(false);
    setCategoryOpen((v) => !v);
  }

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
        row.exiting ? "voice-row-exit" : "voice-row-enter",
        flying && "voice-row-fly"
      )}
      style={{
        borderRadius: 18,
        background: "var(--surface)",
        border: "1px solid var(--ring-subtle)",
        boxShadow: "var(--shadow-card)",
        zIndex: anyOpen ? 50 : "auto",
        animationDelay: flying ? `${flyIndex * 50}ms` : undefined,
      }}
    >
      {/* ─── Big icon (40×40). v1.42.0: now the primary tap target for
            the category picker, mirroring the AI-categorisation pattern
            in the typed Add Transaction sheet. Transfers get a static
            coral arrow icon (no picker). ──────────────────────────────── */}
      {isTransfer ? (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#EE645220" }}
        >
          <ArrowRightLeft className="h-[18px] w-[18px] text-[#EE6452]" strokeWidth={2.25} />
        </div>
      ) : (
        <button
          ref={iconRef}
          type="button"
          onClick={toggleCategory}
          aria-label="Change category"
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
            isGhost && "animate-pulse"
          )}
          style={{ backgroundColor: `${cat.color}1A` }}
        >
          <CategoryIcon
            symbol={cat.symbol}
            iconStyle={iconStyle}
            size={20}
            emojiSize="18px"
            color={iconStyle === "2d" ? cat.color : undefined}
          />
          {/* Tiny down-chevron in the corner is the only visual hint
              that this is tappable. Subtle on purpose — the row's mass
              is the category icon; we don't want a busy chip ring. */}
          {!isGhost && (
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--label-tertiary)] ring-1 ring-[var(--ring-subtle)]"
            >
              <ChevronDown className="h-2 w-2" strokeWidth={2.5} />
            </span>
          )}
        </button>
      )}

      {/* ─── Body. Sub-line is now plain text: "Category · Wallet".
            The wallet "name" is wrapped in a button so it stays tappable
            (no chip styling), and a chevron sits next to it as the only
            visual cue that it's editable. ──────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-medium text-[var(--foreground)]">
          <span
            ref={nameRef}
            className={cn("inline-block truncate", isGhost && "italic text-[var(--label-secondary)]")}
          >
            {row.name}
          </span>
        </p>

        {isTransfer ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[var(--label-secondary)]">
            <span className="truncate">{wallet?.name ?? "?"}</span>
            <ArrowRightLeft className="mx-0.5 h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
            <span className="truncate">{peerWallet?.name ?? "?"}</span>
          </p>
        ) : isGhost ? (
          <p className="mt-0.5 text-[12px] italic text-[var(--label-tertiary)]">
            Thinking…
          </p>
        ) : (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[var(--label-secondary)]">
            <span className="truncate">{cat.name}</span>
            <span>·</span>
            {/* Wallet — plain text, but the whole text+chevron is a
                button so the hit target stays comfortable on mobile. */}
            <button
              ref={walletRef}
              type="button"
              onClick={toggleWallet}
              className="inline-flex shrink-0 items-center gap-0.5 text-[var(--label-secondary)] transition-opacity active:opacity-60"
            >
              <span className="truncate">{wallet?.name ?? "Wallet"}</span>
              <ChevronDown className="h-2.5 w-2.5" strokeWidth={2.25} />
            </button>
          </p>
        )}

        {/* Wallet picker — anchored to the wallet button row. */}
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
                  <CategoryIcon
                    symbol={w.symbol}
                    iconStyle={iconStyle}
                    size={14}
                    emojiSize="12px"
                    color={iconStyle === "2d" ? w.color : undefined}
                  />
                </span>
                <span className="text-[12px] font-medium">{w.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Category picker — anchored under the big icon. Bigger tiles
            now that the icon (not the pill) opens it; the user expects
            a substantial picker after tapping the prominent target. */}
        {categoryOpen && !isTransfer && (
          <div
            className="absolute z-[60] mt-1 grid max-h-[240px] grid-cols-3 gap-1.5 overflow-y-auto rounded-2xl border border-[var(--ring-default)] p-2 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"
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
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${c.color}33` }}
                  >
                    <CategoryIcon
                      symbol={c.symbol}
                      iconStyle={iconStyle}
                      size={18}
                      emojiSize="16px"
                      color={iconStyle === "2d" ? c.color : undefined}
                    />
                  </span>
                  <span className="text-[10.5px] font-medium leading-tight">{c.name}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Amount. Ghost rows show a skeleton bar instead of "0". */}
      {isGhost ? (
        <div
          aria-hidden
          className="h-4 w-16 shrink-0 animate-pulse rounded-md bg-[var(--label-tertiary)]/20"
        />
      ) : (
        <p
          ref={amountRef}
          className="shrink-0 text-[15px] font-semibold tracking-tight tabular-nums"
          style={{ color: amountColor }}
        >
          {amountPrefix}
          {formatAmount(row.amount, currency)}
        </p>
      )}
    </li>
  );
}
