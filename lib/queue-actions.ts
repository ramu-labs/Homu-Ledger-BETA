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
 *  they do NOT throw. So anything thrown is a transport-level problem and
 *  belongs in the queue. */
function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) return true; // fetch failure shape in modern browsers
  const msg = (err as { message?: string }).message ?? String(err);
  return /network|fetch|failed|offline|connection/i.test(msg);
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
    return await addTransaction(buildFormData(payload));
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
    return await addWallet(buildFormData(payload));
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
    return await addCategory(buildFormData(payload));
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
