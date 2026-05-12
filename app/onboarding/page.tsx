"use client";

import { Suspense, useState } from "react";
import { createHousehold, joinHousehold, signOut } from "@/app/actions/auth";
import WelcomeProModal from "@/components/welcome-pro-modal";

type Mode = "choose" | "create" | "join";

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

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createHousehold(new FormData(e.currentTarget));
    if (result?.error) { setError(result.error); setLoading(false); }
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
            Create a new shared space or join your partner's
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
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-[var(--background)] px-6 py-12">
        <button
          onClick={() => { setMode("choose"); setError(null); }}
          className="mb-6 flex items-center gap-1 text-[14px] font-medium text-[var(--label-secondary)]"
        >
          ← Back
        </button>
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
          Create your ledger
        </h1>
        <p className="mb-6 text-[14px] text-[var(--label-secondary)]">
          Give it a name. Your partner will join using the invite code we generate.
        </p>
        <form onSubmit={handleCreate} className="space-y-3">
          <InputField label="Ledger name" name="name" placeholder="e.g. Marcel & Partner" />
          <InputField
            label="Opening balance (Rp)"
            name="opening_balance"
            placeholder="0"
            hint="Optional — your current starting balance"
            inputMode="numeric"
          />

          {error && <ErrorBox>{error}</ErrorBox>}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-[var(--on-foreground)] shadow-sm transition-opacity disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create ledger"}
          </button>
        </form>
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

function InputField({
  label,
  name,
  placeholder,
  hint,
  inputMode,
}: {
  label: string;
  name: string;
  placeholder: string;
  hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
        {label}
      </label>
      <input
        name={name}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
      />
      {hint && <p className="mt-1 px-1 text-[12px] text-[var(--label-tertiary)]">{hint}</p>}
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
