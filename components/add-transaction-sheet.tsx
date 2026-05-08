"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, Camera, ImagePlus, ChevronRight, ArrowRightLeft, Check, Calendar, Repeat } from "lucide-react";
import { addTransaction, updateTransaction, deleteTransaction, moveTransaction, addTransfer } from "@/app/actions/transactions";
import { addRecurringItem } from "@/app/actions/recurring";
import CategoryPicker from "@/components/category-picker";
import WalletPickerSheet from "@/components/wallet-picker-sheet";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { formatShortDate } from "@/lib/format";
import { uploadTransactionPhoto } from "@/lib/upload-photo";
import type { DbTransaction, DbCategory, DbWallet, DbHouseholdMembership } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type Props = {
  open: boolean;
  onClose: () => void;
  categories: DbCategory[];
  wallets: DbWallet[];
  onWalletAdded?: (w: DbWallet) => void;
  editing?: DbTransaction | null;
  currency?: string;
  memberships?: DbHouseholdMembership[];
  currentHouseholdId?: string;
  iconStyle?: IconStyle;
};

function todayString() {
  return new Date().toISOString().split("T")[0];
}

export default function AddTransactionSheet({ open, onClose, categories, wallets, onWalletAdded, editing, currency = "IDR", memberships = [], currentHouseholdId, iconStyle = "3d" }: Props) {
  const tr = useT();
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [extraCategories, setExtraCategories] = useState<DbCategory[]>([]);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [toWalletId, setToWalletId] = useState<string | null>(null);
  const [extraWallets, setExtraWallets] = useState<DbWallet[]>([]);
  const [date, setDate] = useState(todayString);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  /** Which slot the wallet picker is filling: 'wallet' for normal/income/expense,
   *  'from' or 'to' for Transfer mode. */
  const [walletPickerSlot, setWalletPickerSlot] = useState<"wallet" | "from" | "to">("wallet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showRecurringPicker, setShowRecurringPicker] = useState(false);
  const [creatingRecurring, setCreatingRecurring] = useState(false);
  const [recurringSuccess, setRecurringSuccess] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // iOS Safari ignores overflow:hidden on body for touch-driven scroll.
    // position:fixed on the body is the only reliable way to prevent ALL
    // directional scrolling (including horizontal) while the sheet is open.
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflowX = "hidden";

    // Belt-and-suspenders: also block any touchmove that escapes the sheet.
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
      document.body.style.overflowX = "";
      window.scrollTo(0, scrollY);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [open]);

  const allCategories = [
    ...categories,
    ...extraCategories.filter((e) => !categories.find((c) => c.id === e.id)),
  ];
  const selectedCategory = allCategories.find((c) => c.id === categoryId) ?? null;

  const allWallets = [
    ...wallets,
    ...extraWallets.filter((e) => !wallets.find((w) => w.id === e.id)),
  ];
  const selectedWallet = allWallets.find((w) => w.id === walletId) ?? null;
  const selectedToWallet = allWallets.find((w) => w.id === toWalletId) ?? null;
  const isTransfer = type === "transfer";

  function openWalletPicker(slot: "wallet" | "from" | "to") {
    setWalletPickerSlot(slot);
    setShowWalletPicker(true);
  }

  useEffect(() => {
    if (!open) return;
    const defaultWallet = wallets.find((w) => w.is_default) ?? wallets[0] ?? null;
    const altWallet = wallets.find((w) => w.id !== defaultWallet?.id) ?? null;
    if (editing) {
      setType(editing.type);
      setAmount(String(Math.round(Number(editing.amount))));
      setName(editing.name);
      setCategoryId(editing.category_id);
      // Fall back to default wallet for legacy transactions that have no wallet_id
      setWalletId(editing.wallet_id ?? defaultWallet?.id ?? null);
      setToWalletId(altWallet?.id ?? null);
      setDate(editing.date);
      setPhotoPreview(editing.photo_url ?? null);
    } else {
      setType("expense");
      setAmount("");
      setName("");
      setCategoryId(null);
      setWalletId(defaultWallet?.id ?? null);
      setToWalletId(altWallet?.id ?? null);
      setDate(todayString());
      setPhotoPreview(null);
    }
    setPhoto(null);
    setExtraCategories([]);
    setExtraWallets([]);
    setError(null);
    setLoading(false);
    setShowCategoryPicker(false);
    setShowWalletPicker(false);
    setWalletPickerSlot("wallet");
    setConfirmDelete(false);
    setShowMovePicker(false);
    setMoving(false);
    setShowRecurringPicker(false);
    setCreatingRecurring(false);
    setRecurringSuccess(false);
  }, [open, editing, wallets]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(e.target.value.replace(/\D/g, ""));
  }

  const amountDisplay = amount ? amount.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";

  function handlePhotoSelected(file: File) {
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isTransfer) {
      // Transfer mode — no category, no photo, two wallets required
      if (!walletId || !toWalletId) {
        setError("Pick both From and To wallets");
        setLoading(false);
        return;
      }
      if (walletId === toWalletId) {
        setError("Source and destination wallets must differ");
        setLoading(false);
        return;
      }
      const fd = new FormData();
      fd.set("from_wallet_id", walletId);
      fd.set("to_wallet_id", toWalletId);
      fd.set("amount", amount);
      fd.set("name", name || tr("tx.transfer"));
      fd.set("date", date);
      const result = await addTransfer(fd);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        onClose();
      }
      return;
    }

    // Upload the photo client-side first (browser → Supabase Storage direct).
    // This avoids relaying multi-MB iPhone photos through Vercel's 4.5 MB
    // server-action body limit, which was causing the Save button to hang
    // indefinitely on iOS Chrome with a real receipt photo attached.
    let photoUrl: string | null = null;
    if (photo) {
      if (!currentHouseholdId) {
        setError("No household selected — please refresh and try again.");
        setLoading(false);
        return;
      }
      const upload = await uploadTransactionPhoto(currentHouseholdId, photo);
      if (!upload.ok) {
        setError(upload.error);
        setLoading(false);
        return;
      }
      photoUrl = upload.url;
    } else if (editing?.photo_url && photoPreview) {
      // No new photo picked, but the existing one wasn't removed — keep it.
      photoUrl = editing.photo_url;
    }

    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", amount);
    fd.set("name", name);
    fd.set("category_id", categoryId ?? "");
    fd.set("wallet_id", walletId ?? "");
    fd.set("date", date);
    if (photoUrl) fd.set("photo_url", photoUrl);

    const result = editing
      ? await updateTransaction(editing.id, fd)
      : await addTransaction(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onClose();
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    await deleteTransaction(editing.id);
    onClose();
  }

  async function handleMove(targetHouseholdId: string) {
    if (!editing) return;
    setMoving(true);
    const result = await moveTransaction(editing.id, targetHouseholdId);
    if (result?.error) {
      setError(result.error);
      setMoving(false);
      setShowMovePicker(false);
    } else {
      onClose();
    }
  }

  // Compute the next due date for a recurring item created from this transaction:
  // start one period after the transaction date so it doesn't fire retroactively.
  function nextDueAfter(txDate: string, frequency: "weekly" | "monthly" | "yearly"): string {
    const [y, m, d] = txDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (frequency === "weekly") dt.setDate(dt.getDate() + 7);
    else if (frequency === "monthly") dt.setMonth(dt.getMonth() + 1);
    else dt.setFullYear(dt.getFullYear() + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  async function handleCreateRecurring(frequency: "weekly" | "monthly" | "yearly") {
    if (!editing || creatingRecurring) return;
    setError(null);
    setCreatingRecurring(true);
    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", String(amount.replace(/\./g, "").replace(",", ".") || editing.amount));
    fd.set("name", name || editing.name);
    if (categoryId) fd.set("category_id", categoryId);
    fd.set("frequency", frequency);
    fd.set("next_due_date", nextDueAfter(date || editing.date, frequency));
    // repeat_until intentionally left blank → "forever"
    const result = await addRecurringItem(fd);
    setCreatingRecurring(false);
    if (result.error) {
      setError(result.error);
      setShowRecurringPicker(false);
      return;
    }
    setRecurringSuccess(true);
    setShowRecurringPicker(false);
    // Auto-dismiss the sheet after a short success indicator
    setTimeout(() => {
      setRecurringSuccess(false);
      onClose();
    }, 1100);
  }

  const otherLedgers = memberships.filter((m) => m.household_id !== currentHouseholdId);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* 95% height sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-1/2 z-[70] w-full max-w-md -translate-x-1/2 h-[95dvh] flex flex-col rounded-t-3xl bg-[var(--surface)] transition-transform duration-300 overflow-x-hidden [touch-action:pan-y]",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">
            {editing ? tr("tx.edit") : tr("tx.add")}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        {/* Form — flex col filling remaining space */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {/* Scrollable fields */}
          <div data-scroll className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 space-y-4 pb-4">
            {/* Type toggle — 3-way when adding, 2-way when editing (transfers are immutable) */}
            <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
              {(editing
                ? (["expense", "income"] as const)
                : (["expense", "income", "transfer"] as const)
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                    type === t && t === "expense"
                      ? "bg-rose-500 text-white shadow-sm"
                      : type === t && t === "income"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : type === t && t === "transfer"
                      ? "bg-[#EE6452] text-white shadow-sm"
                      : "text-[var(--label-secondary)]"
                  )}
                >
                  {t === "expense" ? tr("tx.expense") : t === "income" ? tr("tx.incomeShort") : tr("tx.transfer")}
                </button>
              ))}
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("tx.amount")} ({currency})
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

            {/* Wallet picker(s) — single in expense/income mode, From + To in transfer mode */}
            {isTransfer ? (
              <>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                    {tr("tx.transferFrom")}
                  </label>
                  <button
                    type="button"
                    onClick={() => openWalletPicker("from")}
                    className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
                  >
                    {selectedWallet ? (
                      <>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${selectedWallet.color}20` }}>
                          <CategoryIcon symbol={selectedWallet.symbol} iconStyle={iconStyle} size={16} emojiSize="16px" color={iconStyle === "2d" ? selectedWallet.color : undefined} />
                        </span>
                        <span className="flex-1 text-left text-[15px] font-medium text-[var(--foreground)]">{selectedWallet.name}</span>
                      </>
                    ) : (
                      <span className="flex-1 text-left text-[15px] text-[var(--label-tertiary)]">{tr("wallet.selectWallet")}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                  </button>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                    {tr("tx.transferTo")}
                  </label>
                  <button
                    type="button"
                    onClick={() => openWalletPicker("to")}
                    className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
                  >
                    {selectedToWallet ? (
                      <>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${selectedToWallet.color}20` }}>
                          <CategoryIcon symbol={selectedToWallet.symbol} iconStyle={iconStyle} size={16} emojiSize="16px" color={iconStyle === "2d" ? selectedToWallet.color : undefined} />
                        </span>
                        <span className="flex-1 text-left text-[15px] font-medium text-[var(--foreground)]">{selectedToWallet.name}</span>
                      </>
                    ) : (
                      <span className="flex-1 text-left text-[15px] text-[var(--label-tertiary)]">{tr("wallet.selectWallet")}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                  </button>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                  {tr("tx.wallet")}
                </label>
                <button
                  type="button"
                  onClick={() => openWalletPicker("wallet")}
                  className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
                >
                  {selectedWallet ? (
                    <>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${selectedWallet.color}20` }}>
                        <CategoryIcon symbol={selectedWallet.symbol} iconStyle={iconStyle} size={16} emojiSize="16px" color={iconStyle === "2d" ? selectedWallet.color : undefined} />
                      </span>
                      <span className="flex-1 text-left text-[15px] font-medium text-[var(--foreground)]">
                        {selectedWallet.name}
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-left text-[15px] text-[var(--label-tertiary)]">
                      {tr("wallet.selectWallet")}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                </button>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("tx.description")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr("tx.descriptionPlaceholder")}
                required
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {/* Category — hidden for transfers */}
            {!isTransfer && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("tx.category")}
              </label>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
              >
                {selectedCategory ? (
                  <>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${selectedCategory.color}20` }}>
                      <CategoryIcon symbol={selectedCategory.symbol} iconStyle={iconStyle} size={16} emojiSize="16px" color={iconStyle === "2d" ? selectedCategory.color : undefined} />
                    </span>
                    <span className="flex-1 text-left text-[15px] font-medium text-[var(--foreground)]">
                      {selectedCategory.name}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-left text-[15px] text-[var(--label-tertiary)]">
                    {tr("tx.selectCategory")}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
              </button>
            </div>
            )}

            {/* Date */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("tx.date")}
              </label>
              <div className="relative h-12 w-full">
                <div className="absolute inset-0 flex items-center gap-2 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08]">
                  <span className="flex-1 text-[15px] font-medium text-[var(--foreground)]">
                    {formatShortDate(date)}
                  </span>
                  <Calendar className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:light]"
                />
              </div>
            </div>

            {/* Photo — hidden for transfers */}
            {!isTransfer && (
            <div>
              <label className="mb-2 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("tx.photo")}
              </label>
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Transaction photo" className="h-40 w-full rounded-2xl object-cover" />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--background)] py-3.5 text-[13px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] active:bg-black/[0.04]"
                  >
                    <Camera className="h-4 w-4" strokeWidth={2} />
                    Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--background)] py-3.5 text-[13px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] active:bg-black/[0.04]"
                  >
                    <ImagePlus className="h-4 w-4" strokeWidth={2} />
                    Gallery
                  </button>
                </div>
              )}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f); }} />
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f); }} />
            </div>
            )}

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}
          </div>

          {/* Sticky footer — always visible */}
          <div className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-3 pb-8 space-y-2">
            <button
              type="submit"
              disabled={loading || moving}
              className="flex h-13 w-full items-center justify-center rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {loading ? tr("common.saving") : editing ? tr("common.saveChanges") : tr("tx.add")}
            </button>
            {editing && !confirmDelete && !showMovePicker && !showRecurringPicker && !recurringSuccess && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading || moving || creatingRecurring}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-medium text-rose-600 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                  {tr("common.delete")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecurringPicker(true)}
                  disabled={loading || moving || creatingRecurring}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-60"
                >
                  <Repeat className="h-4 w-4" strokeWidth={2} />
                  Recurring
                </button>
                {otherLedgers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMovePicker(true)}
                    disabled={loading || moving || creatingRecurring}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-60"
                  >
                    <ArrowRightLeft className="h-4 w-4" strokeWidth={2} />
                    Move
                  </button>
                )}
              </div>
            )}
            {editing && showRecurringPicker && (
              <div className="rounded-2xl bg-[var(--background)] ring-1 ring-black/[0.08] overflow-hidden">
                <p className="px-4 pt-3 pb-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
                  Repeat this transaction
                </p>
                <p className="px-4 pb-2 text-[12px] text-[var(--label-secondary)]">
                  Pick how often it should repeat. The next occurrence starts one period after this transaction&apos;s date.
                </p>
                <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                  {(["weekly", "monthly", "yearly"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => handleCreateRecurring(f)}
                      disabled={creatingRecurring}
                      className="flex h-11 items-center justify-center rounded-xl bg-[var(--surface)] text-[13px] font-semibold text-[var(--foreground)] ring-1 ring-black/[0.06] disabled:opacity-60 active:scale-[0.98] transition-transform capitalize"
                    >
                      {creatingRecurring ? "…" : f}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRecurringPicker(false)}
                  disabled={creatingRecurring}
                  className="flex w-full items-center justify-center border-t border-[var(--separator)] py-3 text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            )}
            {editing && recurringSuccess && (
              <div className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 text-[13px] font-medium text-emerald-700">
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Added to recurring
              </div>
            )}
            {editing && confirmDelete && (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-200 space-y-2">
                <p className="text-[13px] font-medium text-rose-700 text-center">{tr("tx.deleteConfirm")}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex h-10 flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.08]"
                  >
                    {tr("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex h-10 flex-1 items-center justify-center rounded-xl bg-rose-600 text-[13px] font-semibold text-white disabled:opacity-60"
                  >
                    {loading ? tr("common.loading") : tr("common.delete")}
                  </button>
                </div>
              </div>
            )}
            {editing && showMovePicker && (
              <div className="rounded-2xl bg-[var(--background)] ring-1 ring-black/[0.08] overflow-hidden">
                <p className="px-4 pt-3 pb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">Move to</p>
                {otherLedgers.map(({ household_id, household }) => (
                  <button
                    key={household_id}
                    type="button"
                    onClick={() => handleMove(household_id)}
                    disabled={moving}
                    className="flex w-full items-center gap-3 px-4 py-3 border-t border-[var(--separator)] active:bg-black/[0.02] disabled:opacity-60"
                  >
                    <span className="text-[20px]">{(household as any).symbol ?? "🏠"}</span>
                    <span className="flex-1 text-left text-[14px] font-medium text-[var(--foreground)]">{household.name}</span>
                    {moving && <span className="text-[12px] text-[var(--label-secondary)]">Moving…</span>}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowMovePicker(false)}
                  className="flex w-full items-center justify-center border-t border-[var(--separator)] py-3 text-[13px] font-medium text-[var(--label-secondary)]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Category picker */}
      {showCategoryPicker && (
        <CategoryPicker
          categories={allCategories}
          selected={categoryId}
          onSelect={setCategoryId}
          onClose={() => setShowCategoryPicker(false)}
          onCategoryAdded={(cat) => setExtraCategories((prev) => [...prev, cat])}
          iconStyle={iconStyle}
        />
      )}

      {/* Wallet picker — single sheet that fills whichever slot was tapped */}
      {showWalletPicker && (
        <WalletPickerSheet
          wallets={allWallets}
          selected={walletPickerSlot === "to" ? toWalletId : walletId}
          onSelect={(id) => {
            if (walletPickerSlot === "to") setToWalletId(id);
            else setWalletId(id);
          }}
          onClose={() => setShowWalletPicker(false)}
          onWalletAdded={(w) => {
            setExtraWallets((prev) => [...prev, w]);
            onWalletAdded?.(w);
          }}
          iconStyle={iconStyle}
          currency={currency}
        />
      )}
    </>
  );
}
