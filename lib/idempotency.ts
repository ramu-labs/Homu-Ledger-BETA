// Helpers for the offline write-queue's idempotency layer.
//
// Phase 2 of the pragmatic-offline rollout. The queue (Phase 3 / v1.36.0)
// generates a UUID per user action and includes it in every retry. The
// server's partial unique index `(household_id, client_op_id) where
// client_op_id is not null` makes a repeat insert a Postgres
// unique-violation, which we catch + treat as success.

import type { PostgrestError } from "@supabase/supabase-js";

/**
 * True when an INSERT failed because the same client_op_id already landed
 * for this household. The queue should treat this as success and clear
 * the pending op, NOT retry.
 */
export function isClientOpDuplicate(err: PostgrestError | null | undefined): boolean {
  if (!err) return false;
  // Postgres `unique_violation` is SQLSTATE 23505. We additionally require
  // the constraint name to mention client_op so an unrelated unique-index
  // collision (e.g. wallets.name uniqueness) isn't silently swallowed.
  return err.code === "23505" && /client_op/.test(err.message ?? "");
}

/**
 * Extract a client_op_id from FormData. Returns null if absent or empty.
 * UUID shape is intentionally NOT validated here — Postgres will reject
 * a malformed UUID at insert time with a clearer error than we could
 * produce, and the queue should never send a non-UUID anyway.
 */
export function getClientOpId(formData: FormData): string | null {
  const raw = formData.get("client_op_id");
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}
