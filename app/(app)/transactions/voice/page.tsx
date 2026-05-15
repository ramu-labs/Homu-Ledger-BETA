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

  const [{ data: categoriesRaw }, { data: walletsRaw }] = await Promise.all([
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
  ]);

  const categories: DbCategory[] = categoriesRaw ?? [];
  const wallets: DbWallet[] = (walletsRaw ?? []).map((w) => ({
    ...w,
    initial_balance: Number(w.initial_balance ?? 0),
  }));

  // Edge case: a brand-new household with no categories yet. Send them
  // back to /transactions and let the SSR-rendered empty state guide
  // them to create one manually first.
  if (categories.length === 0 || wallets.length === 0) {
    redirect("/transactions");
  }

  return (
    <VoiceShell
      categories={categories}
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
