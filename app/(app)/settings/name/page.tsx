"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Trash2, Loader2 } from "lucide-react";
import { deleteCurrentHousehold, updateHouseholdName } from "@/app/actions/households";

export default function LedgerNamePage() {
  return (
    <Suspense fallback={null}>
      <LedgerNamePageInner />
    </Suspense>
  );
}

function LedgerNamePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("current") ?? "";
  // /settings adds `&owner=1` only when the current user is the household
  // owner. The server action enforces the same check; this flag just
  // controls whether the delete button is visible in the UI.
  const isOwner = params.get("owner") === "1";
  const [, startTransition] = useTransition();
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== initial && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const result = await updateHouseholdName(trimmed);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    startTransition(() => { router.back(); });
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteCurrentHousehold();
    if (result.error) {
      setDeleting(false);
      setDeleteError(result.error);
      return;
    }
    startTransition(() => {
      router.replace("/transactions");
      router.refresh();
    });
  }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-4 pb-4 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          Ledger name
        </h1>
        {isOwner ? (
          <button
            onClick={() => {
              setDeleteError(null);
              setConfirmOpen(true);
            }}
            aria-label="Delete ledger"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-rose-600 ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>
        ) : (
          <div className="h-9 w-9" />
        )}
      </header>

      <p className="px-6 pb-4 text-[13px] text-[var(--label-secondary)]">
        Rename this ledger. The name appears in the header and ledger switcher.
      </p>

      <div className="mx-5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Personal, Homu"
          maxLength={60}
          autoFocus
          className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow placeholder:text-[var(--label-tertiary)]"
        />
        {error && (
          <p className="mt-2 px-1 text-[12px] text-rose-600">{error}</p>
        )}
      </div>

      <div className="mx-5 mt-5">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="h-12 w-full rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-white disabled:opacity-40 transition-opacity active:scale-[0.99]"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {confirmOpen && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/50"
            onClick={() => { if (!deleting) setConfirmOpen(false); }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ledger-title"
            className="fixed bottom-0 left-1/2 z-[90] w-full max-w-md -translate-x-1/2 rounded-t-3xl bg-[var(--surface)] px-5 pb-8 pt-5"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10" />
            <h2
              id="delete-ledger-title"
              className="text-[17px] font-semibold text-[var(--foreground)]"
            >
              Delete this ledger?
            </h2>
            <p className="mt-2 text-[13px] leading-snug text-[var(--label-secondary)]">
              {initial
                ? <>This permanently deletes <span className="font-semibold text-[var(--foreground)]">{initial}</span> and all of its wallets, categories, transactions, recurring items, and members. This cannot be undone.</>
                : <>This permanently deletes the ledger and all of its wallets, categories, transactions, recurring items, and members. This cannot be undone.</>
              }
            </p>
            {deleteError && (
              <p className="mt-3 text-[12px] text-rose-600">{deleteError}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-[var(--background)] text-[14px] font-medium text-[var(--label-secondary)] ring-1 ring-black/[0.06] disabled:opacity-50 active:bg-black/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-rose-600 text-[14px] font-semibold text-white disabled:opacity-60 active:scale-[0.99]"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
