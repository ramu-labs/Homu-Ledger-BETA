"use client";

// Shared 3-step ledger setup flow (v1.38.1).
//
// Used by:
//   - app/onboarding/page.tsx          → initial onboarding ("Create a ledger" branch)
//   - app/(app)/settings/new-ledger    → "Create new ledger" from Settings
//
// Same component, just different `onCreate` callback. Keeps the
// experience visually identical between first-time signup and the
// later "add another ledger" path.
//
// Steps:
//   1. "name"       — ledger name + currency + opening balance
//   2. "use_case"   — what is this ledger for? (6 options from
//                     lib/onboarding-presets.ts → USE_CASES)
//   3. "categories" — full expense-category picker, preselected
//                     according to the use case
//
// Income + wallet defaults are applied automatically on submit
// (no picker — see lib/household-presets-server.ts).

import { useState } from "react";
import {
  USE_CASES,
  USE_CASE_CATEGORIES,
  USE_CASE_PRESELECTED_CATS,
  type UseCaseId,
} from "@/lib/onboarding-presets";
import { CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "@/components/category-icon";

type Step = "name" | "use_case" | "categories";

export type LedgerSetupFlowProps = {
  /** Server-action invoker. Receives the FormData with all four
   *  fields set: `name`, `currency`, `opening_balance`, `use_case`,
   *  `selected_categories`. Returns `{ error }` on failure; on
   *  success the action is expected to redirect — control will not
   *  return to this component. */
  onCreate: (fd: FormData) => Promise<{ error?: string } | undefined>;
  /** Called when the user taps Back on step 1. The caller decides
   *  where to go — onboarding wires it to `setMode("choose")`; the
   *  new-ledger page wires it to `router.back()`. */
  onBackFromStep1: () => void;
  /** Hide the Back button entirely on step 1 (used in onboarding's
   *  Create-a-ledger entry, where the parent already manages the
   *  mode-picker → create transition). */
  hideBackOnStep1?: boolean;
  /** Optional initial values for testing / pre-filling. */
  initialName?: string;
  initialCurrency?: string;
};

export default function LedgerSetupFlow({
  onCreate,
  onBackFromStep1,
  hideBackOnStep1,
  initialName = "",
  initialCurrency = "IDR",
}: LedgerSetupFlowProps) {
  const [step, setStep] = useState<Step>("name");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [ledgerName, setLedgerName] = useState(initialName);
  const [currency, setCurrency] = useState(initialCurrency);
  const [openingBalance, setOpeningBalance] = useState("");
  const [useCase, setUseCase] = useState<UseCaseId | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set()
  );

  function handleNameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!ledgerName.trim()) {
      setError("Give your ledger a name.");
      return;
    }
    setStep("use_case");
  }

  function handleUseCasePick(id: UseCaseId) {
    setUseCase(id);
    setSelectedCategoryIds(new Set(USE_CASE_PRESELECTED_CATS[id]));
    setStep("categories");
  }

  async function handleFinalCreate() {
    setError(null);
    if (!useCase) {
      setError("Pick a use case first.");
      setStep("use_case");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set("name", ledgerName.trim());
    fd.set("currency", currency);
    fd.set("opening_balance", openingBalance);
    fd.set("use_case", useCase);
    fd.set("selected_categories", JSON.stringify(Array.from(selectedCategoryIds)));
    const result = await onCreate(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success the action redirects — nothing to do here.
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[var(--background)] px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        {step === "name" && hideBackOnStep1 ? (
          <span />
        ) : (
          <button
            onClick={() => {
              setError(null);
              if (step === "categories") setStep("use_case");
              else if (step === "use_case") setStep("name");
              else onBackFromStep1();
            }}
            className="flex items-center gap-1 text-[14px] font-medium text-[var(--label-secondary)]"
          >
            ← Back
          </button>
        )}
        <StepDots step={step} />
      </div>

      {step === "name" && (
        <>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            Name your ledger
          </h1>
          <p className="mb-6 text-[14px] text-[var(--label-secondary)]">
            You can change this later. Your partner will join using the invite code we generate.
          </p>
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Ledger name</label>
              <input
                value={ledgerName}
                onChange={(e) => setLedgerName(e.target.value)}
                placeholder="e.g. Marc's Family"
                required
                className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Opening balance</label>
              <input
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
              <p className="mt-1 px-1 text-[12px] text-[var(--label-tertiary)]">Optional — your current starting balance</p>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-[var(--on-foreground)] shadow-sm transition-opacity active:opacity-90"
            >
              Next
            </button>
          </form>
        </>
      )}

      {step === "use_case" && (
        <>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            What&apos;s this ledger for?
          </h1>
          <p className="mb-6 text-[14px] text-[var(--label-secondary)]">
            We&apos;ll pre-pick categories that fit. Tap any to start; you can change everything later.
          </p>
          <div className="space-y-2.5">
            {USE_CASES.map((uc) => (
              <button
                key={uc.id}
                onClick={() => handleUseCasePick(uc.id)}
                className="flex w-full items-center gap-4 rounded-2xl bg-[var(--surface)] p-4 text-left ring-1 ring-black/[0.05] shadow-sm active:scale-[0.99] transition-transform [touch-action:manipulation]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--background)] text-2xl">
                  {uc.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">{uc.title}</p>
                  <p className="text-[12px] text-[var(--label-secondary)]">{uc.sub}</p>
                </div>
                <span className="text-[var(--label-tertiary)]">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "categories" && (
        <>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            Pick your categories
          </h1>
          <p className="mb-4 text-[14px] text-[var(--label-secondary)]">
            We&apos;ve preselected ones that fit. Toggle any in or out.
          </p>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            {selectedCategoryIds.size} selected
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* v1.40.0 — picker shows ONLY the chosen use-case's
                category list (not the deduped union). So family
                doesn't show "Office supplies", business doesn't
                show "Baby", etc. The preselection set is a subset
                of this list by construction. */}
            {(useCase ? USE_CASE_CATEGORIES[useCase] : []).map((c) => {
              const isSelected = selectedCategoryIds.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedCategoryIds);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    setSelectedCategoryIds(next);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-all [touch-action:manipulation]",
                    isSelected
                      ? "bg-[var(--foreground)]/10 ring-2 ring-[var(--foreground)]/30"
                      : "bg-[var(--surface)] ring-1 ring-black/[0.06]"
                  )}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px]"
                    style={{ backgroundColor: `${c.color}1A` }}
                  >
                    <CategoryIcon symbol={c.symbol} iconStyle="3d" size={20} emojiSize="18px" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--foreground)]">
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>

          {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}

          <button
            onClick={handleFinalCreate}
            disabled={loading || selectedCategoryIds.size === 0}
            className="sticky bottom-4 mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-[var(--on-foreground)] shadow-lg transition-opacity disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create ledger"}
          </button>
        </>
      )}
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const idx = step === "name" ? 0 : step === "use_case" ? 1 : 2;
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === idx ? "w-6 bg-[var(--foreground)]" : "w-1.5 bg-[var(--label-tertiary)]/40"
          )}
        />
      ))}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
      {children}
    </p>
  );
}
