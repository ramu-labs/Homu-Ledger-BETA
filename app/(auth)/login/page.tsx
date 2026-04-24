"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import AddToHomescreenBanner from "@/components/add-to-homescreen-banner";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(new FormData(e.currentTarget));
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  return (
    <>
      <AddToHomescreenBanner />
      <div className="w-full">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 h-14 w-14 overflow-hidden rounded-2xl shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="Homu" className="h-full w-full object-cover" />
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--foreground)]">
          Homu
        </h1>
        <p className="mt-1 text-[14px] text-[var(--label-secondary)]">
          Sign in to your shared account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Email or username" name="identifier" type="text" placeholder="you@example.com or marcel123" />
        <Field label="Password" name="password" type="password" placeholder="••••••••" />

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--foreground)] text-[15px] font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--label-secondary)]">
        No account?{" "}
        <Link href="/signup" className="font-semibold text-[var(--foreground)]">
          Create one
        </Link>
      </p>
    </div>
    </>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required
        autoComplete={name === "password" ? "current-password" : "username email"}
        className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
      />
    </div>
  );
}
