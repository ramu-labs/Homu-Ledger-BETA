"use client";

// Sign-up page — v1.32.0 redesign.
//
// Changes vs. the old page:
//   - Pure email/password signup. No "Continue with Google" button.
//     The Google path lives on /login (the landing) and continues
//     through /auth/setup; signup is for fresh email accounts only.
//   - No Homu logo. The auth layout already centres the form on a
//     plain background; removing the logo gives space for the
//     longer form.
//   - Sticky header with a back button. Header is locked so the back
//     chevron stays reachable even with long forms / soft keyboard up.
//   - New fields: gender, date of birth, password confirmation.
//   - OTP step appears if Supabase email confirmation is enabled —
//     after the form is submitted successfully but no session is
//     returned, we swap to a 6-digit OTP input instead of redirecting.
//   - "Already have account? Sign in" now routes to /login/password
//     (the actual sign-in form), not the landing.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import {
  signUpStartEmailOtp,
  verifySignUpOtp,
  resendSignUpOtp,
} from "@/app/actions/auth";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

type Step = "form" | "otp";
type Gender = "male" | "female" | "other" | "prefer_not_to_say";

const GENDER_OPTIONS: { value: Gender; key: string }[] = [
  { value: "male", key: "auth.genderMale" },
  { value: "female", key: "auth.genderFemale" },
  { value: "other", key: "auth.genderOther" },
  { value: "prefer_not_to_say", key: "auth.genderPreferNotSay" },
];

