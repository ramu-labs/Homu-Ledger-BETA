// Client-side wrappers around addTransaction / addWallet / addCategory that
// fall back to the offline queue when the network can't reach the server.
//
// Phase 3 of pragmatic-offline. Each wrapper:
//   1. Generates a UUID client_op_id (sent through the action so the server
//      can dedupe replays via the partial unique index from migration 0028).
//   2. If `navigator.onLine === false`, queues immediately + returns
//      `{ queued: true }` so the calling sheet can close optimistically.
//   3. Otherwise tries the real server action. On a thrown network error
//      (offline mid-request, server unreachable, etc.) we enqueue + return
//      `{ queued: true }`. On any non-network failure (validation error,
//      RLS denial, …) we pass the server's `{ error }` straight through —
//      those won't get better on retry.
//
// What we deliberately do NOT do here:
//   - Synthesise an optimistic row for the UI list. The transactions /
//     wallets / categories shells are SSR-first; injecting fake rows
//     would mean teaching every list of them to merge pending state.
//     For v1.36.0 the user sees the "N pending" pill instead, and the
//     row materialises after replay. Optimistic visuals belong to a
//     later phase if usage data says it's worth the wiring.

"use client";

import { addTransaction } from "@/app/actions/transactions";
import { addWallet } from "@/app/actions/wallets";
import { addCategory } from "@/app/actions/categories";
import type { DbWallet, DbCategory } from "@/lib/types";
import { enqueue, type QueueOpAction } from "@/lib/sync-queue";
import { withTimeout, isTimeoutError } from "@/lib/with-timeout";

// Hard cap on how long we wait for a server action before deciding the
// network is unreachable and queuing the op locally. Tuned so that a
// genuinely slow-but-working cellular connection still completes (4G in a
// bad signal area: ~2-4s round-trip), while iOS-PWA airplane-mode hangs
// (which can sit indefinitely because the OS queues the fetch instead of
// rejecting it) fall through to the queue quickly.
const SERVER_ACTION_TIMEOUT_MS = 6000;

/** Plain map of FormData entries, dropping any non-string values (File, etc).
 *  For Phase 3 the only FormData we queue is text-only (photo uploads land
 *  directly in Storage and only the resulting path is in the form). */
function formDataToPayload(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") out[key] = value;
  });
  return out;
}

/** Heuristic for "this was a network failure, not a server-side rejection".
 *  Server actions return `{ error: string }` on validation/auth failures —
 *  they do NOT throw. So anything thrown (or timed out) is a transport-level
 *  problem and belongs in the queue. */
function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (isTimeoutError(err)) return true;
  if (err instanceof TypeError) return true; // fetch failure shape in modern browsers
  const msg = (err as { message?: string }).message ?? String(err);
  return /network|fetch|failed|offline|connection|timeout/i.test(msg);
}

type QueuedResult = { queued: true };

async function queueOp(
  action: QueueOpAction,
  id: string,
  payload: Record<string, string>
): Promise<QueuedResult> {
  await enqueue({ id, action, payload, createdAt: Date.now() });
  return { queued: true };
}

function buildFormData(payload: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(payload)) fd.set(k, v);
  return fd;
}

// ── addTransaction ────────────────────────────────────────────────────

export type QueuedAddTransactionResult = { error?: string } | QueuedResult;

export async function queuedAddTransaction(
  formData: FormData
): Promise<QueuedAddTransactionResult> {
  const id = crypto.randomUUID();
  formData.set("client_op_id", id);
  const payload = formDataToPayload(formData);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return queueOp("addTransaction", id, payload);
  }
  try {
    return await withTimeout(addTransaction(buildFormData(payload)), SERVER_ACTION_TIMEOUT_MS);
  } catch (err) {
    if (isNetworkError(err)) {
      return queueOp("addTransaction", id, payload);
    }
    throw err;
  }
}

// ── addWallet ─────────────────────────────────────────────────────────

export type QueuedAddWalletResult =
  | { wallet?: DbWallet; error?: string }
  | QueuedResult;

export async function queuedAddWallet(
  formData: FormData
): Promise<QueuedAddWalletResult> {
  const id = crypto.randomUUID();
  formData.set("client_op_id", id);
  const payload = formDataToPayload(formData);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return queueOp("addWallet", id, payload);
  }
  try {
    return await withTimeout(addWallet(buildFormData(payload)), SERVER_ACTION_TIMEOUT_MS);
  } catch (err) {
    if (isNetworkError(err)) {
      return queueOp("addWallet", id, payload);
    }
    throw err;
  }
}

// ── addCategory ───────────────────────────────────────────────────────

export type QueuedAddCategoryResult =
  | { category?: DbCategory; error?: string }
  | QueuedResult;

export async function queuedAddCategory(
  formData: FormData
): Promise<QueuedAddCategoryResult> {
  const id = crypto.randomUUID();
  formData.set("client_op_id", id);
  const payload = formDataToPayload(formData);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return queueOp("addCategory", id, payload);
  }
  try {
    return await withTimeout(addCategory(buildFormData(payload)), SERVER_ACTION_TIMEOUT_MS);
  } catch (err) {
    if (isNetworkError(err)) {
      return queueOp("addCategory", id, payload);
    }
    throw err;
  }
}

/** Narrow helper for callers that need to branch on "did this queue or did
 *  it return a real server result?". */
export function isQueued<T extends object>(
  r: T | QueuedResult
): r is QueuedResult {
  return (r as QueuedResult).queued === true;
}

// ── Editing queued (not-yet-replayed) ops (v1.36.1) ──────────────────
//
// The pending row in the transactions list IS editable now. Tapping it
// opens the same Add Transaction sheet in "editing" mode, but the save
// & delete handlers route HERE instead of through the live server
// actions — because there is no server row yet.

import { getAll, remove as removeFromQueue } from "@/lib/sync-queue";

/**
 * Replace the payload of a queued addTransaction op. Keeps the same
 * op id (= client_op_id), so when this eventually replays, the
 * server sees ONE row landing — not a "old version then update".
 *
 * Idempotent: if the op already replayed (no longer in the queue)
 * we no-op rather than throw. Cheap race: the user could tap save on
 * a pending row at the exact moment replay drained it. Returning
 * silently lets the SSR refresh take over.
 */
export async function updateQueuedTransaction(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  // Strip the client_op_id from the form — we already have it (the
  // id arg) and we don't want to accidentally create a NEW op with a
  // fresh uuid here.
  formData.delete("client_op_id");
  const payload = formDataToPayload(formData);

  const all = await getAll();
  const existing = all.find((op) => op.id === id);
  if (!existing) {
    // Op already replayed → silently ignore. The SSR list refresh
    // will reconcile to whatever the server has.
    return {};
  }

  // Same enqueue path replaces by id (IDB put is upsert). Reuses the
  // existing createdAt + action; attempts reset to 0 (a fresh edit
  // deserves the full retry budget).
  await enqueue({
    id,
    action: existing.action,
    payload: { ...existing.payload, ...payload, client_op_id: id },
    createdAt: existing.createdAt,
  });
  return {};
}

/**
 * Remove a queued addTransaction op outright. Used by the delete
 * button on a pending row.
 */
export async function deleteQueuedTransaction(
  id: string
): Promise<{ error?: string }> {
  try {
    await removeFromQueue(id);
    return {};
  } catch (err) {
    return { error: (err as Error).message ?? "Failed to remove queued op" };
  }
}
