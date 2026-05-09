"use client";

import { useEffect, useRef, useState } from "react";
import { formatAmount, formatAmountWithSign } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

type Props = {
  balance: number;
  income: number;
  expenses: number;
  currency?: string;
};

function useCountUp(target: number, duration = 1100) {
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
      // easeOutQuart — slower start, smoother arrival than ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 4);
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
    <section className="px-5 pt-6 pb-2">
      <div className="flex flex-col items-center text-center">
        <p className="text-[13px] font-medium tracking-wide text-[var(--label-secondary)]">
          {t("tx.totalBalance")}
        </p>
        <p
          className={cn(
            "mt-1.5 text-[40px] font-semibold leading-tight tracking-tight tabular-nums",
            balance < 0 ? "text-rose-600" : "text-[var(--foreground)]"
          )}
        >
          {formatAmountWithSign(animatedBalance, currency)}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
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
  const iconBg = tone === "income" ? "bg-emerald-100/70 text-emerald-700" : "bg-amber-100/70 text-amber-800";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-3.5 py-3 ring-1 ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">
          {label}
        </p>
        <p className="truncate text-[15px] font-semibold tracking-tight text-[var(--foreground)] tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}
