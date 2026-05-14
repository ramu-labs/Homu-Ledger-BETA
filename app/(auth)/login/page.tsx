"use client";

// Landing page that decides how the user wants to start: Google
// (preferred — primary CTA) or a fresh email/password sign-up. Existing
// email/password users come back via the tiny "Already have an account?
// Sign in" link, which routes to /login/password (the previous /login
// form, now extracted to keep this page focused).
//
// Why this redesign (v1.24.0):
//   - The old /login showed Google + email/password form + sign-up link.
//     That gave new users three competing paths to read.
//   - The new layout makes the choice obvious: Google is one tap, Sign up
//     is the explicit "I'm new here" path, and the password form is one
//     more tap away for returning email/password users.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AddToHomescreenBanner from "@/components/add-to-homescreen-banner";
import GoogleSignInButton from "@/components/google-sign-in-button";
import { useT } from "@/lib/i18n/provider";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const t = useT();
  const params = useSearchParams();
  // OAuth errors from /auth/callback come back to this landing page so
  // we surface them prominently — the user just tapped Google and got
  // bounced, they should see why before anything else.
  const oauthError = params.get("oauth_error");
  const [error, setError] = useState<string | null>(oauthError);

  useEffect(() => {
    if (oauthError) setError(oauthError);
  }, [oauthError]);

  // ── Diagnostic logging for the "random logout" issue (v1.24.0) ───────
  // When the user lands on /login and the referrer is an authenticated
  // path (e.g. /transactions), they were bounced by middleware. We post
  // a fire-and-forget log so we can grep Vercel runtime logs for the
  // pattern (PWA standalone? long idle? after refresh?). Removed once
  // we've identified and fixed the root cause.
  useEffect(() => {
    try {
      const refUrl = document.referrer ? new URL(document.referrer) : null;
      const sameOrigin = refUrl && refUrl.origin === window.location.origin;
      const fromPath = sameOrigin ? refUrl.pathname : null;
      // Treat /login, /signup, /privacy as "expected" entries — anything
      // else suggests an unexpected bounce.
      const isExpected =
        !fromPath ||
        fromPath === "/" ||
        fromPath.startsWith("/login") ||
        fromPath.startsWith("/signup") ||
        fromPath.startsWith("/privacy") ||
        fromPath.startsWith("/auth/");
      if (isExpected) return;

      const isStandalone =
        // iOS Safari uses a non-standard property on navigator.
        // The matchMedia query is the cross-browser fallback.
        (typeof navigator !== "undefined" &&
          // @ts-expect-error — Safari-only API not in lib.dom
          navigator.standalone === true) ||
        window.matchMedia("(display-mode: standalone)").matches;

      const body = JSON.stringify({
        fromPath,
        isStandalone,
        hiddenMs: null,
        note: oauthError ? "after oauth_error" : null,
      });

      // sendBeacon survives even if the user closes the tab mid-bounce.
      // Falls back to fetch keepalive on browsers that lack Beacon.
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(
          "/api/auth-log",
          new Blob([body], { type: "application/json" })
        );
      } else {
        void fetch("/api/auth-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let logging break the page. Silent swallow.
    }
  }, [oauthError]);

  return (
    <>
      <AddToHomescreenBanner />
      <div className="w-full">
        <div className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/homu-login.png" alt="Homu" className="mx-auto mb-5 h-44 w-44 object-contain" />
          <p className="mt-1 text-[14px] text-[var(--label-secondary)]">
            {t("auth.signInTo")}
          </p>
        </div>

        {/* Primary path — Google. The button component renders its own
            loading state during the OAuth redirect handshake. */}
        <GoogleSignInButton />

        {/* OAuth error surfacing — only shown on landing, since this is
            where Google bounces back to. The GoogleSignInButton already
            shows its own SDK-level errors inline; this catches the
            redirect-time errors (e.g. user cancelled at Google's screen). */}
        {error && (
          <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        {/* Secondary path — explicit email/password sign-up. Styled as a
            ghost button so Google still reads as the primary action. */}
        <Link
          href="/signup"
          className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--surface)] text-[15px] font-semibold text-[var(--foreground)] ring-1 ring-black/[0.08] transition-opacity active:opacity-90 [touch-action:manipulation]"
        >
          {t("auth.createAccount")}
        </Link>

        {/* Returning email/password users — kept small on purpose so it
            doesn't compete visually with the two main CTAs. */}
        <p className="mt-8 text-center text-[13px] text-[var(--label-secondary)]">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link href="/login/password" className="font-semibold text-[var(--foreground)]">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </>
  );
}
