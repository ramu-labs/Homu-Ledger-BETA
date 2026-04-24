"use client";

import { Plus } from "lucide-react";
import { formatAmount, formatShortDate } from "@/lib/format";
import type { DbRecurringItem } from "@/lib/types";
import { CategoryIcon } from "@/components/category-icon";

const FALLBACK_CAT = { name: "Other", symbol: "📋", color: "#6b7280" };

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function freqLabel(item: DbRecurringItem): string {
  switch (item.frequency) {
    case "weekly":
      return "Weekly";
    case "yearly":
      return "Yearly";
    case "monthly":
      if (item.next_due_date) {
        const day = parseInt(item.next_due_date.split("-")[2]);
        return `Monthly · ${ordinal(day)} of each month`;
      }
      return "Monthly";
  }
}

function repeatUntilLabel(item: DbRecurringItem): string | null {
  if (!item.repeat_until) return null;
  return `Until ${formatShortDate(item.repeat_until)}`;
}

type Props = {
  items: DbRecurringItem[];
  currency?: string;
  onTap: (item: DbRecurringItem) => void;
  onAdd: () => void;
};

export default function RecurringItemList({ items, currency = "IDR", onTap, onAdd }: Props) {
  if (items.length === 0) {
    return (
      <div className="mx-5 mt-2 rounded-2xl bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-black/[0.04]">
        <p className="text-[22px] mb-2">🔁</p>
        <p className="text-[15px] font-medium text-[var(--foreground)]">No recurring items</p>
        <p className="mt-1 text-[13px] text-[var(--label-secondary)]">
          Track subscriptions, rent, salaries — anything that repeats.
        </p>
        <button
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)] px-4 py-2 text-[13px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add first item
        </button>
      </div>
    );
  }

  return (
    <div className="mx-5 mt-2 space-y-3">
      <ul className="overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
        {items.map((item) => {
          const cat = item.categories ?? FALLBACK_CAT;
          const until = repeatUntilLabel(item);
          return (
            <li
              key={item.id}
              onClick={() => onTap(item)}
              className="flex items-center gap-3 px-4 py-3.5 min-h-[64px] active:bg-black/[0.02] transition-colors cursor-pointer"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${cat.color}1A`, color: cat.color }}
              >
                <CategoryIcon symbol={cat.symbol} size={20} emojiSize="20px" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--foreground)]">{item.name}</p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-[var(--label-secondary)]">
                    {freqLabel(item)}
                  </span>
                  {item.next_due_date && item.frequency !== "monthly" && (
                    <span className="text-[11px] text-[var(--label-tertiary)]">
                      · Next {formatShortDate(item.next_due_date)}
                    </span>
                  )}
                  {until && (
                    <span className="text-[11px] text-[var(--label-tertiary)]">· {until}</span>
                  )}
                </div>
              </div>

              <p
                className={`shrink-0 text-[15px] font-semibold tabular-nums tracking-tight ${
                  item.type === "income" ? "text-emerald-600" : "text-[var(--foreground)]"
                }`}
              >
                {item.type === "income" ? "+" : "-"}{formatAmount(item.amount, currency)}
              </p>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--surface)] py-3.5 text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] transition-colors active:bg-black/[0.04]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        Add recurring item
      </button>
    </div>
  );
}
