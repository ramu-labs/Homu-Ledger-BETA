"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { WifiOff, CloudOff } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { count, subscribe } from "@/lib/sync-queue";

// Pill that surfaces the two signals a user needs about offline state:
//   1. Are we currently offline? (navigator.onLine)
//   2. Are any writes still waiting to land on the server? (queue count)
//
// Visible only when at least one of those is true. The four states:
//   online,  queue 0   → render nothing (hidden)
//   offline, queue 0   → "Offline"                  (WifiOff)
//   online,  queue N>0 → "N pending"                (CloudOff)
//   offline, queue N>0 → "Offline · N pending"      (WifiOff)
//
// Sits below the status-bar shield at z-40 — above page content, under
// modals (z-[60]+) and bottom-sheets.

function onlineSubscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
function getOnlineSnapshot() { return navigator.onLine; }
function getOnlineServerSnapshot() { return true; }

export default function SyncStatusPill() {
  const t = useT();
  const online = useSyncExternalStore(onlineSubscribe, getOnlineSnapshot, getOnlineServerSnapshot);

  // Pending count uses a plain useEffect + subscribe rather than
  // useSyncExternalStore — count() returns a Promise, which doesn't fit
  // the snapshot getter contract. The pub/sub pattern keeps the
  // resubscription cheap and avoids a render every animation frame.
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const n = await count();
      if (!cancelled) setPending(n);
    }
    refresh();
    const unsub = subscribe(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (online && pending === 0) return null;

  const Icon = online ? CloudOff : WifiOff;
  const label = !online && pending > 0
    ? `${t("common.offline")} · ${pending} ${t("common.pending")}`
    : !online
    ? t("common.offline")
    : `${pending} ${t("common.pending")}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 px-3"
      style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)] px-3 py-1 text-xs font-medium text-[var(--on-foreground)] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
    </div>
  );
}
