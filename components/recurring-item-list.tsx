"use client";

import { Plus } from "lucide-react";
import { formatAmount, formatShortDate } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";
import { useT, useLang } from "@/lib/i18n/provider";
import type { TKey } from "@/lib/i18n/dictionaries";
import type { DbRecurringItem } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

const FALLBACK_CAT = { name: "Uncategorized", symbol: "📋", color: "#6b7280" };

const DAYS_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAYS_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

type Props = {
  items: DbRecurringItem[];
  currency?: string;
  iconStyle?: IconStyle;
  onTap: (item: DbRecurringItem) => void;
  onAdd: () => void;
};

export default function RecurringItemList({ items, currency = "IDR", iconStyle = "3d", onTap, onAdd }: Props) {
  const t = useT();
  const lang = useLang();

  /** Frequency badge label — "Weekly" / "Bulanan" / etc. */
  function freqBadge(item: DbRecurringItem): string {
    const key: TKey =
      item.frequency === "weekly" ? "recurring.weekly" :
      item.frequency === "monthly" ? "recurring.monthly" :
      "recurring.yearly";
    return t(key);
  }

  /** Sub-line under the badge: "1st of each month" / "Every Sunday" / etc. */
  function freqSubLabel(item: DbRecurringItem): string | null {
    if (item.frequency === "monthly" && item.next_due_date) {
      const day = parseInt(item.next_due_date.split("-")[2]);
      if (lang === "id") {
        return `Tanggal ${day} ${t("recurring.ofEachMonth")}`;
      }
      return `${ordinal(day)} ${t("recurring.ofEachMonth")}`;
    }
    if (item.frequency === "weekly" && item.next_due_date) {
      const [y, m, d] = item.next_due_date.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      const days = lang === "id" ? DAYS_ID : DAYS_EN;
      return `${t("recurring.everyDay")} ${days[dow]}`;
    }
    return null;
  }

  function repeatUntilLabel(item: DbRecurringItem): string | null {
    if (!item.repeat_until) return null;
    return `${t("recurring.until")} ${formatShortDate(item.repeat_until)}`;
  }

  function createdLabel(item: DbRecurringItem): string {
    const date = new Date(item.created_at);
    const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const prefix = lang === "id" ? "Dibuat" : "Added";
    return `${prefix} ${formatShortDate(ymd)}`;
  }

  if (items.length === 0) {
    return (
      <div className="mx-5 mt-2 rounded-2xl bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-black/[0.04]">
        <p className="text-[22px] mb-2">🔁</p>
        <p className="text-[15px] font-medium text-[var(--foreground)]">{t("recurring.empty.title")}</p>
        <p className="mt-1 text-[13px] text-[var(--label-secondary)]">
          {t("recurring.empty.subtitle")}
        </p>
        <button
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)] px-4 py-2 text-[13px] font-semibold text-[var(--on-foreground)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          {t("recurring.addFirst")}
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]"
                style={{ backgroundColor: `${cat.color}1A` }}
              >
                <CategoryIcon
                  symbol={cat.symbol}
                  iconStyle={iconStyle}
                  size={22}
                  emojiSize="20px"
                  color={iconStyle === "2d" ? cat.color : undefined}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--foreground)]">{item.name}</p>
                <div className="mt-0.5 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-[var(--label-secondary)]">
                      {freqBadge(item)}
                    </span>
                    {item.next_due_date && item.frequency === "yearly" && (
                      <span className="text-[11px] text-[var(--label-tertiary)]">
                        · {t("recurring.next")} {formatShortDate(item.next_due_date)}
                      </span>
                    )}
                    {until && (
                      <span className="text-[11px] text-[var(--label-tertiary)]">· {until}</span>
                    )}
                  </div>
                  {freqSubLabel(item) && (
                    <p className="text-[11px] text-[var(--label-tertiary)]">
                      {freqSubLabel(item)}
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--label-tertiary)]">
                    {createdLabel(item)}
                  </p>
                </div>
              </div>

              {/* v1.43.1 — income amount aligned with transaction-list +
                  voice-row: text-[var(--color-income)] for dark-mode parity. */}
              <p
                className={`shrink-0 text-[15px] font-semibold tabular-nums tracking-tight ${
                  item.type === "income" ? "text-[var(--color-income)]" : "text-[var(--foreground)]"
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
        {t("recurring.addNew")}
      </button>
    </div>
  );
}
