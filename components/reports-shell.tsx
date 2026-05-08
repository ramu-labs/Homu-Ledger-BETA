"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Wallet as WalletIcon, Check } from "lucide-react";
import PullToRefresh from "@/components/pull-to-refresh";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/cn";
import { TapButton } from "@/components/tap";
import { formatAmount } from "@/lib/format";
import { CategoryIcon } from "@/components/category-icon";
import type { DbTransaction, DbCategory, DbMember, DbWallet } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Period = "7d" | "30d" | "Last month" | "This month" | "custom";
type TxType = "expenses" | "income";
type Breakdown = "category" | "member";

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d",         label: "Last 7 days" },
  { key: "30d",        label: "Last 30 days" },
  { key: "Last month", label: "Last month" },
  { key: "This month", label: "This month" },
  { key: "custom",     label: "Custom" },
];

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPeriodRange(period: Period): { start: Date; end: Date } {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (period) {
    case "7d": { const s = new Date(end); s.setDate(s.getDate() - 6); return { start: s, end }; }
    case "30d": { const s = new Date(end); s.setDate(s.getDate() - 29); return { start: s, end }; }
    case "Last month": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: s, end: e };
    }
    default: {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: s, end };
    }
  }
}

function formatDateRange(start: Date, end: Date): string {
  const s = `${SHORT_MONTHS[start.getMonth()]} ${start.getDate()}`;
  const e = `${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${s} – ${e}`;
}

function txInRange(tx: DbTransaction, start: Date, end: Date): boolean {
  const [y, m, d] = tx.date.split("-").map(Number);
  const txDate = new Date(y, m - 1, d);
  return txDate >= start && txDate <= end;
}

function shortAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

type Props = {
  transactions: DbTransaction[];
  categories: DbCategory[];
  wallets: DbWallet[];
  members: Record<string, DbMember>;
  currency: string;
  iconStyle?: IconStyle;
};

