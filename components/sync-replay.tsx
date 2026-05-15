"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { addTransaction } from "@/app/actions/transactions";
import { addWallet } from "@/app/actions/wallets";
import { addCategory } from "@/app/actions/categories";
import { getAll, remove, recordFailure, subscribe } from "@/lib/sync-queue";
import { withTimeout, isTimeoutError } from "@/lib/with-timeout";

// Per-op replay deadline. iOS-PWA-on-dead-network fetches can hang
// indefinitely; without a cap, a single stale op would block the rest of
// the queue forever. On timeout we record a failure and move on — the
// next 'online' trigger will retry.
const REPLAY_TIMEOUT_MS = 8000;

// Drains the offline write-queue back through the matching server actions
// whenever it's plausible the network is back: page load, online event,
// tab regains focus. Mounted invisibly in app/(app)/layout.tsx.
//
// Ordering: we drain FIFO (IDB getAll returns insertion order). The replay
// is single-flight via a module-level `running` flag — multiple triggers
// landing close together (online + visibilitychange firing on the same
// reconnection) collapse to one pass.
//
// Idempotency: every op carries the same client_op_id it was queued with.
// Migration 0028's partial unique index makes a duplicate INSERT surface
// as a Postgres 23505, which the server actions catch via
// lib/idempotency.ts and turn into success. So a replay that "succeeded
// on the server but the network died before we got the OK" is safe to
// retry — the second attempt is a no-op.
//
// Backoff: per-op attempt counter. Beyond MAX_ATTEMPTS we skip the op
// this pass (it's still in the queue, will be re-attempted on the next
// online event). No exponential timer is needed because the trigger
// surface (online / visibilitychange) is already event-driven.

const MAX_ATTEMPTS = 5;

let running = false;

async function replayOnce(onCompleted: () => void) {
  if (running) return;
  running = true;
  let anyDrained = false;
  try {
    const ops = await getAll();
    for (const op of ops) {
      if (op.attempts >= MAX_ATTEMPTS) continue;
      const fd = new FormData();
      for (const [k, v] of Object.entries(op.payload)) fd.set(k, v);
      // client_op_id was set at enqueue time and is part of the payload,
      // so the server's idempotency layer dedupes a repeat replay.
      try {
        let result: { error?: string };
        switch (op.action) {
          case "addTransaction":
            result = await withTimeout(addTransaction(fd), REPLAY_TIMEOUT_MS);
            break;
          case "addWallet":
            result = await withTimeout(addWallet(fd), REPLAY_TIMEOUT_MS);
            break;
          case "addCategory":
            result = await withTimeout(addCategory(fd), REPLAY_TIMEOUT_MS);
            break;
        }
        if (result?.error) {
          // Server-side rejection (validation, RLS). Retrying won't help —
          // leave the op around so a future diagnostics UI can show it,
          // but bump attempts so it doesn't block the rest of the queue
          // by being re-tried forever.
          await recordFailure(op.id, result.error);
          continue;
        }
        await remove(op.id);
        anyDrained = true;
      } catch (err) {
        // Network failure or timeout mid-replay — leave the op in the
        // queue. We'll hit it again on the next online / visibility
        // trigger. Timeout specifically prevents one stuck request from
        // blocking the rest of the queue forever.
        const msg = isTimeoutError(err)
          ? "Replay timed out"
          : err instanceof Error
          ? err.message
          : String(err);
        await recordFailure(op.id, msg);
      }
    }
  } finally {
    running = false;
    if (anyDrained) onCompleted();
  }
}

export default function SyncReplay() {
  const router = useRouter();

  useEffect(() => {
    // After a successful drain we refresh the current route's RSC data so
    // the rows that just landed on the server show up in the user's list.
    // router.refresh() is the Next 16 way to re-fetch server data without
    // a full page navigation.
    function onAnyDrained() {
      router.refresh();
    }

    function trigger() {
      void replayOnce(onAnyDrained);
    }

    // Run once on mount — covers the "user opened the app already online,
    // queue still has stuff from a previous offline session" case.
    trigger();

    function onOnline() {
      trigger();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") trigger();
    }

    // Also re-run if the queue changes (e.g. user enqueues something new
    // while online — though queue-actions tries the server first in that
    // case, so this mostly handles cases where the enqueue happened but
    // the queue still has older items waiting).
    const unsub = subscribe(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        trigger();
      }
    });

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsub();
    };
  }, [router]);

  return null;
}
