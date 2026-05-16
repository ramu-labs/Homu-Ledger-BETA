"use client";

// Add Transaction sheet — v1.44.0 unified redesign.
//
// Ported from the design prototype (`src/tx/add-tx-sheet.jsx`). This is
// now the SINGLE entry point for creating transactions AND recurring
// items — the separate "Add Recurring" creation sheet is gone. Opening
// the sheet from the Recurring tab pre-ticks the Recurring toggle
// (`defaultRecurring` prop); editing an existing recurring ITEM still
// goes through AddRecurringSheet (tap-to-edit on a recurring row).
//
// Design summary:
//   • Content-driven bottom sheet (max-height 92%), drag handle, no
//     header chrome — tap the backdrop to dismiss.
//   • Hero amount: superscript Rp + a big 52px number that auto-shrinks
//     when it would overflow. A transparent <input> captures digits.
//   • Compact colour-coded segmented type tabs (Expense / Income /
//     Transfer), centred, not full-width.
//   • Pill fields: Wallet + Category share one row; Description; Date +
//     a circular Recurring toggle.
//   • Recurring options (Frequency / until) live in the action row,
//     left of the circular Save button.
//   • Wallet/Category pickers are floating bento overlays that slide up
//     while this sheet slides down + dims (coordinated motion).
//
// EVERYTHING below the render is the real production logic — offline
// queue, pending-row editing, AI auto-categorisation, photo upload,
// transfer pairs, move-to-ledger, recurring creation. None of that
// changed; only the presentation did.

import { useState, useEffect, useRef } from "react";
import { X, Trash2, Camera, ImagePlus, ChevronRight, ChevronDown, ArrowRightLeft, Check, Calendar, Repeat, Sparkles, Loader2 } from "lucide-react";
import { updateTransaction, deleteTransaction, moveTransaction, addTransfer } from "@/app/actions/transactions";
import { queuedAddTransaction, isQueued, updateQueuedTransaction, deleteQueuedTransaction } from "@/lib/queue-actions";
import { withTimeout } from "@/lib/with-timeout";
import { signTransactionPhoto } from "@/app/actions/photos";
import { addRecurringItem } from "@/app/actions/recurring";
import { suggestCategory, recordCategoryUsage } from "@/app/actions/ai";
import CategoryPicker from "@/components/category-picker";
import NumericKeypad from "@/components/numeric-keypad";
import WalletPickerSheet from "@/components/wallet-picker-sheet";
import { CategoryIcon } from "@/components/category-icon";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { formatShortDate } from "@/lib/format";
import { uploadTransactionPhoto } from "@/lib/upload-photo";
import { compressPhoto } from "@/lib/compress-photo";
import PhotoViewer from "@/components/photo-viewer";
import type { DbTransaction, DbCategory, DbWallet, DbHouseholdMembership, RecurringFrequency } from "@/lib/types";
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
  /** v1.44.0 — pre-tick the Recurring toggle. Set when the sheet is
   *  opened from the Recurring tab / "Add recurring item" button. */
  defaultRecurring?: boolean;
};

// Transfer accent stays coral; expense/income pull from the app's
// shared finance tokens so the tabs match the home-screen balance
// colours (v1.43.1 colour audit).
const ATX_CORAL = "#EE6452";

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "Today" if the YYYY-MM-DD is today's local date, else short date.
function formatTodayOrShort(value: string) {
  return value === todayString() ? "Today" : formatShortDate(value);
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function formatWeekdayDate(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]} ${d} ${MONTH_NAMES[m - 1]}`;
}
// Compact chip date — "Sat 30 Aug".
function formatChipDate(value: string) {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  const dt = new Date(y, m - 1, d);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[dt.getDay()]} ${d} ${months[m - 1]}`;
}