export default function SignupPage() {
  const t = useT();
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Keep the email out of state when stepping into OTP so React doesn't
  // re-render the form with empty fields while we're showing OTP.
  const [otpEmail, setOtpEmail] = useState<string>("");
  const [gender, setGender] = useState<Gender | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!gender) {
      setError(t("auth.genderRequired"));
      return;
    }
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("gender", gender);
    const result = await signUpStartEmailOtp(fd);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (result.needsOtp) {
      // Move into the OTP step. The action has already created the
      // auth row; the email is in flight.
      setOtpEmail(result.email);
      setStep("otp");
    }
    // If !needsOtp the action already called redirect() — we don't
    // reach this branch.
  }

  return (
    <div className="-mx-6 -my-12 flex min-h-dvh w-full max-w-md flex-col bg-[var(--background)]">
      {/* Locked / sticky header. Lives outside the scroll surface so
          the back button stays reachable with a long form and the
          keyboard up. Back button placed top-left to match every
          other Settings sub-page in the app. */}
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-3 pb-3 backdrop-blur">
        <button
          onClick={() => {
            // Back from OTP → return to the form; back from the form
            // → go to wherever we came from (/login by default).
            if (step === "otp") {
              setStep("form");
              setError(null);
            } else {
              router.back();
            }
          }}
          aria-label={t("common.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          {step === "form" ? t("auth.createAccount") : t("auth.verifyEmail")}
        </h1>
        <div className="h-9 w-9" />
      </header>

      <div className="flex-1 px-6 pt-3 pb-10">
        {step === "form" ? (
          <SignupForm
            onSubmit={handleSubmit}
            error={error}
            loading={loading}
            showPassword={showPassword}
            toggleShowPassword={() => setShowPassword((v) => !v)}
            gender={gender}
            setGender={setGender}
            t={t}
          />
        ) : (
          <OtpStep
            email={otpEmail}
            t={t}
            onVerified={() => {
              // The server action calls redirect() so we never actually
              // reach this — but keep a handler in case the API ever
              // changes to return success without redirecting.
              router.push("/onboarding?welcome=1");
            }}
          />
        )}
      </div>
    </div>
  );
}

function SignupForm({
  onSubmit,
  error,
  loading,
  showPassword,
  toggleShowPassword,
  gender,
  setGender,
  t,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
  loading: boolean;
  showPassword: boolean;
  toggleShowPassword: () => void;
  gender: Gender | null;
  setGender: (g: Gender) => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <>
      <p className="mb-5 text-[14px] text-[var(--label-secondary)]">
        {t("auth.trackTogether")}
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <Field label={t("auth.yourName")} name="name" type="text" placeholder="Marcel" autoComplete="name" />
        <Field label={t("auth.username")} name="username" type="text" placeholder="marcel123" autoComplete="username" />
        <Field label={t("auth.email")} name="email" type="email" placeholder="you@example.com" autoComplete="email" />

        {/* Gender — radio pills. Stored as a controlled state in the
            parent so it can be validated before submission. Hidden
            <input name="gender"> is also written from FormData by the
            parent's handleSubmit so the server gets it cleanly. */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
            {t("auth.gender")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(opt.value)}
                className={cn(
                  "h-11 rounded-2xl text-[13px] font-medium transition-colors [touch-action:manipulation]",
                  gender === opt.value
                    ? "bg-[var(--foreground)] text-[var(--on-foreground)]"
                    : "bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.08]"
                )}
              >
                {t(opt.key as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        {/* Date of birth. Using <input type="date"> for the native
            date picker on mobile — much better UX than a custom
            three-dropdown setup. max attribute prevents picking a
            future date in the picker UI itself. */}
        <DateField
          label={t("auth.birthDate")}
          name="birth_date"
          // Default reasonable bounds: 120 years ago up to 13 years ago.
          // Server re-validates.
          maxYearsAgo={13}
          minYearsAgo={120}
        />

        {/* Password + Confirm Password. Shared show/hide toggle
            because typing the password twice with one revealed and
            one masked is annoying — when you can see it, both fields
            unmask together. */}
        <PasswordField
          label={t("auth.password")}
          name="password"
          showPassword={showPassword}
          onToggle={toggleShowPassword}
          autoComplete="new-password"
        />
        <PasswordField
          label={t("auth.passwordConfirm")}
          name="password_confirm"
          showPassword={showPassword}
          onToggle={toggleShowPassword}
          autoComplete="new-password"
        />

        {/* Promo code — required, since the free-tier work hasn't
            shipped yet. The /signup → free-tier flow lives behind
            the Google "Continue" path on /login; email signups still
            need a code. */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
            {t("auth.promoCode")}
          </label>
          <input
            name="promo_code"
            type="text"
            placeholder={t("auth.promoCodePh")}
            required
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] font-mono uppercase tracking-[0.12em] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] placeholder:font-mono focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            style={{ textTransform: "uppercase" }}
          />
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
          {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
        </button>
      </form>

      {/* Sign-in link routes to /login/password (the actual
          email/password form), not /login (the landing with Google +
          Sign up CTAs). Returning users skip the landing. */}
      <p className="mt-6 text-center text-[13px] text-[var(--label-secondary)]">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login/password" className="font-semibold text-[var(--foreground)]">
          {t("auth.signIn")}
        </Link>
      </p>
    </>
  );
}

/**
 * Email-OTP step. Shown after the form submission succeeds but
 * Supabase didn't return a session (= email confirmation is enabled
 * for this project). User enters the 6-digit code; we call
 * verifySignUpOtp which finalises the profile + redeems the promo
 * code + redirects to /onboarding.
 */
function OtpStep({
  email,
  t,
  onVerified,
}: {
  email: string;
  t: ReturnType<typeof useT>;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus the OTP input on entry. requestAnimationFrame avoids
    // a focus-fight with the layout swap; iOS still pops the numeric
    // keypad reliably this way.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const result = await verifySignUpOtp(email, code);
    setVerifying(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onVerified();
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setResending(true);
    const result = await resendSignUpOtp(email);
    setResending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setResent(true);
  }

  return (
    <>
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05]">
          <MailCheck className="h-6 w-6" strokeWidth={2} />
        </span>
        <p className="text-[14px] text-[var(--label-secondary)]">
          {t("auth.otpSentTo").replace("{email}", email)}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
            {t("auth.otpLabel")}
          </label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            // 6 chars is the Supabase default but we accept 4–8 in case
            // they ever bump it; the server enforces /^\d{4,8}$/.
            maxLength={8}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            required
            className="h-14 w-full rounded-2xl bg-[var(--surface)] px-4 text-center text-[24px] font-semibold tracking-[0.4em] tabular-nums text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] placeholder:tracking-[0.4em] placeholder:font-medium focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
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
          disabled={verifying || code.length < 4}
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#EE6452] text-[15px] font-semibold text-white shadow-sm transition-opacity disabled:opacity-60"
        >
          {verifying && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />}
          {verifying ? t("auth.verifying") : t("auth.verify")}
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
    </>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
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
        autoComplete={autoComplete}
        className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
      />
    </div>
  );
}

function DateField({
  label,
  name,
  minYearsAgo,
  maxYearsAgo,
}: {
  label: string;
  name: string;
  minYearsAgo: number;
  maxYearsAgo: number;
}) {
  // Compute the picker bounds on the client at render time. Strictly
  // server-rendered components can't reach Date.now() during static
  // generation, but this page is "use client" so it's fine.
  const today = new Date();
  const max = isoDate(new Date(today.getFullYear() - maxYearsAgo, today.getMonth(), today.getDate()));
  const min = isoDate(new Date(today.getFullYear() - minYearsAgo, today.getMonth(), today.getDate()));
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">
        {label}
      </label>
      <input
        name={name}
        type="date"
        required
        min={min}
        max={max}
        className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow [color-scheme:light]"
      />
    </div>
  );
}

function PasswordField({
  label,
  name,
  showPassword,
  onToggle,
  autoComplete,
}: {
  label: string;
  name: string;
  showPassword: boolean;
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
          name={name}
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-2xl bg-[var(--surface)] px-4 pr-12 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-[var(--label-tertiary)] transition-colors hover:text-[var(--label-secondary)]"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in local time. Padding via String + padStart.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
