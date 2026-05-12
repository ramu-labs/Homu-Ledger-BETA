"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ArrowRightLeft } from "lucide-react";
import { formatAmount, formatAmountSigned, formatDayGroup } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";
import { useT } from "@/lib/i18n/provider";
import type { DbTransaction, DbMember } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type Props = {
  transactions: DbTransaction[];
  members: Record<string, DbMember>;
  currency?: string;
  iconStyle?: IconStyle;
  onTap?: (tx: DbTransaction) => void;
};

const FALLBACK_CAT = { name: "Uncategorized", symbol: "📋", color: "#6b7280" };

export default function TransactionList({ transactions, members, currency = "IDR", iconStyle = "3d", onTap }: Props) {
  const tr = useT();
  // Avoid SSR hydration mismatch: only compute "Today" after mount on the client.
  const [todayKey, setTodayKey] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date();
    setTodayKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, []);

  // Track the top-most transaction ID so we can flash it when a new one appears.
  const prevTopIdRef = useRef<string | null>(null);
  const flashId = transactions[0]?.id ?? null;
  const isNewTop = flashId !== null && flashId !== prevTopIdRef.current;
  useEffect(() => {
    prevTopIdRef.current = flashId;
  });

  // Group transactions by date for day-header sections. Input is already
  // sorted by date desc / created_at desc, so consecutive same-date rows
  // stay together — walking linearly is enough.
  const groups = useMemo(() => {
    const out: { date: string; rows: { tx: DbTransaction; globalIndex: number }[] }[] = [];
    transactions.forEach((tx, i) => {
      const last = out[out.length - 1];
      if (last && last.date === tx.date) last.rows.push({ tx, globalIndex: i });
      else out.push({ date: tx.date, rows: [{ tx, globalIndex: i }] });
    });
    return out;
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="mx-5 mt-2 rounded-2xl bg-[var(--surface)] px-6 py-14 text-center ring-1 ring-black/[0.04]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] text-[28px]">
          📋
        </div>
        <p className="text-[16px] font-semibold text-[var(--foreground)]">No transactions yet</p>
        <p className="mt-1.5 text-[13px] text-[var(--label-secondary)] leading-relaxed">
          Tap the <span className="font-semibold text-[var(--foreground)]">+</span> button to record your first income or expense.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-5 mt-2 space-y-4">
      {groups.map((group) => (
        <section key={group.date}>
          <h3 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            {formatDayGroup(group.date, todayKey)}
          </h3>
          <ul className="overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
            {group.rows.map(({ tx: t, globalIndex: index }) => {
        const isTransfer = !!t.transfer_pair_id;
        const cat = t.categories ?? FALLBACK_CAT;
        const creator = t.created_by ? (members[t.created_by] ?? null) : null;
        // If created_by is set but the member isn't loaded, show a neutral fallback
        const showFallbackBadge = !!t.created_by && !creator;

        // Source wallet (the wallet on this row) = "from"
        // Peer wallet (attached by data loader for transfer rows) = "to"
        const fromWallet = t.wallets;
        const toWallet = t.peer_wallet ?? null;

        // Stagger the first 8 rows (roughly one screen of content on mobile).
        // Rows beyond that still animate in but with a fixed max delay so
        // scroll-triggered batches don't feel sluggish.
        const staggerMs = Math.min(index, 7) * 35;
        const isFlash = index === 0 && isNewTop;

        // When the top row is new AND we also need the row-in animation,
        // we use the `animation` shorthand with comma-separated values so
        // both keyframes play simultaneously (one for opacity/transform,
        // one for the background flash).
        const rowStyle: React.CSSProperties = isFlash
          ? { animation: `row-in 0.22s ${staggerMs}ms ease both, tx-flash 0.9s ${staggerMs}ms ease both` }
          : { animationDelay: `${staggerMs}ms` };

        return (
          <li
            key={t.id}
            onClick={() => onTap?.(t)}
            className="flex items-center gap-3 px-4 py-3.5 min-h-[60px] active:bg-black/[0.02] transition-colors cursor-pointer animate-row-in"
            style={rowStyle}
          >
            {isTransfer ? (
              // ── TRANSFER ROW ──────────────────────────────────────────────
              <div
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#EE645220" }}
              >
                <ArrowRightLeft className="h-[18px] w-[18px] text-[#EE6452]" strokeWidth={2.25} />
                {creator && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 block h-4 w-4 overflow-hidden rounded-full ring-2 ring-[var(--surface)]"
                    style={{ backgroundColor: creator.avatar_color }}
                    title={creator.name}
                  >
                    <InitialMark initials={creator.initials} />
                  </span>
                )}
              </div>
            ) : (
              // ── REGULAR ROW (expense / income) ────────────────────────────
              <div
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]"
                style={{ backgroundColor: `${cat.color}1A` }}
              >
                <CategoryIcon
                  symbol={cat.symbol}
                  iconStyle={iconStyle}
                  size={20}
                  emojiSize="18px"
                  color={iconStyle === "2d" ? cat.color : undefined}
                />
                {creator ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 block h-4 w-4 overflow-hidden rounded-full ring-2 ring-[var(--surface)]"
                    style={{ backgroundColor: creator.avatar_color }}
                    title={creator.name}
                  >
                    <InitialMark initials={creator.initials} />
                  </span>
                ) : showFallbackBadge ? (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 block h-4 w-4 overflow-hidden rounded-full bg-[var(--label-tertiary)] ring-2 ring-[var(--surface)]"
                  >
                    <InitialMark initials="?" />
                  </span>
                ) : null}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-[var(--foreground)]">
                {isTransfer ? tr("tx.transfer") : t.name}
              </p>
              <p className="flex items-center gap-1 text-[12px] text-[var(--label-secondary)] truncate">
                {isTransfer ? (
                  <span className="inline-flex items-center gap-1 truncate">
                    {fromWallet?.name ?? "?"}
                    <ArrowRightLeft className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
                    {toWallet?.name ?? "?"}
                  </span>
                ) : (
                  <>
                    {cat.name}
                    {t.wallets && <> · {t.wallets.name}</>}
                    {t.photo_url && <Camera className="h-3 w-3 shrink-0" strokeWidth={2} />}
                  </>
                )}
              </p>
            </div>

            <p
              className={`text-[15px] font-semibold tabular-nums tracking-tight ${
                isTransfer
                  ? "text-[#EE6452]"
                  : t.type === "income"
                  ? "text-emerald-600"
                  : "text-[var(--foreground)]"
              }`}
            >
              {isTransfer
                ? formatAmount(t.amount, currency)
                : formatAmountSigned(t.amount, t.type, currency)}
            </p>
          </li>
        );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Renders a 1-2 character initial inside a 16x16 badge using SVG `<text>`.
 * Centring single uppercase letters with CSS is unreliable: cap-height vs.
 * descender bias means flex/grid centres the LINE-BOX, not the visible
 * glyph, so different letters drift differently. SVG with a manually-tuned
 * baseline (`y="11.25"` for cap-height ≈ 0.7em at 10px) gives identical
 * vertical positioning regardless of which letter is rendered.
 */
function InitialMark({ initials }: { initials: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="block h-full w-full"
      aria-hidden="true"
    >
      <text
        x="8"
        y="11.25"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="#ffffff"
        // Inherit the page font (Geist) — text-anchor handles horizontal
        // centring; the explicit y baseline handles vertical centring.
        style={{ fontFamily: "inherit" }}
      >
        {initials}
      </text>
    </svg>
  );
}
