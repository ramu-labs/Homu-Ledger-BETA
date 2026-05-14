"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount, formatAmountWithSign } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import SurfaceCard from "@/components/ui/surface-card";

type Props = {
  balance: number;
  income: number;
  expenses: number;
  currency?: string;
};

function useCountUp(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = target;

    // Skip animation for identical values or very small deltas
    if (from === to) return;

    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

export default function BalanceCard({ balance, income, expenses, currency = "IDR" }: Props) {
  const t = useT();
  const animatedBalance = useCountUp(balance);
  return (
    <section className="px-5 pt-4 pb-2 space-y-3">
      {/* Total Balance — full-width bento, same chrome as Income/Expense
          below so all three read as one bento stack. Label + amount both
          centered for hierarchy: it's the headline number. */}
      <SurfaceCard className="px-4 py-3.5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
          {t("tx.totalBalance")}
        </p>
        <p
          className={cn(
            "mt-1.5 truncate text-[28px] font-semibold leading-tight tracking-tight tabular-nums",
            balance < 0 ? "text-[var(--color-expense)]" : "text-[var(--foreground)]"
          )}
        >
          {formatAmountWithSign(animatedBalance, currency)}
        </p>
      </SurfaceCard>

      {/* Income + Expense — 2-col bento row, unchanged */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryPill
          label={t("tx.income")}
          value={formatAmount(income, currency)}
          icon={<ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.5} />}
          tone="income"
        />
        <SummaryPill
          label={t("tx.expenses")}
          value={formatAmount(expenses, currency)}
          icon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
          tone="expense"
        />
      </div>
    </section>
  );
}

function SummaryPill({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "income" | "expense";
}) {
  const iconTint =
    tone === "income"
      ? "bg-[var(--tint-success-bg)] text-[var(--tint-success-text)]"
      : "bg-[var(--tint-warning-bg)] text-[var(--tint-warning-text)]";
  return (
    <SurfaceCard className="px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconTint}`}>
          {icon}
        </span>
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
          {label}
        </p>
      </div>
      <p className="mt-1.5 truncate text-[17px] font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
        {value}
      </p>
    </SurfaceCard>
  );
}
