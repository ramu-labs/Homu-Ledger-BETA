"use client";

import { useState, useEffect } from "react";
import { X, Trash2, Star } from "lucide-react";
import { updateWallet, deleteWallet, setDefaultWallet } from "@/app/actions/wallets";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/provider";
import { WALLET_ICONS, makeWalletLucideSymbol } from "@/lib/wallet-icons";
import { CategoryIcon } from "@/components/category-icon";
import type { DbWallet } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

const COLOR_PALETTE = [
  "#22c55e", "#3b82f6", "#8b5cf6", "#f97316",
  "#ef4444", "#ec4899", "#eab308", "#14b8a6", "#6b7280",
];

type Props = {
  open: boolean;
  wallet: DbWallet | null;
  onClose: () => void;
  onUpdated: (w: DbWallet) => void;
  onDeleted: (id: string) => void;
  onDefaultChanged: (newDefaultId: string) => void;
  iconStyle?: IconStyle;
  currency?: string;
};

export default function EditWalletSheet({
  open, wallet, onClose, onUpdated, onDeleted, onDefaultChanged,
  iconStyle = "3d", currency = "IDR",
}: Props) {
  const tr = useT();
  const [name, setName] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [initialBalance, setInitialBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open && wallet) {
      setName(wallet.name);
      setSelectedSymbol(wallet.symbol);
      setSelectedColor(wallet.color);
      setInitialBalance(String(Math.round(Number(wallet.initial_balance ?? 0))));
      setError(null);
      setConfirmDelete(false);
      setLoading(false);
    }
  }, [open, wallet]);

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInitialBalance(e.target.value.replace(/\D/g, ""));
  }
  const balanceDisplay = initialBalance ? initialBalance.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;
    setError(null);
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("symbol", selectedSymbol);
    fd.set("color", selectedColor);
    fd.set("initial_balance", initialBalance || "0");
    const result = await updateWallet(wallet.id, fd);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onUpdated({
        ...wallet,
        name,
        symbol: selectedSymbol,
        color: selectedColor,
        initial_balance: Number(initialBalance || 0),
      });
      onClose();
    }
  }

  async function handleDelete() {
    if (!wallet) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    setError(null);
    const result = await deleteWallet(wallet.id);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      setConfirmDelete(false);
    } else {
      onDeleted(wallet.id);
      onClose();
    }
  }

  async function handleSetDefault() {
    if (!wallet || wallet.is_default) return;
    setLoading(true);
    const result = await setDefaultWallet(wallet.id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDefaultChanged(wallet.id);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[100] bg-black/40 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed bottom-0 left-1/2 z-[110] w-full max-w-md -translate-x-1/2 flex flex-col rounded-t-3xl bg-[var(--surface)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-black/10" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-3">
          <h2 className="text-[17px] font-semibold text-[var(--foreground)]">{tr("wallet.editWallet")}</h2>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[var(--label-secondary)]"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
          <div className="overflow-y-auto px-5 pb-4 space-y-4" style={{ maxHeight: "70dvh" }}>
            {/* Preview + default badge */}
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--background)] px-4 py-3 ring-1 ring-black/[0.06]">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${selectedColor}22` }}
              >
                <CategoryIcon
                  symbol={selectedSymbol}
                  iconStyle={iconStyle}
                  size={22}
                  emojiSize="22px"
                  color={iconStyle === "2d" ? selectedColor : undefined}
                />
              </div>
              <p className="flex-1 text-[15px] font-medium text-[var(--foreground)]">{name}</p>
              {wallet?.is_default && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {tr("wallet.default")}
                </span>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("category.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={tr("wallet.namePlaceholder")}
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {/* Initial balance */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("wallet.initialBalance")} ({currency})
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={balanceDisplay}
                onChange={handleAmountChange}
                placeholder="0"
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("category.icon")}
              </label>
              {iconStyle === "2d" ? (
                <div className="grid grid-cols-6 gap-2">
                  {WALLET_ICONS.map(({ lucideId, icon: Icon }) => {
                    const sym = makeWalletLucideSymbol(lucideId);
                    const isActive = selectedSymbol === sym;
                    return (
                      <button
                        key={lucideId}
                        type="button"
                        onClick={() => setSelectedSymbol(sym)}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-xl transition-all",
                          isActive
                            ? "ring-2 ring-[var(--foreground)]/30 scale-95"
                            : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                        )}
                        style={isActive ? { backgroundColor: `${selectedColor}22`, color: selectedColor } : undefined}
                      >
                        <Icon
                          size={20}
                          strokeWidth={2}
                          style={{ color: isActive ? selectedColor : undefined }}
                          className={isActive ? "" : "text-[var(--label-secondary)]"}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {WALLET_ICONS.map(({ emoji }) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedSymbol(emoji)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl text-[20px] transition-all",
                        selectedSymbol === emoji
                          ? "bg-[var(--foreground)]/10 ring-2 ring-[var(--foreground)]/30 scale-95"
                          : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Color */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {tr("category.color")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "h-9 w-9 rounded-full transition-all",
                      selectedColor === c ? "ring-2 ring-offset-2 ring-[var(--foreground)]/50 scale-110" : ""
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Set as default */}
            {!wallet?.is_default && (
              <button
                type="button"
                onClick={handleSetDefault}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--background)] py-3 text-[14px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.06] disabled:opacity-60"
              >
                <Star className="h-4 w-4" strokeWidth={2} />
                {tr("wallet.setAsDefault")}
              </button>
            )}

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">{error}</p>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--separator)] bg-[var(--surface)] px-5 pt-3 pb-8 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="flex h-13 w-full items-center justify-center rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {loading ? tr("common.saving") : tr("common.saveChanges")}
            </button>
            {!confirmDelete && !wallet?.is_default && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl text-[13px] font-medium text-rose-600 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                {tr("common.delete")}
              </button>
            )}
            {confirmDelete && (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-200 space-y-2">
                <p className="text-[13px] font-medium text-rose-700 text-center">{tr("wallet.deleteConfirm")}</p>
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
          </div>
        </form>
      </div>
    </>
  );
}
