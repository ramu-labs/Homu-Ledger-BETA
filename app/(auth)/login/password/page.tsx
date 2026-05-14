"use client";

// Email / password sign-in form. Moved out of /login in v1.24.0 — that
// route is now a landing page that shows Google + Sign up as the primary
// paths, with a tiny "Already have an account? Sign in" link routing
// here. Existing users coming back can still sign in with email/password
// (or username/password); new users are funneled through Google.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import { signIn } from "@/app/actions/auth";
import { useT } from "@/lib/i18n/provider";

export default function PasswordLoginPage() {
  return (
    <Suspense fallback={null}>
      <PasswordLoginInner />
    </Suspense>
  );
}

function PasswordLoginInner() {
  const t = useT();
  const params = useSearchParams();
  // OAuth errors from /auth/callback are surfaced via ?oauth_error=… —
  // they're shown on /login (the landing page) but can also arrive here
  // if the user navigated mid-flow.
  const oauthError = params.get("oauth_error");
  const [error, setError] = useState<string | null>(oauthError);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (oauthError) setError(oauthError);
  }, [oauthError]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn(new FormData(e.currentTarget));
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  return (
    <div className="w-full">
      {/* Back link returns to the landing /login. Kept text-only +
          chevron so it doesn't compete with the form's primary CTA. */}
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--label-secondary)] [touch-action:manipulation]"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
        {t("common.back")}
      </Link>

      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/homu-login.png" alt="Homu" className="mx-auto mb-5 h-32 w-32 object-contain" />
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("auth.signIn")}
        </h1>
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