// ─── Hero amount ──────────────────────────────────────────────────────
// v1.45.4 — the amount is driven by a CUSTOM in-app keypad
// (components/numeric-keypad.tsx), NOT the native keyboard. iOS draws
// the form-accessory bar (‹ › Done) above the system keyboard for any
// native editable element and there is no web API to remove it — so we
// don't summon the native keyboard at all. This field is just a plain
// focusable <div> (a div never triggers a virtual keyboard); the keypad
// appends digits to the value.
//
// `onActivate` tells the parent the field was tapped → show the keypad.
function HeroAmountInput({
  value,
  focused,
  fieldRef,
  onActivate,
}: {
  value: string;
  focused: boolean;
  fieldRef: React.RefObject<HTMLDivElement | null>;
  onActivate: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // Auto-shrink: measure rendered text width against the container,
  // scale down (never up) when it would overflow.
  useEffect(() => {
    if (!containerRef.current || !measureRef.current) return;
    const cw = containerRef.current.clientWidth;
    const tw = measureRef.current.scrollWidth;
    setScale(tw > cw && tw > 0 ? cw / tw : 1);
  }, [value, focused]);

  const empty = !value;
  const display = empty ? "0" : value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={onActivate}
      ref={containerRef}
      className="relative flex w-full cursor-pointer items-start justify-center"
      style={{ padding: "18px 24px 14px", gap: 4, boxSizing: "border-box" }}
    >
      <div
        ref={measureRef}
        className="inline-flex items-start whitespace-nowrap"
        style={{ gap: 4, transform: `scale(${scale})`, transformOrigin: "center top", transition: "transform 120ms ease" }}
      >
        <span className="font-semibold text-[var(--label-secondary)]" style={{ fontSize: 14, transform: "translateY(8px)" }}>
          Rp
        </span>
        <span
          style={{
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: empty ? "var(--label-tertiary)" : "var(--foreground)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {display}
        </span>
        {focused && (
          <span
            aria-hidden
            className="inline-block self-end"
            style={{
              width: 3,
              height: 50,
              background: ATX_CORAL,
              borderRadius: 1,
              marginLeft: 4,
              transform: "translateY(-2px)",
              animation: "atx-caret 1.1s steps(2) infinite",
            }}
          />
        )}
      </div>
      {/* Plain focusable div — NO keyboard, NO iOS accessory bar.
          The keypad is the only input path. Focus drives the caret. */}
      <div
        ref={fieldRef}
        tabIndex={0}
        role="textbox"
        aria-label="Amount"
        className="absolute inset-0 h-full w-full"
        style={{ opacity: 0, outline: "none" }}
      />
    </div>
  );
}

// Native <select> dressed as a soft pill — used for recurring options.
function InlineDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  displayLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
  ariaLabel: string;
  displayLabel?: string;
}) {
  const current = options.find((o) => o.key === value) ?? options[0];
  const label = displayLabel ?? current.label;
  return (
    <div className="relative inline-flex h-8 items-center gap-1 rounded-full border border-[var(--separator)] bg-[var(--surface)] pl-3 pr-2 text-[var(--foreground)]">
      <span className="whitespace-nowrap text-[13px] font-semibold tracking-[-0.005em]">{label}</span>
      <ChevronDown className="h-[13px] w-[13px] text-[var(--label-secondary)]" strokeWidth={2.25} />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer border-0 bg-transparent opacity-0"
        style={{ appearance: "none", fontSize: 16 }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AddTransactionSheet({
  open,
  onClose,
  categories,
  wallets,
  onWalletAdded,
  editing,
  currency = "IDR",
  memberships = [],
  currentHouseholdId,
  iconStyle = "3d",
  defaultRecurring = false,
}: Props) {
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
  const [walletPickerSlot, setWalletPickerSlot] = useState<"wallet" | "from" | "to">("wallet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showRecurringPicker, setShowRecurringPicker] = useState(false);
  const [creatingRecurring, setCreatingRecurring] = useState(false);
  const [recurringSuccess, setRecurringSuccess] = useState(false);
  const [recurringMode, setRecurringMode] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [repeatUntilMode, setRepeatUntilMode] = useState<"forever" | "date">("forever");
  const [repeatUntilDate, setRepeatUntilDate] = useState("");
  const [aiSuggestingFor, setAiSuggestingFor] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<"rule" | "cache" | "seed" | "ai" | null>(null);
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);
  const aiSuggestedRef = useRef<string | null>(null);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);

  // v1.45.4 — true when the in-app numeric keypad is showing (the
  // amount field is "active"). For a NEW transaction it starts true
  // (keypad auto-shows on +). Focusing the Description flips it false
  // so the native keyboard can take over for text.
  const [amountActive, setAmountActive] = useState(false);

  // `pickerVisible` drives the coordinated motion: while a bento picker
  // is open the sheet slides fully off-screen and the picker takes over.
  // The picker flips this back synchronously via onCloseStart.
  const [pickerVisible, setPickerVisible] = useState(false);

  // ── Viewport-tracking wrapper (v1.46.1 rewrite) ─────────────────────
  // The sheet lives inside a `position: fixed` wrapper that is sized and
  // offset to EXACTLY overlay window.visualViewport — the *visible* area,
  // i.e. the screen minus the on-screen keyboard. The sheet itself is
  // then simply `position: absolute; bottom: 0` inside that wrapper, so
  // it is always flush against the bottom of the visible area:
  //   • keyboard down → wrapper = full screen   → sheet at screen bottom
  //   • keyboard up   → wrapper = area above kb → sheet sits on the kb
  //
  // This replaces the old `bottom: kbInset` hack. That hack lifted the
  // sheet by a SELF-CALIBRATED keyboard height; on iOS Chrome PWA the
  // calibration drifted, leaving the sheet a few px off — which showed
  // up as the stray "cream box" at the bottom (the mis-placed sheet /
  // keypad surface peeking out from behind a picker that hadn't fully
  // slid the sheet off-screen) and as a gap that widened on every
  // re-focus. Reading visualViewport directly on every event — no
  // baseline, no accumulation — removes the drift entirely.
  const [vvHeight, setVvHeight] = useState<number | null>(null);
  const [vvOffsetTop, setVvOffsetTop] = useState(0);
  useEffect(() => {
    if (!open) return;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    function update() {
      if (!vv) return;
      setVvHeight(vv.height);
      setVvOffsetTop(vv.offsetTop);
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  // True only while the Description native keyboard is up — used purely
  // to trim the action row's bottom padding (the keyboard already covers
  // the home indicator, so the safe-area inset would be dead space).
  const [descFocused, setDescFocused] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // Hero amount is a contentEditable div (see HeroAmountInput) — ref
  // is a div, not an input.
  const amountRef = useRef<HTMLDivElement>(null);
  // Hidden end-date input for the recurring "On date" dropdown — we
  // call showPicker() on it the moment the user flips to "On date".
  const endDateRef = useRef<HTMLInputElement>(null);

  // ── Body-scroll lock (unchanged from v1.26.0) ───────────────────────
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlTouchAction: html.style.touchAction,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.touchAction = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    function onTouchMove(e: TouchEvent) {
      const sheet = sheetRef.current;
      if (!sheet) { e.preventDefault(); return; }
      if (!sheet.contains(e.target as Node)) { e.preventDefault(); return; }
      const scrollable = (e.target as Element)?.closest?.("[data-scroll]");
      if (!scrollable) e.preventDefault();
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.touchAction = prev.htmlTouchAction;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      body.style.overscrollBehavior = prev.bodyOverscroll;
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

  // ── Keypad input (v1.45.4) ──────────────────────────────────────────
  // The amount is driven entirely by the in-app NumericKeypad.
  function activateAmount() {
    setAmountActive(true);
    // Pull focus to the amount field — this blurs the Description input
    // if it was focused, dismissing the native keyboard.
    amountRef.current?.focus();
  }
  function pushDigit(d: string) {
    setAmount((prev) => {
      if (prev.length >= 12) return prev; // ~trillions ceiling
      // Strip leading zeros so "0" → "" and "05" → "5".
      return (prev + d).replace(/^0+/, "");
    });
  }
  function backspaceAmount() {
    setAmount((prev) => prev.slice(0, -1));
  }

  function openWalletPicker(slot: "wallet" | "from" | "to") {
    setWalletPickerSlot(slot);
    setShowWalletPicker(true);
    setPickerVisible(true);
  }
  function openCategoryPicker() {
    // NOTE: do NOT set userTouchedCategory here. Merely OPENING the
    // picker must not disable AI auto-categorisation — only actually
    // SELECTING a category does (handled in the picker's onSelect).
    // Setting it on open was a v1.45.0 regression: tapping the empty
    // Category pill killed AI suggestions for the rest of the session.
    setShowCategoryPicker(true);
    setPickerVisible(true);
  }

  // ── Reset on (re-)open ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const defaultWallet = wallets.find((w) => w.is_default) ?? wallets[0] ?? null;
    const altWallet = wallets.find((w) => w.id !== defaultWallet?.id) ?? null;
    if (editing) {
      setType(editing.type);
      setAmount(String(Math.round(Number(editing.amount))));
      setName(editing.name);
      setCategoryId(editing.category_id);
      setWalletId(editing.wallet_id ?? defaultWallet?.id ?? null);
      setToWalletId(altWallet?.id ?? null);
      setDate(editing.date);
      setPhotoPreview(null);
      if (editing.photo_url) {
        signTransactionPhoto(editing.photo_url).then((res) => {
          if (res.url) setPhotoPreview(res.url);
        });
      }
      setRecurringMode(false);
    } else {
      setType("expense");
      setAmount("");
      setName("");
      setCategoryId(null);
      setWalletId(defaultWallet?.id ?? null);
      setToWalletId(altWallet?.id ?? null);
      setDate(todayString());
      setPhotoPreview(null);
      // Recurring is pre-ticked when opened from the Recurring tab.
      setRecurringMode(!!defaultRecurring);
    }
    setPhoto(null);
    setExtraCategories([]);
    setExtraWallets([]);
    setError(null);
    setLoading(false);
    setShowCategoryPicker(false);
    setShowWalletPicker(false);
    setWalletPickerSlot("wallet");
    setPickerVisible(false);
    // New transaction → keypad auto-shows. Editing → start quiet (the
    // user is reviewing; they tap the amount to bring up the keypad).
    setAmountActive(!editing);
    setDescFocused(false);
    setConfirmDelete(false);
    setShowMovePicker(false);
    setMoving(false);
    setShowRecurringPicker(false);
    setCreatingRecurring(false);
    setRecurringSuccess(false);
    setFrequency("monthly");
    setRepeatUntilMode("forever");
    setRepeatUntilDate("");
    setAiSuggestingFor(null);
    setAiSource(null);
    setUserTouchedCategory(!!editing);
    aiSuggestedRef.current = null;
  }, [open, editing, wallets, defaultRecurring]);

  // ── AI auto-categorisation (unchanged) ──────────────────────────────
  useEffect(() => {
    if (!open || editing || isTransfer) return;
    if (userTouchedCategory) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setAiSuggestingFor(trimmed);
      const kind: "income" | "expense" = type === "income" ? "income" : "expense";
      let res: Awaited<ReturnType<typeof suggestCategory>> | null = null;
      try {
        res = await withTimeout(suggestCategory(trimmed, kind), 4000);
      } catch {
        /* timeout / network — fall through */
      }
      if (cancelled) return;
      setAiSuggestingFor((current) => (current === trimmed ? null : current));
      if (userTouchedCategoryRef.current) return;
      if (res && res.ok) {
        setCategoryId(res.categoryId);
        setAiSource(res.source);
        aiSuggestedRef.current = res.categoryId;
      } else {
        setAiSource(null);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, editing, isTransfer, userTouchedCategory, name, type]);

  const userTouchedCategoryRef = useRef(userTouchedCategory);
  useEffect(() => {
    userTouchedCategoryRef.current = userTouchedCategory;
  }, [userTouchedCategory]);

  useEffect(() => {
    if (open || !previewObjectUrlRef.current) return;
    URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
  }, [open]);
  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
  }, []);

  async function handlePhotoSelected(file: File) {
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

  // ── Submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Recurring mode → create a recurring rule (not a one-off).
    if (recurringMode && !isTransfer) {
      if (!walletId) {
        setError(tr("wallet.selectWallet"));
        setLoading(false);
        return;
      }
      const fd = new FormData();
      fd.set("type", type);
      fd.set("amount", amount);
      fd.set("name", name);
      fd.set("category_id", categoryId ?? "");
      fd.set("wallet_id", walletId);
      fd.set("frequency", frequency);
      fd.set("next_due_date", date);
      fd.set("repeat_until", repeatUntilMode === "date" ? repeatUntilDate : "");
      const result = await addRecurringItem(fd);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        void recordCategoryUsage(name, categoryId);
        onClose();
      }
      return;
    }

    if (isTransfer) {
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

    // Upload photo client-side first (avoids the Vercel 4.5 MB body cap).
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
      ? editing._pending
        ? await updateQueuedTransaction(editing.id, fd)
        : await updateTransaction(editing.id, fd)
      : await queuedAddTransaction(fd);

    if (result && isQueued(result)) {
      void recordCategoryUsage(name, categoryId);
      onClose();
      return;
    }
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      void recordCategoryUsage(name, categoryId);
      onClose();
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    if (editing._pending) {
      await deleteQueuedTransaction(editing.id);
    } else {
      await deleteTransaction(editing.id);
    }
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

  function nextDueAfter(txDate: string, freq: "weekly" | "monthly" | "yearly"): string {
    const [y, m, d] = txDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (freq === "weekly") dt.setDate(dt.getDate() + 7);
    else if (freq === "monthly") dt.setMonth(dt.getMonth() + 1);
    else dt.setFullYear(dt.getFullYear() + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  async function handleCreateRecurring(freq: "weekly" | "monthly" | "yearly") {
    if (!editing || creatingRecurring) return;
    setError(null);
    setCreatingRecurring(true);
    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", String(amount.replace(/\./g, "").replace(",", ".") || editing.amount));
    fd.set("name", name || editing.name);
    if (categoryId) fd.set("category_id", categoryId);
    fd.set("frequency", freq);
    fd.set("next_due_date", nextDueAfter(date || editing.date, freq));
    const result = await addRecurringItem(fd);
    setCreatingRecurring(false);
    if (result.error) {
      setError(result.error);
      setShowRecurringPicker(false);
      return;
    }
    setRecurringSuccess(true);
    setShowRecurringPicker(false);
    setTimeout(() => {
      setRecurringSuccess(false);
      onClose();
    }, 1100);
  }

  const otherLedgers = memberships.filter((m) => m.household_id !== currentHouseholdId);
  const canSave = !!amount && (!isTransfer ? true : !!toWalletId && toWalletId !== walletId);
  const editSubPanelOpen = confirmDelete || showMovePicker || showRecurringPicker || recurringSuccess;

  // Per-type accent for the segmented tabs.
  function tabStyle(t: "expense" | "income" | "transfer", active: boolean): React.CSSProperties {
    if (!active) return {};
    const color =
      t === "expense" ? "var(--color-expense)" : t === "income" ? "var(--color-income)" : ATX_CORAL;
    return {
      background: `color-mix(in oklab, ${color} 14%, transparent)`,
      color,
    };
  }

  // Date input is an invisible overlay; the visible pill is read-only.
  const dateLabel = recurringMode ? formatWeekdayDate(date) : formatTodayOrShort(date);

  return (
    <>
      {/* Backdrop. v1.45.3 — fade duration 300→600ms (animations
          globally slowed to half speed at the user's request). */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 transition-opacity duration-[600ms]",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sheet — mounted only while open. It lives inside a wrapper that
          is sized + offset to overlay the visual viewport (see the
          viewport-tracking effect above), so the sheet — anchored to the
          wrapper's bottom — is always flush at the bottom of the visible
          area, whether or not the native keyboard is up. The wrapper is
          pointer-events:none so taps above the sheet fall through to the
          backdrop and dismiss. */}
      {open && (
        <div
          className="fixed left-0 top-0 z-[70] w-full"
          style={{
            height: vvHeight != null ? `${vvHeight}px` : "100dvh",
            transform: `translateY(${vvOffsetTop}px)`,
            pointerEvents: "none",
          }}
        >
        <div
          ref={sheetRef}
          className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-md flex-col rounded-t-3xl bg-[var(--surface)] [touch-action:pan-y]"
          style={{
            pointerEvents: "auto",
            // The wrapper already tracks the visible viewport, so 92%
            // leaves an 8% backdrop sliver at the top in every state.
            maxHeight: "92%",
            boxShadow: "0 -10px 30px rgba(0,0,0,0.18)",
            // Picker open → slide the whole sheet off-screen so no white
            // sliver shows behind the floating bento picker. Because the
            // sheet genuinely sits at the wrapper's bottom edge,
            // translateY(100%) now moves it FULLY off-screen.
            // v1.45.3 — durations doubled (280→560ms): animations slowed
            // to half speed at the user's request.
            transform: pickerVisible ? "translateY(100%)" : "translateY(0)",
            transition: "transform 560ms cubic-bezier(0.32,0.72,0,1)",
            animation: pickerVisible
              ? "none"
              : "sheet-slide-up 560ms cubic-bezier(0.32,0.72,0,1) both",
          }}
        >
          {/* Drag handle — tap backdrop to dismiss; no header chrome. */}
          <div className="flex shrink-0 justify-center pb-1.5 pt-3">
            <div className="h-1 w-10 rounded-full bg-black/10" />
          </div>

          {/* "New recurring item" pill — surfaces the recurring intent. */}
          {recurringMode && !editing && (
            <div className="flex shrink-0 justify-center px-5 pb-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                style={{ color: ATX_CORAL, background: "rgba(238,100,82,0.10)" }}
              >
                <Repeat className="h-[11px] w-[11px]" strokeWidth={2.5} />
                {tr("tx.newRecurringItem")}
              </span>
            </div>
          )}

          {/* Type tabs — compact, centered, color-coded */}
          <div className="flex shrink-0 justify-center px-5 pb-1.5">
            <div className="inline-flex gap-1 rounded-full bg-black/[0.05] p-1">
              {(editing
                ? (["expense", "income"] as const)
                : (["expense", "income", "transfer"] as const)
              ).map((t) => {
                const active = t === type;
                return (
                  <button
                    key={t}
                    type="button"
                    // preventDefault keeps a focused input (amount /
                    // description) from blurring — switching type tab
                    // shouldn't drop the keyboard.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (t !== type) {
                        const sel = allCategories.find((c) => c.id === categoryId);
                        const newKind = t === "income" ? "income" : "expense";
                        if (sel && sel.type !== newKind) setCategoryId(null);
                      }
                      if (t === "transfer" && recurringMode) setRecurringMode(false);
                      setType(t);
                    }}
                    className={cn(
                      "min-w-[88px] rounded-full px-4 text-[13px] font-semibold transition-all",
                      active ? "shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[var(--label-secondary)]"
                    )}
                    style={{ height: 34, ...tabStyle(t, active) }}
                  >
                    {t === "expense" ? tr("tx.expense") : t === "income" ? tr("tx.incomeShort") : tr("tx.transfer")}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col overflow-hidden">
            {/* Hero amount — driven by the in-app keypad (NumericKeypad
                below), not the native keyboard. */}
            <HeroAmountInput
              value={amount}
              focused={amountActive}
              fieldRef={amountRef}
              onActivate={activateAmount}
            />

            {/* Body — natural height, scrolls if it overflows. */}
            <div data-scroll className="flex flex-[0_1_auto] flex-col gap-2.5 overflow-y-auto px-5 pb-3" style={{ minHeight: 0 }}>
              {/* Description (expense/income + transfer notes).
                  Focusing it hides the in-app keypad so the native
                  keyboard can take over for text entry. */}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => { setAmountActive(false); setDescFocused(true); }}
                onBlur={() => setDescFocused(false)}
                placeholder={isTransfer ? tr("tx.note") : tr("tx.descriptionPlaceholder")}
                aria-label={tr("tx.description")}
                className="h-12 w-full rounded-full border border-[var(--separator)] bg-[var(--background)] px-[18px] text-[14.5px] text-[var(--foreground)] outline-none placeholder:text-[var(--label-tertiary)] focus:border-[var(--foreground)]/30"
              />

              {/* Account row */}
              {isTransfer ? (
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <WalletPillButton wallet={selectedWallet} iconStyle={iconStyle} placeholder={tr("tx.transferFrom")} onClick={() => openWalletPicker("from")} />
                  </div>
                  <span className="shrink-0 text-[13px] font-medium text-[var(--label-secondary)]">{tr("tx.toWord")}</span>
                  <div className="min-w-0 flex-1">
                    <WalletPillButton wallet={selectedToWallet} iconStyle={iconStyle} placeholder={tr("tx.transferTo")} onClick={() => openWalletPicker("to")} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <WalletPillButton wallet={selectedWallet} iconStyle={iconStyle} placeholder={tr("wallet.selectWallet")} onClick={() => openWalletPicker("wallet")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CategoryPillButton
                      category={selectedCategory}
                      iconStyle={iconStyle}
                      aiSource={!!aiSource}
                      loading={aiSuggestingFor !== null && !userTouchedCategory}
                      placeholder={tr("tx.category")}
                      onClick={openCategoryPicker}
                    />
                  </div>
                </div>
              )}

              {/* Date + Recurring toggle */}
              <div className="flex items-stretch gap-2">
                <div className="relative h-12 min-w-0 flex-1">
                  <div className="pointer-events-none absolute inset-0 flex items-center gap-2 rounded-full border border-[var(--separator)] bg-[var(--background)] px-4">
                    <Calendar className="h-[18px] w-[18px] shrink-0 text-[var(--label-secondary)]" strokeWidth={2} />
                    <span className="flex-1 truncate text-left text-[14.5px] font-medium text-[var(--foreground)]">
                      {recurringMode && <span className="text-[var(--label-secondary)]">{tr("recurring.startingPrefix")} </span>}
                      {dateLabel}
                    </span>
                    <ChevronDown className="h-4 w-4 text-[var(--label-tertiary)]" strokeWidth={2} />
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label={recurringMode ? tr("recurring.startingDate") : tr("tx.date")}
                    className="h-full w-full cursor-pointer rounded-full border-0 bg-transparent opacity-0 [color-scheme:light]"
                  />
                </div>
                {!isTransfer && !editing && (
                  <button
                    type="button"
                    // preventDefault on mousedown keeps the currently
                    // focused input (amount / description) — toggling
                    // Recurring with the keyboard up should NOT dismiss
                    // it or move the cursor.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setRecurringMode((v) => !v)}
                    aria-pressed={recurringMode}
                    aria-label={tr("tx.makeRecurring")}
                    title={tr("tx.makeRecurring")}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors [touch-action:manipulation]"
                    style={
                      recurringMode
                        ? { background: ATX_CORAL, color: "#fff", border: `1px solid ${ATX_CORAL}`, boxShadow: "0 4px 12px rgba(238,100,82,0.30)" }
                        : { background: "var(--background)", color: "var(--label-secondary)", border: "1px solid var(--separator)" }
                    }
                  >
                    <Repeat className="h-[18px] w-[18px]" strokeWidth={recurringMode ? 2.4 : 2} />
                  </button>
                )}
              </div>

              {/* Photo preview (when attached) — body, all modes */}
              {!isTransfer && !recurringMode && !editing?._pending && photoPreview && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPhotoViewer(true)}
                    className="block w-full overflow-hidden rounded-2xl transition-opacity active:opacity-90"
                    aria-label={tr("tx.photo")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Transaction" className="h-32 w-full rounded-2xl object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              )}

              {/* Photo chips for EDIT mode (create mode uses the action row) */}
              {!isTransfer && !recurringMode && editing && !editing._pending && !photoPreview && (
                <div className="flex gap-2">
                  <PhotoChip icon="camera" label="Camera" onClick={() => cameraRef.current?.click()} />
                  <PhotoChip icon="gallery" label="Gallery" onClick={() => fileRef.current?.click()} />
                </div>
              )}

              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f); }} />
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f); }} />

              {error && (
                <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
                  {error}
                </p>
              )}
            </div>

            {/* ── Edit-mode sub-panels (expand above the action row) ── */}
            {editing && (confirmDelete || showMovePicker || showRecurringPicker || recurringSuccess) && (
              <div className="shrink-0 px-5 pb-1">
                {confirmDelete && (
                  <div className="space-y-2 rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-200">
                    <p className="text-center text-[13px] font-medium text-rose-700">{tr("tx.deleteConfirm")}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmDelete(false)}
                        className="flex h-10 flex-1 items-center justify-center rounded-xl bg-white text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.08]">
                        {tr("common.cancel")}
                      </button>
                      <button type="button" onClick={handleDelete} disabled={loading}
                        className="flex h-10 flex-1 items-center justify-center rounded-xl bg-rose-600 text-[13px] font-semibold text-white disabled:opacity-60">
                        {loading ? tr("common.loading") : tr("common.delete")}
                      </button>
                    </div>
                  </div>
                )}
                {showRecurringPicker && (
                  <div className="overflow-hidden rounded-2xl bg-[var(--background)] ring-1 ring-black/[0.08]">
                    <p className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
                      Repeat this transaction
                    </p>
                    <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1">
                      {(["weekly", "monthly", "yearly"] as const).map((f) => (
                        <button key={f} type="button" onClick={() => handleCreateRecurring(f)} disabled={creatingRecurring}
                          className="flex h-11 items-center justify-center rounded-xl bg-[var(--surface)] text-[13px] font-semibold capitalize text-[var(--foreground)] ring-1 ring-black/[0.06] transition-transform active:scale-[0.98] disabled:opacity-60">
                          {creatingRecurring ? "…" : f}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowRecurringPicker(false)} disabled={creatingRecurring}
                      className="flex w-full items-center justify-center border-t border-[var(--separator)] py-2.5 text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-60">
                      {tr("common.cancel")}
                    </button>
                  </div>
                )}
                {recurringSuccess && (
                  <div className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-[13px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Added to recurring
                  </div>
                )}
                {showMovePicker && (
                  <div className="overflow-hidden rounded-2xl bg-[var(--background)] ring-1 ring-black/[0.08]">
                    <p className="px-4 pb-2 pt-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">Move to</p>
                    {otherLedgers.map(({ household_id, household }) => (
                      <button key={household_id} type="button" onClick={() => handleMove(household_id)} disabled={moving}
                        className="flex w-full items-center gap-3 border-t border-[var(--separator)] px-4 py-3 active:bg-black/[0.02] disabled:opacity-60">
                        <span className="text-[20px]">{household.symbol ?? "🏠"}</span>
                        <span className="flex-1 text-left text-[14px] font-medium text-[var(--foreground)]">{household.name}</span>
                        {moving && <span className="text-[12px] text-[var(--label-secondary)]">Moving…</span>}
                      </button>
                    ))}
                    <button type="button" onClick={() => setShowMovePicker(false)}
                      className="flex w-full items-center justify-center border-t border-[var(--separator)] py-2.5 text-[13px] font-medium text-[var(--label-secondary)]">
                      {tr("common.cancel")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action row */}
            <div
              className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-2.5"
              style={{
                // amountActive → the keypad sits below this row and owns
                // the home-indicator clearance, so a small pad is fine.
                // Description keyboard up → also small (the keyboard
                // covers the home bar). Otherwise clear it with the
                // safe-area inset.
                paddingBottom:
                  amountActive || descFocused
                    ? "10px"
                    : "max(16px, env(safe-area-inset-bottom))",
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* Edit-mode buttons */}
                {editing && !editSubPanelOpen && (
                  <>
                    <button type="button" onClick={handleDelete} disabled={loading || moving}
                      className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-rose-600 disabled:opacity-60">
                      <Trash2 className="h-[14px] w-[14px]" strokeWidth={2} />
                      {tr("common.delete")}
                    </button>
                    {!editing._pending && (
                      <button type="button" onClick={() => setShowRecurringPicker(true)} disabled={loading || moving || creatingRecurring}
                        className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-60">
                        <Repeat className="h-[14px] w-[14px]" strokeWidth={2} />
                        Recurring
                      </button>
                    )}
                    {!editing._pending && otherLedgers.length > 0 && (
                      <button type="button" onClick={() => setShowMovePicker(true)} disabled={loading || moving || creatingRecurring}
                        className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-60">
                        <ArrowRightLeft className="h-[14px] w-[14px]" strokeWidth={2} />
                        Move
                      </button>
                    )}
                  </>
                )}
                {/* Recurring options (create-recurring mode) */}
                {!editing && !isTransfer && recurringMode && (
                  <div className="flex items-center gap-2">
                    <InlineDropdown
                      ariaLabel={tr("recurring.frequency")}
                      value={frequency}
                      onChange={(v) => setFrequency(v as RecurringFrequency)}
                      options={[
                        { key: "weekly", label: tr("recurring.weekly") },
                        { key: "monthly", label: tr("recurring.monthly") },
                        { key: "yearly", label: tr("recurring.yearly") },
                      ]}
                    />
                    <span className="text-[12.5px] font-medium text-[var(--label-secondary)]">{tr("recurring.untilWord")}</span>
                    <InlineDropdown
                      ariaLabel={tr("recurring.repeatUntil")}
                      value={repeatUntilMode}
                      displayLabel={
                        repeatUntilMode === "forever"
                          ? tr("recurring.forever")
                          : repeatUntilDate
                            ? formatChipDate(repeatUntilDate)
                            : tr("recurring.onDate")
                      }
                      onChange={(v) => {
                        setRepeatUntilMode(v as "forever" | "date");
                        if (v === "date") setTimeout(() => endDateRef.current?.showPicker?.(), 50);
                      }}
                      options={[
                        { key: "forever", label: tr("recurring.forever") },
                        { key: "date", label: repeatUntilDate ? formatChipDate(repeatUntilDate) : tr("recurring.onDate") },
                      ]}
                    />
                    <input
                      ref={endDateRef}
                      type="date"
                      value={repeatUntilDate}
                      min={date}
                      onChange={(e) => setRepeatUntilDate(e.target.value)}
                      className="pointer-events-none absolute h-px w-px border-0 p-0 opacity-0"
                    />
                  </div>
                )}
                {/* Photo chips (create mode, no photo yet) */}
                {!editing && !isTransfer && !recurringMode && !photoPreview && (
                  <>
                    <PhotoChip icon="camera" label="Camera" onClick={() => cameraRef.current?.click()} />
                    <PhotoChip icon="gallery" label="Gallery" onClick={() => fileRef.current?.click()} />
                  </>
                )}
              </div>

              {/* Circular Save */}
              <button
                type="submit"
                disabled={!canSave || loading || moving}
                aria-label={editing ? tr("common.saveChanges") : tr("tx.add")}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-all"
                style={{
                  background: !canSave || loading || moving
                    ? "color-mix(in oklab, #EE6452 35%, var(--background))"
                    : ATX_CORAL,
                  boxShadow: !canSave || loading || moving ? "none" : "0 6px 14px rgba(238,100,82,0.30)",
                }}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} /> : <Check className="h-[22px] w-[22px]" strokeWidth={2.75} />}
              </button>
            </div>

            {/* In-app numeric keypad — the sheet's bottom section while
                the amount field is active. Replaces the native numeric
                keyboard entirely (which always carries the un-removable
                iOS ‹ › Done accessory bar). */}
            {amountActive && (
              <NumericKeypad onDigit={pushDigit} onBackspace={backspaceAmount} />
            )}
          </form>
        </div>
        </div>
      )}

      {/* Bento pickers — siblings of the sheet, slide up while it recedes */}
      {open && showCategoryPicker && (
        <CategoryPicker
          categories={allCategories}
          selected={categoryId}
          type={type === "income" ? "income" : "expense"}
          onSelect={(id) => {
            setCategoryId(id);
            setUserTouchedCategory(true);
            setAiSource(null);
          }}
          onCloseStart={() => setPickerVisible(false)}
          onClose={() => setShowCategoryPicker(false)}
          onCategoryAdded={(cat) => setExtraCategories((prev) => [...prev, cat])}
          iconStyle={iconStyle}
        />
      )}
      {open && showWalletPicker && (
        <WalletPickerSheet
          wallets={allWallets}
          selected={walletPickerSlot === "to" ? toWalletId : walletId}
          title={
            walletPickerSlot === "from" ? tr("tx.transferFrom")
              : walletPickerSlot === "to" ? tr("tx.transferTo")
              : tr("wallet.title")
          }
          onSelect={(id) => {
            if (walletPickerSlot === "to") setToWalletId(id);
            else setWalletId(id);
          }}
          onCloseStart={() => setPickerVisible(false)}
          onClose={() => setShowWalletPicker(false)}
          onWalletAdded={(w) => {
            setExtraWallets((prev) => [...prev, w]);
            onWalletAdded?.(w);
          }}
          iconStyle={iconStyle}
          currency={currency}
        />
      )}

      <PhotoViewer
        url={showPhotoViewer ? photoPreview : null}
        downloadName={name ? `${name.replace(/[^\w-]+/g, "_")}-${date}.jpg` : `transaction-${date}.jpg`}
        onClose={() => setShowPhotoViewer(false)}
      />
    </>
  );
}

// ─── Local pill components ────────────────────────────────────────────

function pillBase() {
  return "flex h-12 w-full items-center gap-2.5 rounded-full border border-[var(--separator)] bg-[var(--background)] px-4 transition-colors active:bg-black/[0.04]";
}

function WalletPillButton({
  wallet,
  iconStyle,
  placeholder,
  onClick,
}: {
  wallet: DbWallet | null;
  iconStyle: IconStyle;
  placeholder: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={pillBase()}>
      {wallet ? (
        <>
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${wallet.color}26` }}>
            <CategoryIcon symbol={wallet.symbol} iconStyle={iconStyle} size={15} emojiSize="14px" color={iconStyle === "2d" ? wallet.color : undefined} />
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-[14.5px] font-medium text-[var(--foreground)]">{wallet.name}</span>
        </>
      ) : (
        <span className="flex-1 text-left text-[14.5px] text-[var(--label-tertiary)]">{placeholder}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--label-tertiary)]" strokeWidth={2} />
    </button>
  );
}

function CategoryPillButton({
  category,
  iconStyle,
  aiSource,
  loading,
  placeholder,
  onClick,
}: {
  category: DbCategory | null;
  iconStyle: IconStyle;
  aiSource: boolean;
  loading: boolean;
  placeholder: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={pillBase()}>
      {category ? (
        <>
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${category.color}26` }}>
            <CategoryIcon symbol={category.symbol} iconStyle={iconStyle} size={15} emojiSize="14px" color={iconStyle === "2d" ? category.color : undefined} />
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-[14.5px] font-medium text-[var(--foreground)]">{category.name}</span>
          {aiSource && <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--label-tertiary)]" strokeWidth={2.25} />}
        </>
      ) : (
        <span className="flex-1 text-left text-[14.5px] text-[var(--label-tertiary)]">{placeholder}</span>
      )}
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--label-tertiary)]" strokeWidth={2} />}
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--label-tertiary)]" strokeWidth={2} />
    </button>
  );
}

function PhotoChip({ icon, label, onClick }: { icon: "camera" | "gallery"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[var(--separator)] bg-transparent pl-[11px] pr-[13px] text-[13px] font-semibold text-[var(--label-secondary)]"
    >
      {icon === "camera" ? <Camera className="h-[15px] w-[15px]" strokeWidth={2} /> : <ImagePlus className="h-[15px] w-[15px]" strokeWidth={2} />}
      {label}
    </button>
  );
}
