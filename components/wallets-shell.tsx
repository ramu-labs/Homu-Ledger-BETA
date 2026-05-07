"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import AddWalletSheet from "@/components/add-wallet-sheet";
import EditWalletSheet from "@/components/edit-wallet-sheet";
import { useT } from "@/lib/i18n/provider";
import { formatAmount } from "@/lib/format";
import type { DbWallet } from "@/lib/types";
import type { IconStyle } from "@/lib/category-icons";

type WalletWithBalance = DbWallet & { balance: number };

type Props = {
  wallets: WalletWithBalance[];
  iconStyle?: IconStyle;
  currency?: string;
};

export default function WalletsShell({ wallets: initial, iconStyle = "3d", currency = "IDR" }: Props) {
  const router = useRouter();
  const tr = useT();
  const [wallets, setWallets] = useState<WalletWithBalance[]>(initial);
  const [editing, setEditing] = useState<DbWallet | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  function openEdit(w: DbWallet) {
    setEditing(w);
    setEditOpen(true);
  }

  function handleAdded(w: DbWallet) {
    // New wallets start with balance = initial_balance (no transactions yet)
    setWallets((prev) => [...prev, { ...w, balance: Number(w.initial_balance ?? 0) }]);
  }

  function handleUpdated(w: DbWallet) {
    setWallets((prev) =>
      prev.map((existing) =>
        existing.id === w.id
          ? {
              ...existing,
              ...w,
              // Recompute balance with new initial_balance: balance = old_balance - old_initial + new_initial
              balance:
                existing.balance - Number(existing.initial_balance ?? 0) + Number(w.initial_balance ?? 0),
            }
          : existing
      )
    );
  }

  function handleDeleted(id: string) {
    setWallets((prev) => prev.filter((w) => w.id !== id));
  }

  function handleDefaultChanged(newDefaultId: string) {
    setWallets((prev) =>
      prev.map((w) => ({ ...w, is_default: w.id === newDefaultId }))
    );
    // Sync the editing wallet so its is_default flag updates in the open sheet
    setEditing((curr) => (curr ? { ...curr, is_default: curr.id === newDefaultId } : curr));
  }

  return (
    <>
      <div className="pb-10">
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <button
            onClick={() => router.back()}
            aria-label={tr("common.back")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
          >
            <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
          </button>
          <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
            {tr("wallet.wallets")}
          </h1>
          <button
            onClick={() => setAddOpen(true)}
            aria-label={tr("wallet.addNew")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--foreground)] text-white shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>
        </header>

        <section className="mt-5">
          {wallets.length === 0 ? (
            <p className="mx-5 rounded-2xl bg-[var(--surface)] px-4 py-10 text-center text-[14px] text-[var(--label-secondary)] ring-1 ring-black/[0.04]">
              {tr("wallet.empty")}
            </p>
          ) : (
            <ul className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] divide-y divide-[var(--separator)]">
              {wallets.map((w) => (
                <WalletRow
                  key={w.id}
                  wallet={w}
                  iconStyle={iconStyle}
                  currency={currency}
                  onTap={openEdit}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <AddWalletSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
        iconStyle={iconStyle}
        currency={currency}
      />

      <EditWalletSheet
        open={editOpen}
        wallet={editing}
        onClose={() => setEditOpen(false)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
        onDefaultChanged={handleDefaultChanged}
        iconStyle={iconStyle}
        currency={currency}
      />
    </>
  );
}

function WalletRow({
  wallet,
  iconStyle = "3d",
  currency,
  onTap,
}: {
  wallet: WalletWithBalance;
  iconStyle?: IconStyle;
  currency: string;
  onTap: (w: DbWallet) => void;
}) {
  const tr = useT();
  return (
    <li>
      <button
        onClick={() => onTap(wallet)}
        className="flex w-full items-center gap-3 px-4 py-3 min-h-[60px] text-left active:bg-black/[0.02] transition-colors"
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${wallet.color}22` }}
        >
          <CategoryIcon
            symbol={wallet.symbol}
            iconStyle={iconStyle}
            size={20}
            emojiSize="20px"
            color={iconStyle === "2d" ? wallet.color : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[15px] font-medium text-[var(--foreground)]">
            {wallet.name}
            {wallet.is_default && (
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" strokeWidth={2} />
            )}
          </p>
          <p className="text-[12px] text-[var(--label-secondary)]">
            {tr("wallet.balance")}: {formatAmount(wallet.balance, currency)}
          </p>
        </div>
        <ChevronRight className="h-[18px] w-[18px] text-[var(--label-tertiary)]" strokeWidth={2} />
      </button>
    </li>
  );
}
