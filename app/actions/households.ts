"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LIMITS, validateAmount, validateCurrency, validateName, validateSymbol } from "@/lib/validation";
import { applyHouseholdPresets } from "@/lib/household-presets-server";

export async function switchHousehold(householdId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("switch_household", { p_household_id: householdId });
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings");
  return {};
}

export async function updateHouseholdCurrency(currency: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { error: "No household" };

  const currencyErr = validateCurrency(currency);
  if (currencyErr) return { error: currencyErr };

  const { error } = await supabase
    .from("households")
    .update({ currency: currency.trim() })
    .eq("id", profile.household_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function updateHouseholdName(name: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = name.trim();
  const nameErr = validateName(trimmed, LIMITS.HOUSEHOLD_NAME);
  if (nameErr) return { error: nameErr };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { error: "No household" };

  const { error } = await supabase
    .from("households")
    .update({ name: trimmed })
    .eq("id", profile.household_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function updateHouseholdSymbol(symbol: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { error: "No household" };

  const symbolErr = validateSymbol(symbol);
  if (symbolErr) return { error: symbolErr };

  const { error } = await supabase
    .from("households")
    .update({ symbol })
    .eq("id", profile.household_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return {};
}

export async function deleteCurrentHousehold(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { error: "No household" };

  const householdId = profile.household_id;

  const { data: household } = await supabase
    .from("households")
    .select("owner_id")
    .eq("id", householdId)
    .single();

  if (!household) return { error: "Ledger not found" };
  if (household.owner_id !== user.id) {
    return { error: "Only the owner can delete this ledger" };
  }

  // Pick a fallback ledger to switch to before deleting, so the user lands
  // somewhere instead of having a NULL household_id afterward.
  const { data: fallback } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .neq("household_id", householdId)
    .limit(1)
    .maybeSingle();

  if (!fallback?.household_id) {
    return { error: "Create or join another ledger first — you can't delete your only ledger." };
  }

  const { error: deleteError } = await supabase
    .from("households")
    .delete()
    .eq("id", householdId);

  if (deleteError) return { error: deleteError.message };

  await supabase.rpc("switch_household", { p_household_id: fallback.household_id });

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

// Hard cap on owned ledgers per user. Picked at 20 because it covers
// even power users with separate ledgers for each business / event /
// household-shared budget, while still being a low enough ceiling to
// catch runaway loops or scripts in the wild. Surfaced only at the
// moment of attempted creation — the UI is silent until you hit it.
const MAX_LEDGERS_PER_OWNER = 20;

export async function createNewLedger(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Cap check uses an indexed COUNT on owner_id. We count ledgers the
  // user OWNS, not all memberships — joining someone else's household
  // doesn't count against the limit (you didn't create it). RLS lets
  // the user SELECT their own owned households so this is allowed
  // without elevation.
  const { count: ownedCount, error: countError } = await supabase
    .from("households")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if (countError) return { error: countError.message };
  if ((ownedCount ?? 0) >= MAX_LEDGERS_PER_OWNER) {
    return {
      error: `You've reached the limit of ${MAX_LEDGERS_PER_OWNER} ledgers. Delete one to create a new ledger.`,
    };
  }

  const name = (formData.get("name") as string).trim();
  const currency = (formData.get("currency") as string) || "IDR";
  const openingBalanceRaw = (formData.get("opening_balance") as string) || "0";
  const openingBalance = parseFloat(openingBalanceRaw.replace(/\./g, "").replace(",", ".")) || 0;

  // v1.38.1 — accept the same use_case + selected_categories fields
  // as createHousehold so the "create new ledger from Settings" flow
  // mirrors the initial onboarding flow exactly. Same JSON-encoded
  // array convention; missing or malformed = legacy behaviour
  // (default trigger-seeded categories, no wallet seed).
  const useCase = (formData.get("use_case") as string | null)?.trim() || null;
  const selectedCategoriesRaw = (formData.get("selected_categories") as string | null) ?? "";
  let selectedCategoryIds: string[] = [];
  if (selectedCategoriesRaw) {
    try {
      const parsed = JSON.parse(selectedCategoriesRaw);
      if (Array.isArray(parsed)) selectedCategoryIds = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      /* malformed → fall through to legacy */
    }
  }

  const nameErr = validateName(name, LIMITS.HOUSEHOLD_NAME);
  if (nameErr) return { error: nameErr };
  const currencyErr = validateCurrency(currency);
  if (currencyErr) return { error: currencyErr };
  const balanceErr = validateAmount(openingBalance, { allowZero: true });
  if (balanceErr) return { error: balanceErr };

  const { data: codeData, error: codeError } = await supabase.rpc("generate_invite_code");
  if (codeError) return { error: codeError.message };

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ name, invite_code: codeData, opening_balance: openingBalance, owner_id: user.id, currency })
    .select("id")
    .single();

  if (householdError || !household) return { error: householdError?.message ?? "Failed to create" };

  // Insert into membership table
  await supabase
    .from("household_members")
    .insert({ household_id: household.id, profile_id: user.id, role: "owner" });

  // Switch to this new ledger
  await supabase
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", user.id);

  // Apply the use-case-driven preset wipe-and-replace if the page
  // sent the new fields. Best-effort: a preset failure doesn't undo
  // the household — the user still has the trigger defaults to fall
  // back on.
  if (useCase && selectedCategoryIds.length > 0) {
    await applyHouseholdPresets(supabase, household.id, selectedCategoryIds);
  }

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings");
  return {};
}

const AI_LANGUAGES = ["auto", "en", "id"] as const;
export type HouseholdAiLanguage = (typeof AI_LANGUAGES)[number];

/**
 * Set the household's AI-categorisation language hint. Affects the
 * Gemini prompt — see lib/llm/gemini.ts. RLS already gates updates to
 * the household to members, so we just need to look up the active
 * household for this user and patch the column.
 */
export async function setHouseholdAiLanguage(
  language: HouseholdAiLanguage
): Promise<{ error?: string }> {
  if (!AI_LANGUAGES.includes(language)) {
    return { error: "Invalid language" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();
  if (!profile?.household_id) return { error: "No household" };

  const { error } = await supabase
    .from("households")
    .update({ ai_language: language })
    .eq("id", profile.household_id);
  if (error) return { error: error.message };

  // The AI prompt reads ai_language at categorisation time, so the
  // change takes effect on the very next suggestion. Revalidate the
  // settings page so the picker reflects the new value when you
  // navigate back.
  revalidatePath("/settings");
  revalidatePath("/settings/ai-language");
  return {};
}
