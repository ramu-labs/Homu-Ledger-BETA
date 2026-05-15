"use client";

// Forgot-password flow (v1.33.0).
//
// Three-step state machine matching the signup OTP flow so the UX
// reads consistently:
//
//   email  →  otp  →  new-password  →  redirect to /transactions
//
// Each step renders inline (no separate routes) so we can carry state
// forward without query-string juggling. The final step uses the
// short-lived recovery session that verifyOtp creates to call
// updatePassword via our existing action.

import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  updatePassword,
} from "@/app/actions/auth";
import { useT } from "@/lib/i18n/provider";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
  const t = useT();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Autofocus the right field on each step transition. iOS keyboard
  // pops more reliably when the focus call rides the rAF after the
  // step swap settles.
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (step === "email") emailRef.current?.focus();
      else if (step === "otp") codeRef.current?.focus();
      else if (step === "password") pwRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [step]);

  async function handleSendEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResent(false);
    setLoading(true);
    const res = await sendPasswordResetOtp(email);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await verifyPasswordResetOtp(email, code);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    // verifyOtp left us with a recovery session — proceed to set the
    // new password on it.
    setStep("password");
  }

  async function handleSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
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
    // Recovery session is now a regular session — drop the user into
    // the app rather than back to /login so they don't have to type
    // anything else.
    router.push("/transactions");
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setResending(true);
    const res = await sendPasswordResetOtp(email);
    setResending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResent(true);
  }

  return (
    <div className="-mx-6 -my-12 flex min-h-dvh w-full max-w-md flex-col bg-[var(--background)]">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-3 pb-3 backdrop-blur">
        <button
          onClick={() => {
            // Step back through the flow before falling out to /login/password.
            if (step === "password") setStep("otp");
            else if (step === "otp") setStep("email");
            else router.push("/login/password");
          }}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {step === "email"
            ? t("forgot.titleEmail")
            : step === "otp"
            ? t("forgot.titleOtp")
            : t("forgot.titleNewPw")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      <div className="flex-1 px-6 pt-3 pb-10">
        {step === "email" && (
          <form onSubmit={handleSendEmail} className="space-y-3">
            <p className="mb-4 text-[14px] text-[var(--label-secondary)]">
              {t("forgot.emailIntro")}
            </p>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {t("auth.email")}
              </label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || email.length === 0}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />}
              {loading ? t("forgot.sending") : t("forgot.sendCode")}
            </button>
            <p className="mt-3 text-center text-[13px] text-[var(--label-secondary)]">
              {t("forgot.rememberPassword")}{" "}
              <Link href="/login/password" className="font-semibold text-[var(--foreground)]">
                {t("auth.signIn")}
              </Link>
            </p>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <div className="mb-6 text-center">
              <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05]">
                <MailCheck className="h-6 w-6" strokeWidth={2} />
              </span>
              <p className="text-[14px] text-[var(--label-secondary)]">
                {t("forgot.otpSentTo").replace("{email}", email)}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
                {t("auth.otpLabel")}
              </label>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                maxLength={8}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                className="h-14 w-full rounded-2xl bg-[var(--surface)] px-4 text-center text-[24px] font-semibold tracking-[0.4em] tabular-nums text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] placeholder:font-medium focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}
            {resent && !error && (
              <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-700 ring-1 ring-emerald-200">
                {t("auth.otpResent")}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || code.length < 4}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />}
              {loading ? t("auth.verifying") : t("auth.verify")}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-medium text-[var(--label-secondary)] disabled:opacity-60"
            >
              {resending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
              {resending ? t("auth.otpResending") : t("auth.otpResend")}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleSetPassword} className="space-y-3">
            <p className="mb-4 text-[14px] text-[var(--label-secondary)]">
              {t("forgot.setNewPwIntro")}
            </p>
            <PwInput
              ref={pwRef}
              label={t("security.newPassword")}
              value={newPw}
              onChange={setNewPw}
              show={showPw}
              onToggle={() => setShowPw((v) => !v)}
              autoComplete="new-password"
            />
            <PwInput
              label={t("security.confirmPassword")}
              value={confirmPw}
              onChange={setConfirmPw}
              show={showPw}
              onToggle={() => setShowPw((v) => !v)}
              autoComplete="new-password"
            />
            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || newPw.length === 0 || confirmPw.length === 0}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />}
              {loading ? t("common.saving") : t("forgot.savePassword")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Password input with a show/hide toggle. Pulled out so the three
 * steps that need it stay shorter. forwardRef so the autofocus
 * effect in the parent can reach the first input on the password step.
 */
type PwProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
};

const PwInput = forwardRef<HTMLInputElement, PwProps>(function PwInput(
  { label, value, onChange, show, onToggle, autoComplete },
  ref
) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 pr-12 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-[var(--label-tertiary)]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
});
