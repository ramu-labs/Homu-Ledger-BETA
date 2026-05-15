"use client";

// One row inside the voice screen's draft list.
//
// v1.42.2 layout:
//   • Big 40×40 category icon = primary tap target for the category
//     picker. While the row's category is still being auto-picked
//     (`category_pending`), this slot renders a Loader2 spinner over a
//     muted background — same "AI is thinking" cue the typed Add
//     Transaction sheet uses for auto-categorisation.
//   • Sub-line is "Category · Wallet". Category is PLAIN TEXT (no
//     chip). Wallet is a CHIP BUTTON with its swatch icon + name +
//     chevron — easier to spot as tappable than plain text.
//   • Small Sparkles badge in the corner of the category icon when
//     the row's `category_ai` flag is true (cleared on manual pick).
//
// Edit feedback (unchanged):
//   • Parent row gets a soft emerald tint flash on every version bump.
//   • The specific cell that changed gets an emerald halo + scale pop.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowRightLeft, Loader2, Sparkles } from "lucide-react";
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
  const isParsedTx = !isTransfer;
  const categoryPending = isParsedTx && row.category_pending === true;
  const categoryAi = isParsedTx && row.category_ai === true;
  const category = isParsedTx ? categories.find((c) => c.id === row.category_id) : undefined;
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
    setCategoryOpen(false);
    setWalletOpen((v) => !v);
  }
  function toggleCategory() {
    if (isTransfer || categoryPending) return;
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

  // v1.42.3: transfer amount reads as neutral foreground colour, not
  // coral. Coral was redundant — the row already has the coral
  // arrow-rightleft icon + coral wallet→wallet sub-line, so the number
  // shouting in coral too was overkill. Matches transaction-list.tsx
  // where transfer amounts are also non-tinted.
  const amountColor = isTransfer
    ? "var(--foreground)"
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
      {/* ─── Big icon (40×40). The primary category tap target.
            Transfers get a static coral arrow icon (no picker).
            Non-transfers with a pending category render a Loader2
            inside the slot (auto-categorisation in flight) — matches
            the typed Add Transaction sheet pattern. ─────────────────── */}
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
          aria-label={categoryPending ? "Categorising…" : "Change category"}
          disabled={categoryPending}
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
            categoryPending && "cursor-default"
          )}
          style={{
            backgroundColor: categoryPending ? "var(--ring-subtle)" : `${cat.color}1A`,
          }}
        >
          {categoryPending ? (
            <Loader2
              className="h-[18px] w-[18px] animate-spin text-[var(--label-tertiary)]"
              strokeWidth={2.25}
            />
          ) : (
            <CategoryIcon
              symbol={cat.symbol}
              iconStyle={iconStyle}
              size={20}
              emojiSize="18px"
              color={iconStyle === "2d" ? cat.color : undefined}
            />
          )}
          {/* AI sparkle indicator — only when the category was AI-
              picked AND the user hasn't manually overridden. Cleared
              by onSetCategory in the parent reducer. */}
          {!categoryPending && categoryAi && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface)] text-[#EE6452] ring-1 ring-[var(--ring-subtle)]"
              style={{ animation: "ai-sparkle-blink 2.8s ease-in-out infinite" }}
            >
              <Sparkles className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          )}
          {/* Subtle down-chevron in the corner when nothing else is
              there — the only visual hint that the icon is tappable. */}
          {!categoryPending && !categoryAi && (
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--label-tertiary)] ring-1 ring-[var(--ring-subtle)]"
            >
              <ChevronDown className="h-2 w-2" strokeWidth={2.5} />
            </span>
          )}
        </button>
      )}

      {/* ─── Body. Sub-line layout:
            "Category-name-text · [Wallet-chip-button]"
            Category is plain text (left). Wallet is a chip with its
            swatch + name + chevron — restored in v1.42.2 after the
            "everything is plain text" simplification proved too subtle. */}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-medium text-[var(--foreground)]">
          <span ref={nameRef} className="inline-block truncate">
            {row.name}
          </span>
        </p>

        {isTransfer ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[var(--label-secondary)]">
            <span className="truncate">{wallet?.name ?? "?"}</span>
            <ArrowRightLeft className="mx-0.5 h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
            <span className="truncate">{peerWallet?.name ?? "?"}</span>
          </p>
        ) : (
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--label-secondary)]">
            {/* Category — plain text. Italic + muted while pending. */}
            <span
              className={cn(
                "truncate",
                categoryPending && "italic text-[var(--label-tertiary)]"
              )}
            >
              {categoryPending ? "Categorising…" : cat.name}
            </span>
            <span>·</span>
            {/* Wallet — chip button with its colour swatch icon. */}
            <button
              ref={walletRef}
              type="button"
              onClick={toggleWallet}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-[var(--foreground)] transition-transform active:scale-95 dark:bg-white/[0.08]"
            >
              <span className="text-[12px]">{wallet?.symbol ?? "💳"}</span>
              <span>{wallet?.name ?? "Wallet"}</span>
              <ChevronDown className="h-2.5 w-2.5" strokeWidth={2.25} />
            </button>
          </div>
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

        {/* Category picker — anchored under the big icon. Shows the
            FULL household category list filtered by this row's type. */}
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

      {/* Amount. v1.43.0 — incomplete row (amount=0, waiting for a
          stitch) renders as a muted dashes placeholder. Real amount
          appears when the user follows up with the number. */}
      {!isTransfer && row.amount === 0 ? (
        <p
          ref={amountRef}
          className="shrink-0 text-[15px] font-semibold tracking-tight tabular-nums text-[var(--label-tertiary)]"
        >
          —
        </p>
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
