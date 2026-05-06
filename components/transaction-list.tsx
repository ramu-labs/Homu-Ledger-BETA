"use client";

import { Camera } from "lucide-react";
import { formatAmountSigned, formatShortDate } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";
import type { DbTransaction, DbMember } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type Props = {
  transactions: DbTransaction[];
  members: Record<string, DbMember>;
  currency?: string;
  iconStyle?: IconStyle;
  onTap?: (tx: DbTransaction) => void;
};

const FALLBACK_CAT = { name: "Other", symbol: "📋", color: "#6b7280" };

export default function TransactionList({ transactions, members, currency = "IDR", iconStyle = "3d", onTap }: Props) {
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
    <ul className="mx-5 mt-2 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
      {transactions.map((t) => {
        const cat = t.categories ?? FALLBACK_CAT;
        const creator = t.created_by ? (members[t.created_by] ?? null) : null;
        // If created_by is set but the member isn't loaded, show a neutral fallback
        const showFallbackBadge = !!t.created_by && !creator;
        return (
          <li
            key={t.id}
            onClick={() => onTap?.(t)}
            className="flex items-center gap-3 px-4 py-3.5 min-h-[60px] active:bg-black/[0.02] transition-colors cursor-pointer"
          >
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
                  className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-[var(--surface)]"
                  style={{ backgroundColor: creator.avatar_color }}
                  title={creator.name}
                >
                  {creator.initials}
                </span>
              ) : showFallbackBadge ? (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white ring-2 ring-[var(--surface)] bg-[var(--label-tertiary)]"
                >
                  ?
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-[var(--foreground)]">{t.name}</p>
              <p className="flex items-center gap-1 text-[12px] text-[var(--label-secondary)]">
                {cat.name} · {formatShortDate(t.date)}
                {t.photo_url && <Camera className="h-3 w-3 shrink-0" strokeWidth={2} />}
              </p>
            </div>
            <p
              className={`text-[15px] font-semibold tabular-nums tracking-tight ${
                t.type === "income" ? "text-emerald-600" : "text-[var(--foreground)]"
              }`}
            >
              {formatAmountSigned(t.amount, t.type, currency)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
