"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, Camera, ImagePlus, ChevronRight, ArrowRightLeft, Check, Calendar, Repeat, Wallet } from "lucide-react";
import { addTransaction, updateTransaction, deleteTransaction, moveTransaction, addTransfer } from "@/app/actions/transactions";
import { signTransactionPhoto } from "@/app/actions/photos";
import { addRecurringItem } from "@/app/actions/recurring";
import CategoryPicker from "@/components/category-picker";
import WalletPickerSheet from "@/components/wallet-picker-sheet";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { formatShortDate } from "@/lib/format";
import { uploadTransactionPhoto } from "@/lib/upload-photo";
import { compressPhoto } from "@/lib/compress-photo";
import PhotoViewer from "@/components/photo-viewer";
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Auto-focus the Amount input when opening for a NEW transaction so the
  // numeric keyboard pops immediately. We skip editing (the user is reviewing,
  // not entering fresh data) and skip transfers (Amount isn't the first
  // logical field there). The sheet is always mounted (slides in/out via
  // translate-y) so amountRef.current exists by the time `open` flips true.
  // requestAnimationFrame keeps the focus call close enough to the user's
  // tap to maximise the chance iOS PWA standalone pops the keyboard.
  useEffect(() => {
    if (!open || editing) return;
    const id = requestAnimationFrame(() => {
      amountRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, editing]);

  // Body-scroll lock. We use plain overflow:hidden on html + body (instead
  // of position:fixed body, which on iOS PWA standalone causes fixed
  // bottom-0 children to anchor to body's collapsed bounds — the cream-strip
  // bug we kept hitting). The touchmove guard below handles iOS Safari
  // momentum-scroll which can otherwise bypass overflow:hidden.
  //
  // Defense-in-depth: also flip `touch-action` to "none" on html so any pan
  // gesture is rejected by the browser before the touchmove handler runs.
  // The sheet has its own `touch-action: pan-y` plus the data-scroll's
  // overflow-y handles vertical scrolling inside, so this doesn't break
  // the sheet's own scrolling.
  useEffect(() => {
    if (!open) return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlTouchAction = document.documentElement.style.touchAction;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.touchAction = "none";

    function onTouchMove(e: TouchEvent) {
      const sheet = sheetRef.current;
      if (!sheet) { e.preventDefault(); return; }
      if (!sheet.contains(e.target as Node)) { e.preventDefault(); return; }
      const scrollable = (e.target as Element)?.closest?.("[data-scroll]");
      if (!scrollable) e.preventDefault();
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.touchAction = prevHtmlTouchAction;
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
      // Photos are stored as bare object paths; sign on demand only when the
      // edit sheet actually opens (avoids signing every photo on page load).
      // Show null while the signed URL is fetched — typical RTT is <300ms,
      // and the "Photo" row keeps its layout via min-height.
      setPhotoPreview(null);
      if (editing.photo_url) {
        signTransactionPhoto(editing.photo_url).then((res) => {
          if (res.url) setPhotoPreview(res.url);
        });
      }
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

  useEffect(() => {
    if (open || !previewObjectUrlRef.current) return;
    URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
  }, [open]);

  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
  }, []);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmount(e.target.value.replace(/\D/g, ""));
  }

  const amountDisplay = amount ? amount.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";

  async function handlePhotoSelected(file: File) {
    // Show the original immediately as a preview so the user sees something
    // happen instantly, then quietly swap in the compressed File for upload.
    // Compression is fast (<1s for typical iPhone photos) but on a slow
    // device we don't want the camera roll → preview transition to feel laggy.
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = previewUrl;
    setPhotoPreview(previewUrl);
    const compressed = await compressPhoto(file);
    setPhoto(compressed);
  }

  function removePhoto() {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
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
    let photoPath: string | null = null;
    if (photo) {
      if (!currentHouseholdId) {
        setError("No ledger selected — please refresh and try again.");
        setLoading(false);
        return;
      }
      const upload = await uploadTransactionPhoto(currentHouseholdId, photo);
      if (!upload.ok) {
        setError(upload.error);
        setLoading(false);
        return;
      }
      photoPath = upload.path;
    } else if (editing?.photo_url && photoPreview) {
      // No new photo picked, but the existing one wasn't removed — keep it.
      photoPath = editing.photo_url;
    }

    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", amount);
    fd.set("name", name);
    fd.set("category_id", categoryId ?? "");
    fd.set("wallet_id", walletId ?? "");
    fd.set("date", date);
    if (photoPath) fd.set("photo_url", photoPath);

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

      {/* Sheet — anchored to TOP-0 with explicit height: 100lvh, instead of
          BOTTOM-0 with h-dvh. iOS PWA standalone clips `position: fixed;
          bottom: 0` above the home-indicator zone (the cream-strip bug).
          By anchoring to top-0 and giving an explicit height, the sheet's
          bottom edge is just `top + height` (= top + full-screen) — no
          separate bottom anchor for iOS to clip. The slide-in/out uses
          translate-y(0) ↔ translate-y(100%); translateY is relative to the
          element's own height regardless of how it's positioned. */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed top-0 left-1/2 z-[70] w-full max-w-md -translate-x-1/2 flex flex-col rounded-t-3xl bg-[var(--surface)] overflow-x-hidden [touch-action:pan-y]",
          "transition-transform duration-[420ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          height: "100lvh",
          paddingTop: "env(safe-area-inset-top)",
        }}
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

        {/* Form — flex col filling remaining space.
            Type pill is locked at the top of the form (outside the scroll
            area) so it stays reachable while the user scrolls the fields.
            Field labels were intentionally removed so the form packs tighter
            and the Description field stays high on screen when iOS pops the
            keyboard — placeholders carry the same meaning. */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {/* Locked type toggle — 3-way when adding, 2-way when editing (transfers are immutable) */}
          <div className="shrink-0 px-5 pb-3">
            <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
              {(editing
                ? (["expense", "income"] as const)
                : (["expense", "income", "transfer"] as const)
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    // Clear the selected category if it doesn't belong to
                    // the new type — otherwise the picker chip below would
                    // show e.g. "Salary" while the user is on Expense.
                    if (t !== type) {
                      const sel = allCategories.find((c) => c.id === categoryId);
                      const newKind = t === "income" ? "income" : "expense";
                      if (sel && sel.type !== newKind) setCategoryId(null);
                    }
                    setType(t);
                  }}
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
          </div>

          {/* Scrollable fields.
              pt-1 keeps the Amount input's top ring from being clipped by the
              overflow:hidden boundary at the top of the scroll container. */}
          <div data-scroll className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-1 space-y-3 pb-4">
            {/* Amount */}
            <input
              ref={amountRef}
              type="text"
              inputMode="numeric"
              value={amountDisplay}
              onChange={handleAmountChange}
              placeholder={`${tr("tx.amount")} (${currency})`}
              aria-label={`${tr("tx.amount")} (${currency})`}
              required
              className="h-14 w-full rounded-2xl bg-[var(--background)] px-4 text-center text-[24px] font-semibold text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[15px] placeholder:font-medium placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            />

            {/* Wallet picker(s) — single in expense/income mode, From + To in transfer mode */}
            {isTransfer ? (
              <>
                <button
                  type="button"
                  onClick={() => openWalletPicker("from")}
                  aria-label={tr("tx.transferFrom")}
                  className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
                >
                  <Wallet className="h-[18px] w-[18px] shrink-0 text-[var(--label-secondary)]" strokeWidth={2} />
                  {selectedWallet ? (
                    <>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${selectedWallet.color}20` }}>
                        <CategoryIcon symbol={selectedWallet.symbol} iconStyle={iconStyle} size={16} emojiSize="16px" color={iconStyle === "2d" ? selectedWallet.color : undefined} />
                      </span>
                      <span className="flex-1 text-left text-[15px] font-medium text-[var(--foreground)]">{tr("tx.transferFrom")}: {selectedWallet.name}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-left text-[15px] text-[var(--label-tertiary)]">{tr("tx.transferFrom")}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => openWalletPicker("to")}
                  aria-label={tr("tx.transferTo")}
                  className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
                >
                  <Wallet className="h-[18px] w-[18px] shrink-0 text-[var(--label-secondary)]" strokeWidth={2} />
                  {selectedToWallet ? (
                    <>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${selectedToWallet.color}20` }}>
                        <CategoryIcon symbol={selectedToWallet.symbol} iconStyle={iconStyle} size={16} emojiSize="16px" color={iconStyle === "2d" ? selectedToWallet.color : undefined} />
                      </span>
                      <span className="flex-1 text-left text-[15px] font-medium text-[var(--foreground)]">{tr("tx.transferTo")}: {selectedToWallet.name}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-left text-[15px] text-[var(--label-tertiary)]">{tr("tx.transferTo")}</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => openWalletPicker("wallet")}
                aria-label={tr("tx.wallet")}
                className="flex h-12 w-full items-center gap-3 rounded-2xl bg-[var(--background)] px-4 ring-1 ring-black/[0.08] transition-colors active:bg-black/[0.04]"
              >
                {/* Field-type marker — neutral Wallet glyph so the row reads as
                    a wallet selector regardless of which wallet is selected
                    (now that the "Wallet" text label above it is gone). */}
                <Wallet className="h-[18px] w-[18px] shrink-0 text-[var(--label-secondary)]" strokeWidth={2} />
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
            )}

            {/* Description */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("tx.descriptionPlaceholder")}
              aria-label={tr("tx.description")}
              required
              className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            />

            {/* Category — hidden for transfers */}
            {!isTransfer && (
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                aria-label={tr("tx.category")}
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
            )}

            {/* Date */}
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
                aria-label={tr("tx.date")}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:light]"
              />
            </div>

            {/* Photo — hidden for transfers */}
            {!isTransfer && (
            <div>
              {photoPreview ? (
                <div className="relative">
                  {/* Tap the photo to open the fullscreen viewer with a
                      download button. Uses a button (not just <img>) so
                      keyboard users can activate it too. */}
                  <button
                    type="button"
                    onClick={() => setShowPhotoViewer(true)}
                    className="block w-full overflow-hidden rounded-2xl active:opacity-90 transition-opacity"
                    aria-label={tr("tx.photo")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Transaction photo" className="h-40 w-full rounded-2xl object-cover" />
                  </button>
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
          <div
            className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-3 space-y-2"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
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
                    <span className="text-[20px]">{household.symbol ?? "🏠"}</span>
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

      {/* Category picker — filtered to the current transaction's type
          (transfers don't have a category, so we don't reach this branch). */}
      {showCategoryPicker && (
        <CategoryPicker
          categories={allCategories}
          selected={categoryId}
          type={type === "income" ? "income" : "expense"}
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

      {/* Fullscreen photo viewer with download button */}
      <PhotoViewer
        url={showPhotoViewer ? photoPreview : null}
        downloadName={
          name
            ? `${name.replace(/[^\w-]+/g, "_")}-${date}.jpg`
            : `transaction-${date}.jpg`
        }
        onClose={() => setShowPhotoViewer(false)}
      />
    </>
  );
}
