"use client";

// /settings/security — change password form.
//
// Per the v1.33.0 design decision, no "current password" field — we
// accept the friction trade-off for users who are already signed in.
// The page is intentionally narrow today (just password change) but
// is structured so 2FA / connected-accounts sections can drop in
// later without restructuring.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Eye, EyeOff, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { updatePassword } from "@/app/actions/auth";

type Props = {
  /** True if this account has an email/password identity (not Google-only). */
  hasEmailPassword: boolean;
  email: string;
};

export default function SecurityShell({ hasEmailPassword, email }: Props) {
  const router = useRouter();
  const t = useT();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPw.length < 8) {
      setError(t("security.passwordTooShort"));
      return;
    }
    if (newPw !== confirmPw) {
      setError(t("security.passwordMismatch"));
      return;
    }

    setLoading(true);
    const res = await updatePassword(newPw);
    setLoading(false);

    if (res.error) {
      setError(res.error);
      return;
    }
    setSaved(true);
    setNewPw("");
    setConfirmPw("");
    // No router.back() — leave the success state visible so the user
    // sees their action took effect. They can navigate away when ready.
  }

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-3 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {t("settings.security")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      {hasEmailPassword ? (
        <>
          <p className="px-6 pb-3 text-[13px] text-[var(--label-secondary)]">
            {t("security.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mx-5 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-black/[0.04] space-y-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              {t("security.changePassword")}
            </p>

            {/* New password */}
            <PasswordInput
              label={t("security.newPassword")}
              value={newPw}
              onChange={setNewPw}
              show={showPw}
              onToggle={() => setShowPw((v) => !v)}
              autoComplete="new-password"
            />

            {/* Confirm password */}
            <PasswordInput
              label={t("security.confirmPassword")}
              value={confirmPw}
              onChange={setConfirmPw}
              show={showPw}
              onToggle={() => setShowPw((v) => !v)}
              autoComplete="new-password"
            />

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}
            {saved && !error && (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 ring-1 ring-emerald-200">
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                {t("security.passwordUpdated")}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || newPw.length === 0 || confirmPw.length === 0}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#EE6452] text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {loading ? t("common.saving") : t("security.updatePassword")}
            </button>
          </form>
        </>
      ) : (
        // Google-only users: hide the password form, show a small hint
        // about how their account is currently signed in. No CTA —
        // we'd rather not auto-link a password from here yet (separate
        // feature with its own flow).
        <section className="mx-5 mt-2 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-black/[0.04]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[var(--foreground)]">
              <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[var(--foreground)]">
                {t("security.googleOnlyTitle")}
              </p>
              <p className="mt-1 text-[12px] text-[var(--label-secondary)]">
                {t("security.googleOnlyHint").replace("{email}", email)}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete={autoComplete}
          className={cn(
            "h-12 w-full rounded-2xl bg-[var(--background)] px-4 pr-12 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-[var(--label-tertiary)] transition-colors hover:text-[var(--label-secondary)]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
