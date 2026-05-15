"use client";

// React hook over `lib/sync-queue` that returns the currently-queued
// addTransaction ops, live. Used by `transactions-shell.tsx` to synth
// optimistic "Pending" rows into the SSR'd list.
//
// Why a custom hook (not useSyncExternalStore directly):
//   - `getAll()` is async, so we can't shoehorn it into the
//     snapshot-getter shape that useSyncExternalStore wants.
//   - Subscribing + refetching on every change gives us a stable
//     useState-backed snapshot that React renders predictably.
//
// We deliberately filter to `addTransaction` here so the shell doesn't
// have to know about wallet/category ops. If you ever want pending
// rows for those, write a sibling hook with the matching filter.

import { useEffect, useState } from "react";
import { getAll, subscribe, type QueuedOp } from "@/lib/sync-queue";

export function usePendingAddTransactionOps(): QueuedOp[] {
  const [ops, setOps] = useState<QueuedOp[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const all = await getAll();
        if (cancelled) return;
        // FIFO order from IDB. We only show `addTransaction`; the
        // wallet/category ops still drain in the background but don't
        // need a list-row representation (the picker UIs already get a
        // "extras" optimistic merge from the parent).
        setOps(all.filter((op) => op.action === "addTransaction"));
      } catch {
        // SSR / IDB unavailable — keep the empty array, no harm.
      }
    }

    void refresh();
    // Re-fetch whenever sync-queue emits a change (enqueue, remove,
    // recordFailure). The pub-sub is synchronous; we keep the read
    // async because IDB is async.
    const unsub = subscribe(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return ops;
}
