"use client";

import { useState, useEffect, useRef, useMemo, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X, Check, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { TapLink } from "@/components/tap";
import BalanceCard from "@/components/balance-card";
import TransactionList from "@/components/transaction-list";
import AddTransactionSheet from "@/components/add-transaction-sheet";
import AddRecurringSheet from "@/components/add-recurring-sheet";
import RecurringItemList from "@/components/recurring-item-list";
import LedgerSwitcherSheet from "@/components/ledger-switcher-sheet";
import PullToRefresh from "@/components/pull-to-refresh";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import type { DbTransaction, DbCategory, DbMember, DbHouseholdMembership, DbRecurringItem } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type SubTab = "history" | "recurring";
type DateFilter = "all" | "30d" | "this_month" | "custom";

const PAGE_SIZE = 10;

function toInputDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inDateRange(txDate: string, filter: DateFilter, customStart: string, customEnd: string): boolean {
  if (filter === "all") return true;
  const [y, m, d] = txDate.split("-").map(Number);
  const tx = new Date(y, m - 1, d);
  const today = new Date();
  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (filter === "30d") {
    const start = new Date(todayNorm); start.setDate(start.getDate() - 29);
    return tx >= start && tx <= todayNorm;
  }
  if (filter === "this_month") {
    const start = new Date(todayNorm.getFullYear(), todayNorm.getMonth(), 1);
    return tx >= start && tx <= todayNorm;
  }
  if (filter === "custom" && customStart && customEnd) {
    const [sy, sm, sd] = customStart.split("-").map(Number);
    const [ey, em, ed] = customEnd.split("-").map(Number);
    return tx >= new Date(sy, sm - 1, sd) && tx <= new Date(ey, em - 1, ed);
  }
  return true;
}

type Props = {
  transactions: DbTransaction[];
  categories: DbCategory[];
  members: Record<string, DbMember>;
  householdName: string;
  householdId: string;
  householdSymbol: string;
  currency: string;
  balance: number;
  income: number;
  expenses: number;
  currentUser: { initials: string; avatar_color: string };
  memberships: DbHouseholdMembership[];
  recurringItems: DbRecurringItem[];
  iconStyle?: IconStyle;
};

export default function TransactionsShell({
  transactions,
  categories,
  members,
  householdName,
  householdId,
  householdSymbol,
  currency,
  balance,
  income,
  expenses,
  currentUser,
  memberships,
  recurringItems,
  iconStyle = "3d",
}: Props) {
  const t = useT();
  const [tab, setTab] = useState<SubTab>("history");

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [pendingDateFilter, setPendingDateFilter] = useState<DateFilter>("all");
  const today = new Date();
  const todayStr = toInputDate(today);
  const thirtyAgoStr = toInputDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));
  const [pendingCustomStart, setPendingCustomStart] = useState(thirtyAgoStr);
  const [pendingCustomEnd, setPendingCustomEnd] = useState(todayStr);

  // Applied filter state
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>("all");
  const [activeCustomStart, setActiveCustomStart] = useState(thirtyAgoStr);
  const [activeCustomEnd, setActiveCustomEnd] = useState(todayStr);

  // Pagination
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Transaction sheet
  const [showSheet, setShowSheet] = useState(false);
  const [editingTx, setEditingTx] = useState<DbTransaction | null>(null);

  // Recurring sheet
  const [showRecurringSheet, setShowRecurringSheet] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<DbRecurringItem | null>(null);

  // Ledger switcher
  const [showLedgerSwitcher, setShowLedgerSwitcher] = useState(false);

  // Extra categories added inline (optimistic)
  const [extraCategories, setExtraCategories] = useState<DbCategory[]>([]);
  const allCategories = [
    ...categories,
    ...extraCategories.filter((e) => !categories.find((c) => c.id === e.id)),
  ];

  const hasActiveFilter = activeCategories.length > 0 || activeDateFilter !== "all";

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (activeCategories.length > 0) {
      result = result.filter((t) => activeCategories.includes(t.category_id ?? ""));
    }
    if (activeDateFilter !== "all") {
      result = result.filter((t) => inDateRange(t.date, activeDateFilter, activeCustomStart, activeCustomEnd));
    }
    return result;
  }, [transactions, searchQuery, activeCategories, activeDateFilter, activeCustomStart, activeCustomEnd]);

  // Recalc balance when filters active
  const isFiltering = hasActiveFilter || searchQuery.trim().length > 0;
  const filteredIncome = isFiltering
    ? filteredTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
    : income;
  const filteredExpenses = isFiltering
    ? filteredTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
    : expenses;
  const filteredBalance = isFiltering
    ? filteredIncome - filteredExpenses
    : balance;

  // Reset pagination when filters change
  useEffect(() => { setDisplayCount(PAGE_SIZE); }, [filteredTransactions]);

  // Infinite scroll — scroll listener is more reliable than IntersectionObserver
  // because IO won't re-fire if element is already in view when re-observed
  const filteredLengthRef = useRef(filteredTransactions.length);
  filteredLengthRef.current = filteredTransactions.length;

  useEffect(() => {
    function handleScroll() {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 200) {
        setDisplayCount((prev) => {
          if (prev < filteredLengthRef.current) return prev + PAGE_SIZE;
          return prev;
        });
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // check immediately in case already in view
    return () => window.removeEventListener("scroll", handleScroll);
  }, [filteredTransactions.length]); // re-attach when filter changes

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  function openAdd() { setEditingTx(null); setShowSheet(true); }
  function openEdit(tx: DbTransaction) { setEditingTx(tx); setShowSheet(true); }
  function closeSheet() {
    setShowSheet(false);
    setEditingTx(null);
    if (typeof window !== "undefined" && window.location.search.includes("new=1")) {
      window.history.replaceState({}, "", "/transactions");
    }
  }

  function openAddRecurring() { setEditingRecurring(null); setShowRecurringSheet(true); }
  function openEditRecurring(item: DbRecurringItem) { setEditingRecurring(item); setShowRecurringSheet(true); }
  function closeRecurringSheet() { setShowRecurringSheet(false); setEditingRecurring(null); }

  function openFilter() {
    // Sync pending state with active
    setPendingCategories([...activeCategories]);
    setPendingDateFilter(activeDateFilter);
    setPendingCustomStart(activeCustomStart);
    setPendingCustomEnd(activeCustomEnd);
    setFilterOpen(true);
  }

  function applyFilter() {
    setActiveCategories(pendingCategories);
    setActiveDateFilter(pendingDateFilter);
    setActiveCustomStart(pendingCustomStart);
    setActiveCustomEnd(pendingCustomEnd);
    setFilterOpen(false);
  }

  function clearFilter() {
    setActiveCategories([]);
    setActiveDateFilter("all");
    setFilterOpen(false);
  }

  function toggleSearchOpen() {
    if (searchOpen) {
      setSearchQuery("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
    }
  }

  const displayedTransactions = filteredTransactions.slice(0, displayCount);
  const hasMore = displayCount < filteredTransactions.length;

  return (
    <>
      <PullToRefresh>
        <div>
          <header className="flex items-center justify-between px-5 pt-4">
            <TapLink
              href="/settings"
              aria-label="Profile and settings"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-95 transition-transform [touch-action:manipulation]"
              style={{ backgroundColor: currentUser.avatar_color }}
            >
              {currentUser.initials}
            </TapLink>

            <button
              onClick={() => setShowLedgerSwitcher(true)}
              className="flex flex-col items-center leading-tight active:opacity-70 transition-opacity"
            >
              <h1 className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">
                {householdSymbol} {householdName}
              </h1>
              <p className="text-[11px] text-[var(--label-secondary)]">{t("tx.tapToSwitch")} ›</p>
            </button>

            <div className="flex items-center gap-2">
              <IconButton ariaLabel="Search" active={searchOpen} onClick={toggleSearchOpen}>
                <Search className="h-[18px] w-[18px]" strokeWidth={2} />
              </IconButton>
              <IconButton ariaLabel="Filter" active={hasActiveFilter} onClick={openFilter}>
                <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
                {hasActiveFilter && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full bg-[var(--foreground)]" />
                )}
              </IconButton>
            </div>
          </header>

          {/* Search bar */}
          {searchOpen && (
            <div className="px-5 pt-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("filter.searchPlaceholder")}
                  className="h-10 w-full rounded-2xl bg-[var(--surface)] pl-9 pr-9 text-[14px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow placeholder:text-[var(--label-tertiary)]"
                />
                {searchQuery.length > 0 && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          <BalanceCard
            balance={filteredBalance}
            income={filteredIncome}
            expenses={filteredExpenses}
            currency={currency}
          />

          {/* Filter active banner */}
          {isFiltering && (
            <div className="mx-5 mb-1 flex items-center justify-between rounded-xl bg-[var(--foreground)]/[0.05] px-3.5 py-2">
              <p className="text-[12px] font-medium text-[var(--foreground)]">
                {filteredTransactions.length} result{filteredTransactions.length !== 1 ? "s" : ""} filtered
              </p>
              <button
                onClick={() => { setActiveCategories([]); setActiveDateFilter("all"); setSearchQuery(""); setSearchOpen(false); }}
                className="text-[12px] font-semibold text-[var(--foreground)]"
              >
                {t("common.clearAll")}
              </button>
            </div>
          )}

          <div className="px-5 pt-4">
            <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
              <TabButton active={tab === "history"} onClick={() => setTab("history")}>
                {t("tx.history")}
              </TabButton>
              <TabButton active={tab === "recurring"} onClick={() => setTab("recurring")}>
                <span className="inline-flex items-center gap-1.5">
                  {t("tx.recurring")}
                  {recurringItems.length > 0 && (
                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--foreground)]/10 px-1 text-[10px] font-semibold text-[var(--foreground)]">
                      {recurringItems.length}
                    </span>
                  )}
                  {tab === "recurring" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openAddRecurring(); }}
                      aria-label={t("recurring.addNew")}
                      className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--foreground)] text-white active:scale-95 transition-transform"
                    >
                      <Plus className="h-3 w-3" strokeWidth={3} />
                    </button>
                  )}
                </span>
              </TabButton>
            </div>
          </div>

          <div className="pt-3 pb-24">
            {tab === "history" ? (
              <>
                <TransactionList
                  transactions={displayedTransactions}
                  members={members}
                  currency={currency}
                  iconStyle={iconStyle}
                  onTap={openEdit}
                />
                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-1" />
                {hasMore && (
                  <p className="py-4 text-center text-[12px] text-[var(--label-tertiary)]">Loading more…</p>
                )}
              </>
            ) : (
              <RecurringItemList
                items={recurringItems}
                currency={currency}
                iconStyle={iconStyle}
                onTap={openEditRecurring}
                onAdd={openAddRecurring}
              />
            )}
          </div>
        </div>
      </PullToRefresh>

      <AddTransactionSheet
        open={showSheet}
        onClose={closeSheet}
        categories={allCategories}
        editing={editingTx}
        currency={currency}
        memberships={memberships}
        currentHouseholdId={householdId}
        iconStyle={iconStyle}
      />

      <AddRecurringSheet
        open={showRecurringSheet}
        onClose={closeRecurringSheet}
        categories={allCategories}
        editing={editingRecurring}
        currency={currency}
        onCategoryAdded={(cat) => setExtraCategories((prev) => [...prev, cat])}
        iconStyle={iconStyle}
      />

      {showLedgerSwitcher && (
        <LedgerSwitcherSheet
          memberships={memberships}
          currentHouseholdId={householdId}
          onClose={() => setShowLedgerSwitcher(false)}
        />
      )}

      <Suspense>
        <SheetOpener onOpen={openAdd} />
      </Suspense>

      {/* Filter Sheet */}
      {filterOpen && (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-[2px]"
            onClick={() => setFilterOpen(false)}
          />
          <div className="fixed bottom-0 left-1/2 z-[60] w-full max-w-md -translate-x-1/2 rounded-t-3xl bg-[var(--background)] shadow-2xl max-h-[75vh] flex flex-col">
            <FilterSheet
              categories={allCategories}
              pendingCategories={pendingCategories}
              setPendingCategories={setPendingCategories}
              pendingDateFilter={pendingDateFilter}
              setPendingDateFilter={setPendingDateFilter}
              pendingCustomStart={pendingCustomStart}
              setPendingCustomStart={setPendingCustomStart}
              pendingCustomEnd={pendingCustomEnd}
              setPendingCustomEnd={setPendingCustomEnd}
              todayStr={todayStr}
              hasActive={hasActiveFilter}
              onApply={applyFilter}
              onClear={clearFilter}
              onClose={() => setFilterOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}

// ─── Filter Sheet ──────────────────────────────────────────────────────────

type FilterSheetProps = {
  categories: DbCategory[];
  pendingCategories: string[];
  setPendingCategories: (v: string[]) => void;
  pendingDateFilter: DateFilter;
  setPendingDateFilter: (v: DateFilter) => void;
  pendingCustomStart: string;
  setPendingCustomStart: (v: string) => void;
  pendingCustomEnd: string;
  setPendingCustomEnd: (v: string) => void;
  todayStr: string;
  hasActive: boolean;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
};

function FilterSheet({
  categories, pendingCategories, setPendingCategories,
  pendingDateFilter, setPendingDateFilter,
  pendingCustomStart, setPendingCustomStart,
  pendingCustomEnd, setPendingCustomEnd,
  todayStr, hasActive, onApply, onClear,
}: FilterSheetProps) {
  const t = useT();

  function toggleCategory(id: string) {
    setPendingCategories(
      pendingCategories.includes(id)
        ? pendingCategories.filter((c) => c !== id)
        : [...pendingCategories, id]
    );
  }

  const DATE_OPTIONS: { key: DateFilter; label: string }[] = [
    { key: "all", label: t("filter.allTime") },
    { key: "30d", label: t("filter.last30") },
    { key: "this_month", label: t("filter.thisMonth") },
    { key: "custom", label: t("filter.custom") },
  ];

  return (
    <>
      {/* Fixed header */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/[0.12]" />
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">{t("filter.title")}</h2>
          {hasActive && (
            <button onClick={onClear} className="text-[13px] font-semibold text-rose-500">
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5">
        {/* Date filter */}
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">Date</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {DATE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPendingDateFilter(key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition-all",
                pendingDateFilter === key
                  ? "bg-[var(--foreground)] text-white ring-[var(--foreground)]"
                  : "bg-[var(--surface)] text-[var(--foreground)] ring-black/[0.08]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {pendingDateFilter === "custom" && (
          <div className="mb-4 flex gap-3">
            <div className="flex-1">
              <p className="mb-1 text-[11px] font-medium text-[var(--label-tertiary)]">From</p>
              <input
                type="date"
                value={pendingCustomStart}
                max={pendingCustomEnd}
                onChange={(e) => setPendingCustomStart(e.target.value)}
                className="w-full rounded-xl bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08]"
              />
            </div>
            <div className="flex-1">
              <p className="mb-1 text-[11px] font-medium text-[var(--label-tertiary)]">To</p>
              <input
                type="date"
                value={pendingCustomEnd}
                min={pendingCustomStart}
                max={todayStr}
                onChange={(e) => setPendingCustomEnd(e.target.value)}
                className="w-full rounded-xl bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08]"
              />
            </div>
          </div>
        )}

        {/* Category filter */}
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">Category</p>
        <div className="flex flex-wrap gap-2 pb-4">
          {categories.map((cat) => {
            const selected = pendingCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-all",
                  selected
                    ? "text-white ring-transparent"
                    : "bg-[var(--surface)] text-[var(--foreground)] ring-black/[0.08]"
                )}
                style={selected ? { backgroundColor: cat.color } : undefined}
              >
                <span>{cat.symbol}</span>
                {cat.name}
                {selected && <Check className="h-3 w-3 ml-0.5" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky Apply button — always visible above safe area */}
      <div className="shrink-0 px-5 pt-3 pb-8 border-t border-[var(--separator)]">
        <button
          onClick={onApply}
          className="w-full h-12 rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-white"
        >
          Apply Filter
        </button>
      </div>
    </>
  );
}

// ─── Supporting components ─────────────────────────────────────────────────

function SheetOpener({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  // URL-based trigger (arriving from another page via ?new=1)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      onOpenRef.current();
      window.history.replaceState({}, "", "/transactions");
    }
  }, [searchParams]);

  // In-page trigger (from the "+" button in BottomNav)
  useEffect(() => {
    const handler = () => onOpenRef.current();
    window.addEventListener("fl:open-add-transaction", handler);
    return () => window.removeEventListener("fl:open-add-transaction", handler);
  }, []);

  return null;
}

function IconButton({
  children,
  ariaLabel,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-full ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-all",
        active
          ? "bg-[var(--foreground)] text-white ring-[var(--foreground)]/20"
          : "bg-[var(--surface)] text-[var(--foreground)] ring-black/[0.05]"
      )}
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center rounded-full px-3 py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
        active
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
          : "text-[var(--label-secondary)]"
      )}
    >
      {children}
    </button>
  );
}