export default function ReportsShell({ transactions, categories, wallets, members, currency, iconStyle = "3d" }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [showDropdown, setShowDropdown] = useState(false);
  const [txType, setTxType] = useState<TxType>("expenses");
  const [breakdown, setBreakdown] = useState<Breakdown>("category");
  // Empty array = All wallets (no filter). Otherwise the report is scoped
  // to transactions whose `wallet_id` is in this set. Using string[] (not
  // Set) keeps render comparisons cheap and JSON-serialisable in case we
  // later persist this filter in URL params or localStorage.
  const [walletIds, setWalletIds] = useState<string[]>([]);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const walletDropdownRef = useRef<HTMLDivElement>(null);

  function toggleWallet(id: string) {
    setWalletIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const today = new Date();
  const todayStr = toDateInputValue(today);
  const thirtyAgo = new Date(today); thirtyAgo.setDate(thirtyAgo.getDate() - 29);
  const [customStart, setCustomStart] = useState(toDateInputValue(thirtyAgo));
  const [customEnd, setCustomEnd] = useState(todayStr);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node))
        setShowWalletDropdown(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedWallets = wallets.filter((w) => walletIds.includes(w.id));
  const selectedWalletLabel = (() => {
    if (selectedWallets.length === 0) return "All";
    if (selectedWallets.length === 1) return selectedWallets[0].name;
    if (selectedWallets.length === wallets.length) return "All";
    return `${selectedWallets.length} wallets`;
  })();

  const { start, end } = period === "custom"
    ? (() => {
        const [sy, sm, sd] = customStart.split("-").map(Number);
        const [ey, em, ed] = customEnd.split("-").map(Number);
        return { start: new Date(sy, sm - 1, sd), end: new Date(ey, em - 1, ed) };
      })()
    : getPeriodRange(period);
  const rangeLabel = formatDateRange(start, end);

  // Filter by selected wallets first (empty list = no filter, show all),
  // then by the selected period. Doing it in this order means every
  // downstream calculation — income/expenses cards, daily trend, donut
  // breakdown, category list, member list — automatically respects the
  // wallet filter without us having to thread `walletIds` through each
  // useMemo.
  const periodTx = transactions
    .filter((t) => walletIds.length === 0 || (t.wallet_id != null && walletIds.includes(t.wallet_id)))
    .filter((t) => txInRange(t, start, end));
  const income   = periodTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net      = income - expenses;

  const activeTx   = periodTx.filter((t) => t.type === (txType === "expenses" ? "expense" : "income"));
  const grandTotal = activeTx.reduce((s, t) => s + t.amount, 0);

  // --- Trend bar chart data (daily) ---
  const trendData = useMemo(() => {
    const days: { label: string; amount: number }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear(), m = cur.getMonth() + 1, d = cur.getDate();
      const amount = activeTx
        .filter((t) => { const [ty,tm,td] = t.date.split("-").map(Number); return ty===y && tm===m && td===d; })
        .reduce((s, t) => s + t.amount, 0);
      days.push({ label: String(d), amount });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, txType, transactions, customStart, customEnd, walletIds]);

  const barColor = txType === "expenses" ? "#f43f5e" : "#10b981";

  // --- By category ---
  const byCategory = categories
    .map((c) => ({ ...c, total: activeTx.filter((t) => t.category_id === c.id).reduce((s,t) => s+t.amount, 0) }))
    .filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const uncategorizedTotal = activeTx
    .filter((t) => !t.category_id || !categories.find((c) => c.id === t.category_id))
    .reduce((s, t) => s + t.amount, 0);

  // --- By member ---
  const byMember = Object.values(members)
    .map((m) => ({ ...m, total: activeTx.filter((t) => t.created_by === m.id).reduce((s,t) => s+t.amount, 0) }))
    .filter((m) => m.total > 0).sort((a, b) => b.total - a.total);

  const unassignedTotal = activeTx
    .filter((t) => !t.created_by || !members[t.created_by])
    .reduce((s, t) => s + t.amount, 0);

  // --- Donut data ---
  const donutData = useMemo(() => {
    if (breakdown === "category") {
      const slices = byCategory.map((c) => ({ name: c.name, value: c.total, color: c.color }));
      if (uncategorizedTotal > 0) slices.push({ name: "Uncategorized", value: uncategorizedTotal, color: "#d1d5db" });
      return slices;
    } else {
      const slices = byMember.map((m) => ({ name: m.name, value: m.total, color: m.avatar_color }));
      if (unassignedTotal > 0) slices.push({ name: "Unassigned", value: unassignedTotal, color: "#d1d5db" });
      return slices;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, byCategory, byMember, uncategorizedTotal, unassignedTotal]);

  const hasData = grandTotal > 0;

  return (
    <PullToRefresh>
    <div className="pb-10">
      {/* Sticky header — three columns:
          LEFT  : wallet filter (defaults to "All")
          MIDDLE: current date range label
          RIGHT : period dropdown
          The middle column gets `flex-1` and `text-center` so the date
          stays visually centred regardless of the side button widths. */}
      <header className="sticky top-0 z-10 bg-[var(--background)]/85 px-5 pt-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {/* LEFT — wallet filter (multi-select) */}
          <div className="relative shrink-0" ref={walletDropdownRef}>
            <TapButton
              onTap={() => setShowWalletDropdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.06] shadow-sm [touch-action:manipulation]"
              aria-label="Filter by wallet"
            >
              {selectedWallets.length === 1 ? (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: selectedWallets[0].color }}
                >
                  <CategoryIcon
                    symbol={selectedWallets[0].symbol}
                    iconStyle={iconStyle}
                    size={11}
                    emojiSize="11px"
                    color="#ffffff"
                  />
                </span>
              ) : (
                <WalletIcon className="h-4 w-4 text-[var(--label-secondary)]" strokeWidth={2} />
              )}
              <span className="max-w-[100px] truncate">{selectedWalletLabel}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-[var(--label-secondary)] transition-transform",
                  showWalletDropdown && "rotate-180",
                )}
                strokeWidth={2.5}
              />
            </TapButton>
            {showWalletDropdown && (
              <div className="absolute left-0 top-full mt-2 w-60 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-xl ring-1 ring-black/[0.08] z-20">
                {/* "All wallets" — clears the multi-select. Tapping this
                    closes the dropdown because the user has expressed
                    a final choice. Per-wallet rows below DON'T close the
                    dropdown so the user can rapidly toggle several. */}
                <TapButton
                  onTap={() => {
                    setWalletIds([]);
                    setShowWalletDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-4 py-3 text-[14px] transition-colors [touch-action:manipulation]",
                    walletIds.length === 0
                      ? "bg-black/[0.03] font-semibold text-[var(--foreground)]"
                      : "font-medium text-[var(--label-secondary)] active:bg-black/[0.02]",
                  )}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.06]">
                    <WalletIcon className="h-[14px] w-[14px] text-[var(--label-secondary)]" strokeWidth={2} />
                  </span>
                  <span className="flex-1 text-left">All wallets</span>
                  {walletIds.length === 0 && (
                    <Check className="h-4 w-4 text-[var(--foreground)]" strokeWidth={2.5} />
                  )}
                </TapButton>
                {wallets.length > 0 && (
                  <div className="border-t border-[var(--separator)]" />
                )}
                {wallets.map((w) => {
                  const isSel = walletIds.includes(w.id);
                  return (
                    <TapButton
                      key={w.id}
                      onTap={() => toggleWallet(w.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-3 text-[14px] transition-colors [touch-action:manipulation]",
                        isSel
                          ? "bg-black/[0.03] font-semibold text-[var(--foreground)]"
                          : "font-medium text-[var(--label-secondary)] active:bg-black/[0.02]",
                      )}
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: w.color }}
                      >
                        <CategoryIcon
                          symbol={w.symbol}
                          iconStyle={iconStyle}
                          size={13}
                          emojiSize="13px"
                          color="#ffffff"
                        />
                      </span>
                      <span className="flex-1 truncate text-left">{w.name}</span>
                      {/* Checkbox-style indicator — filled when selected,
                          outline when not, so it's obvious this is a
                          toggle rather than a single-select radio. */}
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md ring-1 transition-colors",
                          isSel
                            ? "bg-[var(--foreground)] text-white ring-[var(--foreground)]"
                            : "bg-transparent text-transparent ring-black/[0.15]",
                        )}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    </TapButton>
                  );
                })}
              </div>
            )}
          </div>

          {/* MIDDLE — date range label, centred */}
          <p className="flex-1 truncate text-center text-[15px] font-semibold text-[var(--foreground)]">
            {rangeLabel}
          </p>

          {/* RIGHT — period dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <TapButton
              onTap={() => setShowDropdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.06] shadow-sm [touch-action:manipulation]"
            >
              {PERIODS.find((p) => p.key === period)?.label ?? period}
              <ChevronDown className={cn("h-3.5 w-3.5 text-[var(--label-secondary)] transition-transform", showDropdown && "rotate-180")} strokeWidth={2.5} />
            </TapButton>
            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-xl ring-1 ring-black/[0.08] z-20">
                {PERIODS.map(({ key, label }) => (
                  <TapButton key={key} onTap={() => { setPeriod(key); if (key !== "custom") setShowDropdown(false); }}
                    className={cn("flex w-full items-center px-4 py-3 text-[14px] transition-colors [touch-action:manipulation]",
                      key === period ? "font-semibold text-[var(--foreground)] bg-black/[0.03]" : "font-medium text-[var(--label-secondary)] active:bg-black/[0.02]"
                    )}
                  >{label}</TapButton>
                ))}
                {period === "custom" && (
                  <div className="border-t border-[var(--separator)] px-4 py-3 space-y-2">
                    <div>
                      <p className="text-[11px] font-medium text-[var(--label-tertiary)] mb-1">From</p>
                      <input
                        type="date"
                        value={customStart}
                        max={customEnd}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full rounded-xl bg-black/[0.04] px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.06] focus:ring-[var(--foreground)]/20"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[var(--label-tertiary)] mb-1">To</p>
                      <input
                        type="date"
                        value={customEnd}
                        min={customStart}
                        max={todayStr}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full rounded-xl bg-black/[0.04] px-3 py-1.5 text-[13px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.06] focus:ring-[var(--foreground)]/20"
                      />
                    </div>
                    <button
                      onClick={() => setShowDropdown(false)}
                      className="w-full rounded-xl bg-[var(--foreground)] py-2 text-[13px] font-semibold text-white"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-3 gap-2 px-5 pt-3">
        <SummaryCell label="Income"   value={formatAmount(income,   currency)} tone="good" />
        <SummaryCell label="Expenses" value={formatAmount(expenses, currency)} tone="bad" />
        <SummaryCell label="Net"      value={formatAmount(net,      currency)} tone={net >= 0 ? "good" : "bad"} />
      </section>

      {/* Expense / Income toggle */}
      <div className="px-5 pt-4">
        <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
          <TabBtn active={txType === "expenses"} onClick={() => setTxType("expenses")}>Expenses</TabBtn>
          <TabBtn active={txType === "income"}   onClick={() => setTxType("income")}>Income</TabBtn>
        </div>
      </div>

      {/* Daily bar chart */}
      <div className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] px-2 pt-4 pb-2">
        <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          Daily trend
        </p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={trendData} barSize={trendData.length > 20 ? 6 : 10} margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--label-tertiary)" }}
              axisLine={false}
              tickLine={false}
              interval={trendData.length > 20 ? 4 : trendData.length > 10 ? 2 : 0}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)", radius: 4 }}
              contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", fontSize: 13 }}
              formatter={(v) => [formatAmount((v as number) ?? 0, currency), txType === "expenses" ? "Expenses" : "Income"]}
            />
            <Bar dataKey="amount" fill={barColor} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By Category / By Member sub-tabs */}
      <div className="px-5 pt-4">
        <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
          <TabBtn active={breakdown === "category"} onClick={() => setBreakdown("category")}>By Category</TabBtn>
          <TabBtn active={breakdown === "member"}   onClick={() => setBreakdown("member")}>By Member</TabBtn>
        </div>
      </div>

      {!hasData ? (
        <div className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-black/[0.04]">
          <p className="text-[15px] font-medium text-[var(--foreground)]">No {txType} in this period</p>
          <p className="mt-1 text-[13px] text-[var(--label-secondary)]">Try selecting a different date range</p>
        </div>
      ) : (
        <>
          {/* Donut chart */}
          <div className="flex flex-col items-center pt-4">
            <div className="relative">
              <PieChart width={220} height={220}>
                <Pie
                  data={donutData}
                  cx={110} cy={110}
                  innerRadius={68} outerRadius={100}
                  paddingAngle={donutData.length > 1 ? 2 : 0}
                  dataKey="value"
                  strokeWidth={0}
                  startAngle={90} endAngle={-270}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[11px] text-[var(--label-secondary)]">{txType === "expenses" ? "Spent" : "Earned"}</p>
                <p className="text-[16px] font-bold text-[var(--foreground)] tabular-nums">{shortAmount(grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* Breakdown list */}
          {breakdown === "category" ? (
            <div className="px-5 pt-3 pb-6">
              <ul className="overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
                {byCategory.map((c) => {
                  const pct = grandTotal > 0 ? (c.total / grandTotal) * 100 : 0;
                  return (
                    <li key={c.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full text-base" style={{ backgroundColor: `${c.color}1A` }}>
                            <CategoryIcon symbol={c.symbol} iconStyle={iconStyle} size={16} emojiSize="16px" color={iconStyle === "2d" ? c.color : undefined} />
                          </span>
                          <div>
                            <p className="text-[14px] font-medium text-[var(--foreground)]">{c.name}</p>
                            <p className="text-[11px] text-[var(--label-secondary)]">{pct.toFixed(1)}%</p>
                          </div>
                        </div>
                        <p className="text-[14px] font-semibold tabular-nums text-[var(--foreground)]">{formatAmount(c.total, currency)}</p>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                      </div>
                    </li>
                  );
                })}
                {uncategorizedTotal > 0 && (
                  <li className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full text-base bg-black/[0.05]">📋</span>
                        <div>
                          <p className="text-[14px] font-medium text-[var(--foreground)]">Uncategorized</p>
                          <p className="text-[11px] text-[var(--label-secondary)]">{((uncategorizedTotal / grandTotal) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                      <p className="text-[14px] font-semibold tabular-nums text-[var(--foreground)]">{formatAmount(uncategorizedTotal, currency)}</p>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-[var(--label-tertiary)]" style={{ width: `${(uncategorizedTotal / grandTotal) * 100}%` }} />
                    </div>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="px-5 pt-3 pb-6">
              <ul className="overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
                {byMember.map((m) => {
                  const pct = grandTotal > 0 ? (m.total / grandTotal) * 100 : 0;
                  return (
                    <li key={m.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ backgroundColor: m.avatar_color }}>{m.initials}</span>
                          <div>
                            <p className="text-[14px] font-medium text-[var(--foreground)]">{m.name}</p>
                            <p className="text-[11px] text-[var(--label-secondary)]">{pct.toFixed(1)}%</p>
                          </div>
                        </div>
                        <p className="text-[14px] font-semibold tabular-nums text-[var(--foreground)]">{formatAmount(m.total, currency)}</p>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: m.avatar_color }} />
                      </div>
                    </li>
                  );
                })}
                {unassignedTotal > 0 && (
                  <li className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full text-base bg-black/[0.05]">?</span>
                        <div>
                          <p className="text-[14px] font-medium text-[var(--foreground)]">Unassigned</p>
                          <p className="text-[11px] text-[var(--label-secondary)]">{((unassignedTotal / grandTotal) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                      <p className="text-[14px] font-semibold tabular-nums text-[var(--foreground)]">{formatAmount(unassignedTotal, currency)}</p>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-[var(--label-tertiary)]" style={{ width: `${(unassignedTotal / grandTotal) * 100}%` }} />
                    </div>
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
    </PullToRefresh>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-rose-700" : "text-[var(--foreground)]";
  return (
    <div className="rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-black/[0.04]">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--label-tertiary)]">{label}</p>
      <p className={cn("mt-1 text-[12px] font-semibold tabular-nums tracking-tight", color)}>{value}</p>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <TapButton onTap={onClick}
      className={cn("flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all min-h-[32px] [touch-action:manipulation]",
        active ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--label-secondary)]"
      )}
    >
      {children}
    </TapButton>
  );
}
