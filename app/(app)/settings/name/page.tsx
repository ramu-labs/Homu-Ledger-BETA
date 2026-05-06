"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { updateHouseholdName } from "@/app/actions/households";

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
  const [, startTransition] = useTransition();
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="pb-10">
      <header className="flex items-center justify-between px-5 pt-4 pb-4">
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
        <div className="h-9 w-9" />
      </header>

      <p className="px-6 pb-4 text-[13px] text-[var(--label-secondary)]">
        Rename this ledger. The name appears in the header and ledger switcher.
      </p>

      <div className="mx-5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Personal, Family"
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
    </div>
  );
}
