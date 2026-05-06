"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import AddToHomescreenBanner from "@/components/add-to-homescreen-banner";
import { useT } from "@/lib/i18n/provider";

export default function LoginPage() {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/homu-login.png" alt="Homu" className="mx-auto mb-5 h-44 w-44 object-contain" />
        <p className="mt-1 text-[14px] text-[var(--label-secondary)]">
          {t("auth.signInTo")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label={t("auth.emailOrUsername")} name="identifier" type="text" placeholder={t("auth.emailOrUsernamePh")} />

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 pr-12 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-[var(--label-tertiary)] transition-colors hover:text-[var(--label-secondary)]"
              aria-label={showPassword ? t("common.close") : t("auth.password")}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" strokeWidth={2} />
                : <Eye className="h-4 w-4" strokeWidth={2} />
              }
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
        >
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--label-secondary)]">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-[var(--foreground)]">
          {t("auth.createOne")}
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
