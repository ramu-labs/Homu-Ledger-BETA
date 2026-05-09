"use client";

import { useEffect, useRef, useState } from "react";
import { X, Trash2, ChevronRight } from "lucide-react";
import { addRecurringItem, updateRecurringItem, deleteRecurringItem } from "@/app/actions/recurring";
import CategoryPicker from "@/components/category-picker";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import { useT, useLang } from "@/lib/i18n/provider";
import type { DbRecurringItem, DbCategory, RecurringFrequency } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type RepeatUntilMode = "forever" | "date";

function todayString() {
  return new Date().toISOString().split("T")[0];
}

type Props = {
  open: boolean;
  onClose: () => void;
  categories: DbCategory[];
  editing?: DbRecurringItem | null;
  currency?: string;
  onCategoryAdded: (cat: DbCategory) => void;
  iconStyle?: IconStyle;
};

export default function AddRecurringSheet({
  open,
  onClose,
  categories,
  editing,
  currency = "IDR",
  onCategoryAdded,
  iconStyle = "3d",
}: Props) {
  const t = useT();
  const lang = useLang();
  const FREQUENCIES: { key: RecurringFrequency; label: string }[] = [
    { key: "weekly", label: t("recurring.weekly") },
    { key: "monthly", label: t("recurring.monthly") },
    { key: "yearly", label: t("recurring.yearly") },
  ];
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [repeatUntilMode, setRepeatUntilMode] = useState<RepeatUntilMode>("forever");
  const [repeatUntilDate, setRepeatUntilDate] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const scrollYRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while sheet is open (iOS Safari requires position:fixed),
  // and explicitly block any touchmove that escapes the sheet — this is what
  // prevents the page underneath from scrolling on iOS PWAs even when body
  // lock is in place.
  useEffect(() => {
    if (!open) return;

    scrollYRef.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = "100%";

    function onTouchMove(e: TouchEvent) {
      const sheet = sheetRef.current;
      if (!sheet) { e.preventDefault(); return; }
      if (!sheet.contains(e.target as Node)) { e.preventDefault(); return; }
      const scrollable = (e.target as Element)?.closest?.("[data-scroll]");
      if (!scrollable) e.preventDefault();
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollYRef.current);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setAmount(String(Math.round(Number(editing.amount))));
      setName(editing.name);
      setCategoryId(editing.category_id);
      setFrequency(editing.frequency);
      setNextDueDate(editing.next_due_date ?? todayString());
      if (editing.repeat_until) {
        setRepeatUntilMode("date");
        setRepeatUntilDate(editing.repeat_until);
      } else {
        setRepeatUntilMode("forever");
        setRepeatUntilDate("");
      }
    } else {
      setType("expense");
      setAmount("");
      setName("");
      setCategoryId(null);
      setFrequency("monthly");
      setNextDueDate(todayString());
      setRepeatUntilMode("forever");
      setRepeatUntilDate("");
    }
    setError(null);
    setLoading(false);
  }, [open, editing]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(e.target.value.replace(/\D/g, ""));
  }

  const amountDisplay = amount ? amount.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";

  // Auto-advance next_due_date when frequency = monthly and date already set
  function handleNextDueDateChange(val: string) {
    setNextDueDate(val);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", amount);
    fd.set("name", name);
    fd.set("category_id", categoryId ?? "");
    fd.set("frequency", frequency);
    fd.set("next_due_date", nextDueDate);
    fd.set("repeat_until", repeatUntilMode === "date" ? repeatUntilDate : "");

    const result = editing
      ? await updateRecurringItem(editing.id, fd)
      : await addRecurringItem(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setLoading(true);
    await deleteRecurringItem(editing.id);
    onClose();
  }

  // Preview label: what the monthly cadence looks like
  const monthlyDayLabel = (() => {
    if (frequency !== "monthly" || !nextDueDate) return null;
    const day = parseInt(nextDueDate.split("-")[2]);
    if (lang === "id") {
      return `${t("recurring.repeatsOnThe")} ${day} ${t("recurring.ofEveryMonth")}`;
    }
    return `${t("recurring.repeatsOnThe")} ${ordinal(day)} ${t("recurring.ofEveryMonth")}`;
  })();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 transition-opacity duration-[420ms]",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        className={cn(
          "fixed inset-y-0 left-1/2 z-[70] w-full max-w-md -translate-x-1/2 flex flex-col rounded-t-3xl bg-[var(--surface)] [touch-action:pan-y]",
          "transition-transform duration-[420ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-y-0" : "translate-y-full"
        )}
        // Respect the iPhone Dynamic Island / status bar at the top so the
        // close button is reachable. Bottom padding is applied on the footer
        // itself so the submit button sits a sensible distance above the
        // home indicator. Use inset-y-0 (top:0 bottom:0) instead of
        // bottom-0 + h-dvh so the sheet always reaches the physical bottom
        // of the screen — h-dvh on iOS PWA standalone can report shorter
        // than the full viewport, leaving a strip of page background
        // visible underneath.
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">
            {editing ? t("recurring.edit") : t("recurring.add")}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div data-scroll className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">

            {/* Type toggle */}
            <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
              {(["expense", "income"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setType(opt)}
                  className={cn(
                    "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                    type === opt && opt === "expense"
                      ? "bg-rose-500 text-white shadow-sm"
                      : type === opt && opt === "income"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-[var(--label-secondary)]"
                  )}
                >
                  {opt === "expense" ? t("tx.expense") : t("tx.incomeShort")}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {t("tx.amount")} ({currency})
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amountDisplay}
                onChange={handleAmountChange}
                placeholder="0"
                required
                className="h-14 w-full rounded-2xl bg-[var(--background)] px-4 text-center text-[24px] font-semibold text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {t("tx.description")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("recurring.namePlaceholder")}
                required
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {t("tx.category")}
              </label>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
              >
                {selectedCategory ? (
                  <>
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${selectedCategory.color}22` }}
                    >
                      <CategoryIcon
                        symbol={selectedCategory.symbol}
                        iconStyle={iconStyle}
                        size={16}
                        emojiSize="16px"
                        color={iconStyle === "2d" ? selectedCategory.color : undefined}
                      />
                    </span>
                    <span className="flex-1 text-left text-[15px] font-medium text-[var(--foreground)]">
                      {selectedCategory.name}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-left text-[15px] text-[var(--label-tertiary)]">
                    {t("tx.selectCategory")}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
              </button>
            </div>

            {/* Frequency */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {t("recurring.frequency")}
              </label>
              <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
                {FREQUENCIES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFrequency(key)}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                      frequency === key
                        ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                        : "text-[var(--label-secondary)]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Starting / next due date */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {frequency === "monthly" ? t("recurring.startingDate") : t("recurring.nextDueDate")}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-0 flex items-center px-4">
                  <span className="text-[15px] font-medium text-[var(--foreground)]">
                    {nextDueDate
                      ? formatShortDate(nextDueDate)
                      : <span className="text-[var(--label-tertiary)]">{t("recurring.pickDate")}</span>
                    }
                  </span>
                </div>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => handleNextDueDateChange(e.target.value)}
                  className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-transparent outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow [color-scheme:light]"
                />
              </div>
              {monthlyDayLabel && (
                <p className="mt-1.5 px-1 text-[12px] text-[var(--label-secondary)]">
                  🔁 {monthlyDayLabel}
                </p>
              )}
            </div>

            {/* Repeat until */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {t("recurring.repeatUntil")}
              </label>
              <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
                <button
                  type="button"
                  onClick={() => setRepeatUntilMode("forever")}
                  className={cn(
                    "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                    repeatUntilMode === "forever"
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--label-secondary)]"
                  )}
                >
                  {t("recurring.forever")}
                </button>
                <button
                  type="button"
                  onClick={() => setRepeatUntilMode("date")}
                  className={cn(
                    "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                    repeatUntilMode === "date"
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--label-secondary)]"
                  )}
                >
                  {t("recurring.onDate")}
                </button>
              </div>

              {repeatUntilMode === "date" && (
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-0 flex items-center px-4">
                    <span className="text-[15px] font-medium text-[var(--foreground)]">
                      {repeatUntilDate
                        ? formatShortDate(repeatUntilDate)
                        : <span className="text-[var(--label-tertiary)]">{t("recurring.pickEndDate")}</span>
                      }
                    </span>
                  </div>
                  <input
                    type="date"
                    value={repeatUntilDate}
                    onChange={(e) => setRepeatUntilDate(e.target.value)}
                    min={nextDueDate || undefined}
                    className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-transparent outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow [color-scheme:light]"
                  />
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}
          </div>

          <div
            className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-3 space-y-2"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <button
              type="submit"
              disabled={loading}
              className="flex h-13 w-full items-center justify-center rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {loading ? t("common.saving") : editing ? t("common.saveChanges") : t("recurring.addNew")}
            </button>
            {editing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium text-rose-600 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                {t("recurring.deleteItem")}
              </button>
            )}
          </div>
        </form>
      </div>

      {showCategoryPicker && (
        <CategoryPicker
          categories={categories}
          selected={categoryId}
          onSelect={setCategoryId}
          onClose={() => setShowCategoryPicker(false)}
          onCategoryAdded={onCategoryAdded}
          iconStyle={iconStyle}
        />
      )}
    </>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
