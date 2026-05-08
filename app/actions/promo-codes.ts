"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DbPromoCode, SubscriptionTier } from "@/lib/types";

const VALID_TIERS: SubscriptionTier[] = [
  "3_months",
  "6_months",
  "1_year",
  "lifetime",
  "developer",
];

export async function generatePromoCode(
  tier: SubscriptionTier
): Promise<{ code?: DbPromoCode; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!VALID_TIERS.includes(tier)) return { error: "Invalid tier" };

  const { data, error } = await supabase.rpc("generate_promo_code", { p_tier: tier });
  if (error) return { error: error.message };

  // RPC returns table; first row is our new code.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "Failed to generate code" };

  revalidatePath("/settings/promo-codes");
  return {
    code: {
      id: row.id,
      code: row.code,
      tier: row.tier,
      created_at: row.created_at,
      created_by: user.id,
      redeemed_by: null,
      redeemed_at: null,
    },
  };
}

/**
 * Delete an unredeemed promo code. The DB-side `delete_promo_code` RPC
 * enforces every meaningful invariant (caller must be a developer, code
 * must exist, code must not already be redeemed) so this server action
 * is just a thin wrapper that translates errors into something the UI
 * can show and revalidates the listing page.
 */
export async function deletePromoCode(
  id: string
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("delete_promo_code", { p_id: id });
  if (error) return { error: error.message };

  revalidatePath("/settings/promo-codes");
  return { ok: true };
}

/**
 * Redeem a promo code. The user must be authenticated (so this runs after
 * the auth account is created during signup, or from a settings page later).
 *
 * Returns the activated tier and expiry (null for lifetime/developer).
 */
export async function redeemPromoCode(
  code: string
): Promise<{ tier?: SubscriptionTier; expiresAt?: string | null; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("redeem_promo_code", { p_code: code });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "Redemption failed" };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return { tier: row.tier as SubscriptionTier, expiresAt: row.expires_at ?? null };
}
