"use client";

import { useState } from "react";
import { completeGoogleProfile } from "@/app/actions/auth";
import { useT } from "@/lib/i18n/provider";

type Props = {
  initialName: string;
  email: string;
};

export default function SetupForm({ initialName, email }: Props) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPromo, setShowPromo] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await completeGoogleProfile(new FormData(e.currentTarget));
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  return (
    <div className="w-full">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/homu-login.png" alt="Homu" className="mx-auto mb-5 h-28 w-28 object-contain" />
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("auth.almostThere")}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--label-secondary)]">
          {t("auth.pickUsernameSub")}
        </p>
        {email && (
          <p className="mt-2 text-[12px] text-[var(--label-tertiary)]">{email}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
            {t("auth.yourName")}
          </label>
          <input
            name="name"
            type="text"
            defaultValue={initialName}
            placeholder="Marcel"
            autoComplete="name"
            className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
            {t("auth.username")}
          </label>
          <input
            name="username"
            type="text"
            placeholder="marcel123"
            required
            autoComplete="username"
            inputMode="text"
            spellCheck={false}
            autoCapitalize="none"
            className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
          />
          <p className="mt-1.5 px-1 text-[12px] text-[var(--label-tertiary)]">
            {t("auth.usernameHint")}
          </p>
        </div>

        {/* Promo code — optional. Hidden behind a disclosure so the
            free-tier path is the visible default, and users with codes can
            still tap to reveal. */}
        {showPromo ? (
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
              {t("auth.promoCodeOptional")}
            </label>
            <input
              name="promo_code"
              type="text"
              placeholder={t("auth.promoCodePh")}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] font-mono uppercase tracking-[0.12em] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] placeholder:font-mono focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              style={{ textTransform: "uppercase" }}
            />
            <p className="mt-1.5 px-1 text-[12px] text-[var(--label-tertiary)]">
              {t("auth.promoCodeHintOptional")}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPromo(true)}
            className="block w-full text-center text-[13px] font-medium text-[var(--label-secondary)] py-2 transition-colors active:text-[var(--foreground)]"
          >
            {t("auth.haveAPromoCode")}
          </button>
        )}

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
          {loading ? t("auth.saving") : t("auth.continue")}
        </button>
      </form>
    </div>
  );
}
