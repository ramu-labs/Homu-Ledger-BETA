"use client";

// Edit Profile (v1.36.0).
//
// Reorganised into three cards matching the rest of the Settings UX:
//   1. Avatar Style & Background Colour (9 colours, trimmed from 14)
//   2. Details — name / username / gender / DoB
//   3. Email & Password — email (read-only for now) + change-password
//
// The password subsection is hidden entirely for Google-only users
// (no email/password identity) — `/settings/security` is gone in this
// release, so we own that "Google-only sees a hint" behaviour here.
//
// We deliberately keep TWO submit buttons (identity vs. password) so
// password validation failures don't roll back identity changes (and
// vice versa). They write through different server actions anyway.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Eye, EyeOff, Lock, MailCheck, Loader2 } from "lucide-react";
import { updateProfile, updatePassword, requestEmailChange, verifyEmailChangeOtp } from "@/app/actions/auth";
import { cn } from "@/lib/cn";

// Trimmed from 14 → 9 in v1.36.0. Kept the most chromatically distinct
// hues across the wheel so users can still tell them apart on a small
// avatar circle.
const COLOR_PALETTE = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ef4444", // red
  "#ec4899", // pink
  "#eab308", // amber
  "#14b8a6", // teal
  "#22c55e", // green
  "#6b7280", // grey
];

// 2 hair colours (blonde/light · dark/black) × 2 skin tones (light 🏻 · medium-light 🏼)
// + special characters for variety
const FACE_EMOJIS = [
  // Light skin — blonde hair
  "👱🏻‍♀️","👱🏻","👵🏻","👴🏻","👰🏻‍♀️","🤵🏻",
  // Light skin — dark hair
  "👩🏻","👨🏻","👧🏻","👦🏻","🧔🏻‍♀️","🧔🏻",
  // Light skin — special characters
  "👸🏻","🤴🏻","🧙🏻‍♀️","🧙🏻","🦸🏻‍♀️","🦸🏻",
  // Medium-light skin — blonde hair
  "👱🏼‍♀️","👱🏼","👵🏼","👴🏼","👰🏼‍♀️","🤵🏼",
  // Medium-light skin — dark hair
  "👩🏼","👨🏼","👧🏼","👦🏼","🧔🏼‍♀️","🧔🏼",
  // Medium-light skin — special characters
  "👸🏼","🤴🏼","🧙🏼‍♀️","🧙🏼","🦸🏼‍♀️","🦸🏼",
];

type AvatarMode = "initial" | "emoji";
// v1.40.0 — narrowed to Male / Female, matching the signup picker.
// Existing users whose row stores 'other' / 'prefer_not_to_say' are
// still valid against the CHECK constraint; their old value just
// won't render as a highlighted pill (none of the buttons will be
// active). They can pick Male or Female to update.
type Gender = "male" | "female";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

type Props = {
  profile: {
    name: string;
    username: string | null;
    initials: string;
    avatar_color: string;
    email: string;
    gender: Gender | null;
    birth_date: string | null;
  };
  hasEmailPassword: boolean;
};

