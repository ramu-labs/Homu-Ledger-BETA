// Voice transactions screen — full-takeover surface, route-based so
// native back / safe-area / focus-trap come for free.
//
// Server-side gate: voice_input_enabled must be 'true' in app_settings
// AND the household must have categories + wallets configured (a fresh
// onboarding might land here before any categories exist). On either
// failure we just redirect back to /transactions; the FAB is hidden in
// those cases anyway, so reaching this URL would mean a stale tab or
// the user typing it manually.

import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import VoiceShell from "@/components/voice-shell";
import type { DbCategory, DbWallet } from "@/lib/types";

export default async function VoiceTransactionsPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.household_id) redirect("/onboarding");
  // v1.41.1: dev-only access while we validate the pipeline on real
  // hardware. Returning notFound() (not redirect) so the URL behaves
  // identically for non-devs whether or not the flag is on — no info
  // leak about feature existence.
  if (!profile.is_developer) notFound();

  const { data: flagRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "voice_input_enabled")
    .maybeSingle();
  if (flagRow?.value !== "true") notFound();

  const { data: household } = await supabase
    .from("households")
    .select("id, currency, ai_language")
    .eq("id", profile.household_id)
    .single();
  if (!household) redirect("/onboarding");

  // v1.42.1: also pull a recent-transaction sample so we can compute
  // the household's TOP-N categories by usage. Gemini gets a trimmed
  // list of just those for parsing (much cheaper tokens-wise on
  // households with 50+ categories), while the manual picker in the
  // row still shows all of them.
  const [{ data: categoriesRaw }, { data: walletsRaw }, { data: recentTxRaw }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, symbol, color, type")
      .eq("household_id", household.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("wallets")
      .select("id, name, symbol, color, initial_balance, is_default")
      .eq("household_id", household.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true }),
    // Last 200 transactions is plenty to surface a stable usage
    // ranking. The lookup is indexed on household_id + date + id.
    supabase
      .from("transactions")
      .select("category_id")
      .eq("household_id", household.id)
      .is("transfer_pair_id", null)
      .not("category_id", "is", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const categories: DbCategory[] = categoriesRaw ?? [];
  const wallets: DbWallet[] = (walletsRaw ?? []).map((w) => ({
    ...w,
    initial_balance: Number(w.initial_balance ?? 0),
  }));

  // Count usage per category id from the recent slice. Categories not
  // appearing in the recent sample get a tiebreaker of 0 — they still
  // show up in the user's picker, but Gemini won't be told about them
  // (the user can manually swap to any of the household's full list).
  const usage = new Map<string, number>();
  for (const row of recentTxRaw ?? []) {
    if (row.category_id) usage.set(row.category_id, (usage.get(row.category_id) ?? 0) + 1);
  }
  // Top 12 keeps the prompt small (~12 × ~30 tokens each = ~360
  // tokens of category data) while still covering every category the
  // user touches in a typical week. Fall back to "all" when the
  // household has fewer than 12 categories total.
  const TOP_N = 12;
  const topCategoryIds = new Set(
    [...categories]
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))
      .slice(0, TOP_N)
      .map((c) => c.id)
  );
  const categoriesForGemini = categories.filter((c) => topCategoryIds.has(c.id));

  // Edge case: a brand-new household with no categories yet. Send them
  // back to /transactions and let the SSR-rendered empty state guide
  // them to create one manually first.
  if (categories.length === 0 || wallets.length === 0) {
    redirect("/transactions");
  }

  return (
    <VoiceShell
      categories={categories}
      categoriesForGemini={categoriesForGemini}
      wallets={wallets}
      currency={household.currency ?? "IDR"}
      iconStyle={profile.icon_style ?? "3d"}
      languageHint={
        // Household-level Bahasa/English preference (from v1.27.0).
        // 'auto' means let Whisper detect — usually what bilingual
        // households want.
        (household as { ai_language?: string | null }).ai_language === "id"
          ? "id"
          : (household as { ai_language?: string | null }).ai_language === "en"
            ? "en"
            : "auto"
      }
    />
  );
}
