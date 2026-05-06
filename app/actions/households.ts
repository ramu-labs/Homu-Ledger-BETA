"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function switchHousehold(householdId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .eq("profile_id", user.id)
    .single();

  if (!membership) return { error: "Not a member of this household" };

  const { error } = await supabase
    .from("profiles")
    .update({ household_id: householdId })
    .eq("id", user.id);

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

  const { error } = await supabase
    .from("households")
    .update({ currency })
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
  if (!trimmed) return { error: "Name required" };
  if (trimmed.length > 60) return { error: "Name too long" };

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

  const { error } = await supabase
    .from("households")
    .update({ symbol })
    .eq("id", profile.household_id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return {};
}

export async function createNewLedger(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const currency = (formData.get("currency") as string) || "IDR";
  const openingBalanceRaw = (formData.get("opening_balance") as string) || "0";
  const openingBalance = parseFloat(openingBalanceRaw.replace(/\./g, "").replace(",", ".")) || 0;

  if (!name) return { error: "Name required" };

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

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings");
  return {};
}
