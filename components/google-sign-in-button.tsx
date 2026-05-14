"use client";

// Reusable "Continue with Google" button. Initiates the Supabase OAuth flow,
// which redirects the user to Google, then back to /auth/callback (our route
// handler exchanges the code for a session and routes based on profile
// state).
//
// Used on /login and /signup.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";

export default function GoogleSignInButton() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Ask Google to always show the account picker so users who are
        // signed into multiple Google accounts can choose. Without this,
        // Google silently reuses the active account.
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
    // On success the browser navigates away to accounts.google.com, so we
    // intentionally don't reset `loading` — that would flash the button
    // back to "Continue with Google" right before the redirect.
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--surface)] text-[15px] font-medium text-[var(--foreground)] ring-1 ring-black/[0.08] shadow-sm transition-opacity active:opacity-90 disabled:opacity-60"
      >
        <GoogleGlyph />
        {loading ? t("auth.redirecting") : t("auth.continueWithGoogle")}
      </button>
      {error && (
        <p className="mt-2 rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}

// Official multi-colour Google "G" mark, inlined as SVG. Sized to sit next
// to a 15px label and align optically with other icon-led buttons in the
// app.
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