export default function EditProfileShell({ profile, hasEmailPassword }: Props) {
  const router = useRouter();
  // ── Section 1 + 2 identity state ────────────────────────────────────
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>(
    FACE_EMOJIS.includes(profile.initials) ? "emoji" : "initial"
  );
  const [initials, setInitials] = useState(
    FACE_EMOJIS.includes(profile.initials) ? profile.initials : profile.initials
  );
  const [selectedEmoji, setSelectedEmoji] = useState(
    FACE_EMOJIS.includes(profile.initials) ? profile.initials : FACE_EMOJIS[0]
  );
  const [gender, setGender] = useState<Gender | null>(profile.gender);
  const [birthDate, setBirthDate] = useState<string>(profile.birth_date ?? "");
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identitySaved, setIdentitySaved] = useState(false);

  // ── Section 3 password state (isolated so its errors don't block
  //    identity saves and vice versa) ─────────────────────────────────
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  // ── Change-email state (v1.37.0) ────────────────────────────────────
  // Three steps: idle (read-only email + Change button) → request
  // (new-email input) → otp (6-digit code) → done (just re-renders
  // the new value as read-only). Kept inline rather than as a
  // sub-route so the user stays in Edit Profile context.
  type EmailStep = "idle" | "request" | "otp" | "done";
  const [emailStep, setEmailStep] = useState<EmailStep>("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailDisplay, setEmailDisplay] = useState(profile.email);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (emailStep === "otp") {
      const id = requestAnimationFrame(() => otpInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [emailStep]);

  const displayInitials = avatarMode === "emoji" ? selectedEmoji : (initials || profile.initials);

  async function handleIdentitySave(e: React.FormEvent) {
    e.preventDefault();
    setIdentityError(null);
    setIdentitySaved(false);
    setIdentityLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("username", username);
    fd.set("avatar_color", avatarColor);
    fd.set("initials", displayInitials);
    if (gender) fd.set("gender", gender);
    if (birthDate) fd.set("birth_date", birthDate);
    const result = await updateProfile(fd);
    setIdentityLoading(false);
    if (result.error) {
      setIdentityError(result.error);
      return;
    }
    setIdentitySaved(true);
    // Auto-clear the saved state after a beat so the button returns
    // to its "Save Changes" rest state — the user might want to make
    // another tweak without remounting the page.
    setTimeout(() => setIdentitySaved(false), 1500);
  }

  // ── Email change handlers ──────────────────────────────────────────
  async function handleEmailRequest(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setEmailError("Enter a valid email.");
      return;
    }
    setEmailLoading(true);
    const res = await requestEmailChange(trimmed);
    setEmailLoading(false);
    if (res.error) {
      setEmailError(res.error);
      return;
    }
    setEmailStep("otp");
  }

  async function handleEmailVerify(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailLoading(true);
    const res = await verifyEmailChangeOtp(newEmail.trim().toLowerCase(), emailOtp);
    setEmailLoading(false);
    if (res.error) {
      setEmailError(res.error);
      return;
    }
    setEmailDisplay(newEmail.trim().toLowerCase());
    setEmailStep("done");
    // Reset transient state — next "Change email" tap starts fresh.
    setEmailOtp("");
    setNewEmail("");
    // After a beat collapse back to idle so the section returns to
    // its compact resting shape.
    setTimeout(() => setEmailStep("idle"), 2500);
  }

  function cancelEmailChange() {
    setEmailStep("idle");
    setNewEmail("");
    setEmailOtp("");
    setEmailError(null);
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (newPw.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwLoading(true);
    const result = await updatePassword(newPw);
    setPwLoading(false);
    if (result.error) {
      setPwError(result.error);
      return;
    }
    setPwSaved(true);
    setNewPw("");
    setConfirmPw("");
  }

  // Date picker bounds — match the signup form's 13–120 years range.
  const today = new Date();
  const dobMin = isoDate(new Date(today.getFullYear() - 120, today.getMonth(), today.getDate()));
  const dobMax = isoDate(new Date(today.getFullYear() - 13, today.getMonth(), today.getDate()));

  return (
    <div className="pb-10">
      <header className="sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-2 pb-2 backdrop-blur">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </button>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Edit Profile</h1>
        <div className="h-9 w-9" />
      </header>

      <form onSubmit={handleIdentitySave} className="px-5 mt-4 space-y-4">

        {/* ── Section 1 — Avatar Style & Background Colour ───────── */}
        <section className="rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] p-4 space-y-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            Avatar
          </p>

          {/* Preview */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-[32px] font-semibold text-white shadow-md"
              style={{ backgroundColor: avatarColor }}
            >
              {displayInitials}
            </div>
          </div>

          {/* Style toggle */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Avatar style</label>
            <div className="flex gap-1 rounded-full bg-black/[0.05] p-1 mb-3">
              {(["initial", "emoji"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setAvatarMode(m)}
                  className={cn("flex-1 rounded-full py-1.5 text-[13px] font-medium transition-all min-h-[32px]",
                    avatarMode === m ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm" : "text-[var(--label-secondary)]"
                  )}
                >
                  {m === "initial" ? "Initials" : "Face emoji"}
                </button>
              ))}
            </div>

            {avatarMode === "initial" ? (
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="e.g. MJ"
                maxLength={2}
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-center text-[18px] font-semibold tracking-wider outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            ) : (
              <>
                <div className="grid grid-cols-6 gap-2">
                  {FACE_EMOJIS.map((em) => (
                    <button key={em} type="button" onClick={() => setSelectedEmoji(em)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl text-[22px] transition-all",
                        selectedEmoji === em
                          ? "bg-[var(--foreground)]/10 ring-2 ring-[var(--foreground)]/30 scale-95"
                          : "bg-[var(--background)] ring-1 ring-black/[0.06]"
                      )}
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-black/[0.07]" />
                  <span className="text-[11px] text-[var(--label-tertiary)]">or type your own</span>
                  <div className="h-px flex-1 bg-black/[0.07]" />
                </div>
                <input
                  type="text"
                  value={FACE_EMOJIS.includes(selectedEmoji) ? "" : selectedEmoji}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (val) setSelectedEmoji(val);
                  }}
                  placeholder="Paste any emoji ✨"
                  className="mt-2 h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-center text-[22px] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow placeholder:text-[18px] placeholder:text-[var(--label-tertiary)]"
                />
              </>
            )}
          </div>

          {/* Background colour — 9 swatches now (was 14). Trimmed
              in v1.36.0 per design — fewer choices, less decision tax. */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Background colour</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setAvatarColor(c)}
                  className={cn("h-9 w-9 rounded-full transition-all",
                    avatarColor === c ? "ring-2 ring-offset-2 ring-[var(--foreground)]/50 scale-110" : ""
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Use colour ${c}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 2 — Details ────────────────────────────────── */}
        <section className="rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] p-4 space-y-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
            Details
          </p>

          {/* Full name */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
            />
          </div>

          {/* Username */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[var(--label-tertiary)]">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="yourname"
                maxLength={20}
                className="h-12 w-full rounded-2xl bg-[var(--background)] pl-8 pr-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Gender</label>
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
                      : "bg-[var(--background)] text-[var(--foreground)] ring-1 ring-black/[0.08]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date of birth */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Date of birth</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              min={dobMin}
              max={dobMax}
              className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow [color-scheme:light]"
            />
          </div>

          {identityError && (
            <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">{identityError}</p>
          )}

          {/* Save Changes button — v1.36.0 contrast fix: was
              `text-white` on `bg-[var(--foreground)]` which is
              white-on-white in dark mode (the bug the user
              screenshotted). Switched to `text-[var(--on-foreground)]`
              which always inverts against the background. */}
          <button
            type="submit"
            disabled={identityLoading || identitySaved}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-all",
              identitySaved
                ? "bg-emerald-500 text-white"
                : "bg-[var(--foreground)] text-[var(--on-foreground)] disabled:opacity-60"
            )}
          >
            {identitySaved ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : identityLoading ? "Saving…" : "Save Changes"}
          </button>
        </section>
      </form>

      {/* ── Section 3 — Email & Password ──────────────────────────── */}
      {/* Lives outside the identity <form> so submitting one doesn't
          submit the other. Password row only renders for users who
          actually have an email/password identity. */}
      <section className="mx-5 mt-4 rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04] p-4 space-y-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
          Email &amp; Password
        </p>

        {/* Email — three-step inline change flow (v1.37.0).
            idle: read-only field + "Change" button.
            request: input for new email + Send code / Cancel.
            otp: 6-digit code input + Verify / Cancel.
            done: green success flash, auto-returns to idle. */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Email</label>
          {emailStep === "idle" || emailStep === "done" ? (
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={emailDisplay}
                readOnly
                className="h-12 flex-1 rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--label-secondary)] outline-none ring-1 ring-black/[0.05] cursor-default"
              />
              <button
                type="button"
                onClick={() => setEmailStep("request")}
                className="h-12 shrink-0 rounded-2xl bg-[var(--foreground)] px-4 text-[13px] font-semibold text-[var(--on-foreground)] active:opacity-90 [touch-action:manipulation]"
              >
                Change
              </button>
            </div>
          ) : emailStep === "request" ? (
            <form onSubmit={handleEmailRequest} className="space-y-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
                autoComplete="email"
                autoFocus
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
              <p className="px-1 text-[11px] text-[var(--label-tertiary)]">
                We&apos;ll send a 6-digit code to the new address to confirm you own it.
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={emailLoading || !newEmail.trim()}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#EE6452] text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {emailLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
                  {emailLoading ? "Sending…" : "Send code"}
                </button>
                <button
                  type="button"
                  onClick={cancelEmailChange}
                  disabled={emailLoading}
                  className="h-11 rounded-2xl bg-[var(--background)] px-4 text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.08] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            // OTP step
            <form onSubmit={handleEmailVerify} className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-[var(--background)] px-3 py-2 ring-1 ring-black/[0.05]">
                <MailCheck className="h-4 w-4 shrink-0 text-[var(--label-tertiary)]" strokeWidth={2} />
                <p className="text-[12px] text-[var(--label-secondary)]">
                  Code sent to <span className="font-semibold text-[var(--foreground)]">{newEmail}</span>
                </p>
              </div>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                maxLength={8}
                autoComplete="one-time-code"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                className="h-14 w-full rounded-2xl bg-[var(--background)] px-4 text-center text-[22px] font-semibold tracking-[0.4em] tabular-nums text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={emailLoading || emailOtp.length < 4}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#EE6452] text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {emailLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
                  {emailLoading ? "Verifying…" : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={cancelEmailChange}
                  disabled={emailLoading}
                  className="h-11 rounded-2xl bg-[var(--background)] px-4 text-[13px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.08] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {emailError && (
            <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">{emailError}</p>
          )}
          {emailStep === "done" && (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 ring-1 ring-emerald-200">
              <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} /> Email updated.
            </p>
          )}
        </div>

        {hasEmailPassword ? (
          <form onSubmit={handlePasswordSave} className="space-y-3">
            {/* New password */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">New password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 pr-12 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-[var(--label-tertiary)]"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" strokeWidth={2} /> : <Eye className="h-4 w-4" strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[var(--label-secondary)]">Confirm new password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                autoComplete="new-password"
                className="h-12 w-full rounded-2xl bg-[var(--background)] px-4 text-[15px] text-[var(--foreground)] outline-none ring-1 ring-black/[0.08] placeholder:text-[var(--label-tertiary)] focus:ring-2 focus:ring-[var(--foreground)]/20 transition-shadow"
              />
            </div>

            {pwError && (
              <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">{pwError}</p>
            )}
            {pwSaved && !pwError && (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 ring-1 ring-emerald-200">
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} /> Password updated.
              </p>
            )}

            <button
              type="submit"
              disabled={pwLoading || newPw.length === 0 || confirmPw.length === 0}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#EE6452] text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {pwLoading ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : (
          // Google-only user — no password to change locally. Same
          // copy/icon as the old /settings/security empty state.
          <div className="flex items-start gap-3 rounded-xl bg-[var(--background)] px-3 py-3 ring-1 ring-black/[0.04]">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[var(--foreground)]">
              <Lock className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--foreground)]">
                You signed in with Google
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--label-secondary)]">
                Your password is managed by Google for {profile.email}. To change it, update your password in your Google Account settings.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
