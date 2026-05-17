// Developer analytics dashboard (RAM-18).
//
// Dev-only. Reads a JSON snapshot from the analytics_overview() RPC and
// derives every metric in lib/analytics.ts (computed server-side here,
// then handed to the client shell). No daily job — computed live; the
// friends-&-family user base is small enough that this is instant.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import DevAnalyticsShell from "@/components/dev-analytics-shell";
import { computeAnalytics, type AnalyticsRaw } from "@/lib/analytics";

export default async function DevAnalyticsPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.is_developer) notFound();

  // analytics_overview() is SECURITY DEFINER + dev-gated; it returns the
  // raw rows as a JSON blob (or null for non-developers). `error` is set
  // if the migration hasn't been applied yet — the shell renders a
  // friendly "unavailable" state in that case rather than crashing.
  const { data, error } = await supabase.rpc("analytics_overview");
  const raw = (data as unknown as AnalyticsRaw | null) ?? null;
  const analytics = raw && Array.isArray(raw.profiles) ? computeAnalytics(raw) : null;

  return <DevAnalyticsShell analytics={analytics} failed={!!error || !analytics} />;
}
