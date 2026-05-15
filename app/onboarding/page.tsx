"use client";

import { Suspense, useState } from "react";
import { createHousehold, joinHousehold, signOut } from "@/app/actions/auth";
import WelcomeProModal from "@/components/welcome-pro-modal";
import {
  USE_CASES,
  EXPENSE_CATEGORY_MASTER,
  USE_CASE_PRESELECTED_CATS,
  type UseCaseId,
} from "@/lib/onboarding-presets";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "@/components/category-icon";

type Mode = "choose" | "create" | "join";

// v1.38.0 — Create flow is now a 3-step state machine.
//   1. "name"       — ledger name + opening balance
//   2. "use_case"   — what is this ledger for? (6 options)
//   3. "categories" — full expense category picker, preselected
//                     based on the use case from step 2
// Income + wallet defaults are applied automatically (no picker).
// See lib/onboarding-presets.ts for the master list + mapping.
type CreateStep = "name" | "use_case" | "categories";

export default function OnboardingPage() {
  return (
    <>
      <Suspense fallback={null}>
        <WelcomeProModal />
      </Suspense>
      <OnboardingInner />
    </>
  );
}

function OnboardingInner() {
  const [mode, setMode] = useState<Mode>("choose");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");

  // Multi-step "create" flow state ──────────────────────────────────
  const [createStep, setCreateStep] = useState<CreateStep>("name");
  const [ledgerName, setLedgerName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [useCase, setUseCase] = useState<UseCaseId | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set()
  );

  // ── Step 1 → 2: capture name + balance, move to use-case picker.
  function handleNameSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!ledgerName.trim()) {
      setError("Give your ledger a name.");
      return;
    }
    setCreateStep("use_case");
  }

  // ── Step 2 → 3: capture use case, seed the picker preselections.
  function handleUseCasePick(id: UseCaseId) {
    setUseCase(id);
    setSelectedCategoryIds(new Set(USE_CASE_PRESELECTED_CATS[id]));
    setCreateStep("categories");
  }

  // ── Step 3 → submit: createHousehold with use_case + selection.
  async function handleFinalCreate() {
    setError(null);
    if (!useCase) {
      setError("Pick a use case first.");
      setCreateStep("use_case");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set("name", ledgerName.trim());
    fd.set("opening_balance", openingBalance);
    fd.set("use_case", useCase);
    fd.set("selected_categories", JSON.stringify(Array.from(selectedCategoryIds)));
    const result = await createHousehold(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await joinHousehold(new FormData(e.currentTarget));
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  if (mode === "choose") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-[var(--background)] px-6 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--foreground)] text-2xl text-[var(--on-foreground)] shadow-lg">
            🏠
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)]">
            Set up your ledger
          </h1>
          <p className="mt-1 text-[14px] text-[var(--label-secondary)]">
            Create a new shared space or join your partner&apos;s
          </p>
        </div>

        <div className="w-full space-y-3">
          <OptionCard
            emoji="✨"
            title="Create a ledger"
            sub="Start fresh — your partner joins with your invite code"
            onClick={() => setMode("create")}
          />
          <OptionCard
            emoji="🔗"
            title="Join a ledger"
            sub="Enter the 6-digit code your partner shared with you"
            onClick={() => setMode("join")}
          />
        </div>

        <form action={signOut} className="mt-8 w-full">
          <button
            type="submit"
            className="w-full text-center text-[13px] font-medium text-[var(--label-tertiary)] transition-colors active:text-[var(--label-secondary)]"
          >
            Log out
          </button>
        </form>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[var(--background)] px-6 py-12">
        {/* Back chevron + step-indicator dots. Walking back through
            the create flow steps before falling back to "choose". */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              setError(null);
              if (createStep === "categories") setCreateStep("use_case");
              else if (createStep === "use_case") setCreateStep("name");
              else { setMode("choose"); setCreateStep("name"); }
            }}
            className="flex items-center gap-1 text-[14px] font-medium text-[var(--label-secondary)]"
          >
            ← Back
          </button>
          <StepDots step={createStep} />
        </div>

        {/* ── Step 1: name + balance ─────────────────────────── */}
        {createStep === "name" && (
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
                  placeholder="e.g. Marcel & Partner"
                  required
                  className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Opening balance (Rp)</label>
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

        {/* ── Step 2: use-case picker ─────────────────────────── */}
        {createStep === "use_case" && (
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

        {/* ── Step 3: category picker ─────────────────────────── */}
        {createStep === "categories" && (
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
              {EXPENSE_CATEGORY_MASTER.map((c) => {
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

  // mode === "join"
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-[var(--background)] px-6 py-12">
      <button
        onClick={() => { setMode("choose"); setError(null); }}
        className="mb-6 flex items-center gap-1 text-[14px] font-medium text-[var(--label-secondary)]"
      >
        ← Back
      </button>
      <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
        Join a ledger
      </h1>
      <p className="mb-6 text-[14px] text-[var(--label-secondary)]">
        Enter the 6-digit invite code from your partner.
      </p>
      <form onSubmit={handleJoin} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
            Invite code
          </label>
          <input
            name="invite_code"
            placeholder="ABC123"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="h-14 w-full rounded-2xl bg-[var(--surface)] px-4 text-center text-[22px] font-bold tracking-[0.2em] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
          />
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-[var(--on-foreground)] shadow-sm transition-opacity disabled:opacity-60"
        >
          {loading ? "Joining…" : "Join ledger"}
        </button>
      </form>
    </div>
  );
}

function OptionCard({
  emoji,
  title,
  sub,
  onClick,
}: {
  emoji: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-[var(--surface)] p-4 text-left ring-1 ring-black/[0.05] shadow-sm active:scale-[0.99] transition-transform"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--background)] text-2xl">
        {emoji}
      </span>
      <div>
        <p className="text-[15px] font-semibold text-[var(--foreground)]">{title}</p>
        <p className="text-[12px] text-[var(--label-secondary)]">{sub}</p>
      </div>
      <span className="ml-auto text-[var(--label-tertiary)]">›</span>
    </button>
  );
}

/** Three-dot step indicator at the top-right of the create flow. */
function StepDots({ step }: { step: CreateStep }) {
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
