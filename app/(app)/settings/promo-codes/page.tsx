import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import PromoCodesShell from "@/components/promo-codes-shell";
import type { DbPromoCode, SubscriptionTier } from "@/lib/types";

export default async function PromoCodesPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.is_developer) notFound();

  // RLS already restricts SELECT to developers (or own redemptions),
  // so this returns every code generated.
  const { data: codesRaw } = await supabase
    .from("promo_codes")
    .select("id, code, tier, created_at, created_by, redeemed_by, redeemed_at, redeemer:profiles!promo_codes_redeemed_by_fkey(id, name)")
    .order("created_at", { ascending: false });

  const codes: DbPromoCode[] = (codesRaw ?? []).map((c: any) => ({
    id: c.id,
    code: c.code,
    tier: c.tier as SubscriptionTier,
    created_at: c.created_at,
    created_by: c.created_by,
    redeemed_by: c.redeemed_by,
    redeemed_at: c.redeemed_at,
    redeemer: Array.isArray(c.redeemer) ? c.redeemer[0] ?? null : c.redeemer,
  }));

  return <PromoCodesShell initialCodes={codes} />;
}
