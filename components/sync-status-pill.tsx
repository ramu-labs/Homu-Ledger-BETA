"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * Tiny pill that appears only when the browser reports it's offline.
 *
 * Phase 1 of the pragmatic-offline rollout: reads now come from the SW
 * navigation cache when the network is down (see public/sw.js). Users
 * need a quiet signal that what they're seeing might be stale, otherwise
 * "the app works on the school wifi" reads as "the app updated me on the
 * school wifi" — which would be a worse, silent lie.
 *
 * Subscribes to navigator.onLine via useSyncExternalStore — the React-19
 * recommended pattern for external state. During SSR `getServerSnapshot`
 * returns `true` (we assume online) so the pill renders nothing on the
 * server and on the client's first paint, avoiding a hydration flash.
 *
 * Sits at z-40 so it's above page content but under modals (z-[60]) and
 * bottom-sheets.
 */

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export default function SyncStatusPill() {
  const t = useT();
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 px-3"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)] px-3 py-1 text-xs font-medium text-[var(--on-foreground)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
        {t("common.offline")}
      </div>
    </div>
  );
}
