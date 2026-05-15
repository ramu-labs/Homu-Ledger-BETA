"use client";

import { useEffect, useState } from "react";
import { APP_VERSION, compareVersions } from "@/lib/version";
import { useT } from "@/lib/i18n/provider";

// Hard-refresh gate for clients running below the server's MIN_CLIENT_VERSION.
//
// Phase 2 of the pragmatic-offline rollout. It's deliberately dormant in
// v1.35.0 (server min == 1.34.0, this client == 1.35.0 → gate never fires).
// Phase 3 starts enforcing it: if we ship a release that genuinely breaks
// older queued writes — RPC signature change, dropped column, etc. — we
// bump MIN_CLIENT_VERSION and every visiting tab gets a blocking modal
// until the user refreshes onto the new bundle.
//
// Fetches /api/version on:
//   - first mount
//   - 'online'         (user just came back from offline; their bundle might
//                       be ancient if they kept the PWA open for days)
//   - 'visibilitychange' → visible (user tabbed back in; same story)
//
// Network failures are silently ignored. We never block on a fetch error —
// the user might be offline, and blocking offline users is the opposite of
// what the whole rollout is for.

type VersionResponse = { current: string; min: string };

async function fetchMinVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as VersionResponse;
    return typeof data?.min === "string" ? data.min : null;
  } catch {
    return null;
  }
}

export default function VersionGate() {
  const t = useT();
  const [needsRefresh, setNeedsRefresh] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const min = await fetchMinVersion();
      if (cancelled || !min) return;
      if (compareVersions(APP_VERSION, min) < 0) {
        setNeedsRefresh(true);
      }
    }

    check();

    function onOnline() {
      check();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") check();
    }

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  if (!needsRefresh) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="version-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-6"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--background)] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
        <h2
          id="version-gate-title"
          className="text-base font-semibold text-[var(--foreground)]"
        >
          {t("version.required.title")}
        </h2>
        <p className="mt-2 text-sm text-[var(--foreground)]/80">
          {t("version.required.body")}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-full bg-[var(--foreground)] py-2.5 text-sm font-semibold text-[var(--on-foreground)] active:opacity-80"
        >
          {t("version.required.cta")}
        </button>
      </div>
    </div>
  );
}
