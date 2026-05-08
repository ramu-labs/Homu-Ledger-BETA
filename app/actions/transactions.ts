"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getHouseholdId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, userId: null, householdId: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();
  return { supabase, userId: user.id, householdId: profile?.household_id ?? null };
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

// Photo uploads are now done client-side directly to Supabase Storage so we
// don't relay multi-MB iPhone photos through Vercel server actions (which
// hit the 4.5 MB body limit on Hobby and stall on slow mobile networks).
// Server actions only receive the resulting public URL.

export async function addTransaction(formData: FormData) {
  const { supabase, userId, householdId } = await getHouseholdId();
  if (!supabase || !userId || !householdId) return { error: "Not authenticated" };

  const type = formData.get("type") as "income" | "expense";
  const name = (formData.get("name") as string).trim();
  const amount = parseAmount(formData.get("amount") as string);
  const category_id = (formData.get("category_id") as string) || null;
  const wallet_id = (formData.get("wallet_id") as string) || null;
  const date = formData.get("date") as string;
  const photo_url = (formData.get("photo_url") as string) || null;

  if (!name) return { error: "Description is required" };
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  const { error } = await supabase.from("transactions").insert({
    household_id: householdId,
    created_by: userId,
    type,
    amount,
    name,
    category_id,
    wallet_id,
    date,
    photo_url,
  });

  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function updateTransaction(id: string, formData: FormData) {
  const { supabase, householdId } = await getHouseholdId();
  if (!supabase || !householdId) return { error: "Not authenticated" };

  // Transfers are immutable — the user must delete and recreate to change them,
  // since a transfer is two paired rows and partial updates would desync them.
  const { data: existing } = await supabase
    .from("transactions")
    .select("transfer_pair_id")
    .eq("id", id)
    .single();
  if (existing?.transfer_pair_id) {
    return { error: "Transfers can't be edited — delete this row and create a new transfer." };
  }

  const type = formData.get("type") as "income" | "expense";
  const name = (formData.get("name") as string).trim();
  const amount = parseAmount(formData.get("amount") as string);
  const category_id = (formData.get("category_id") as string) || null;
  const wallet_id = (formData.get("wallet_id") as string) || null;
  const date = formData.get("date") as string;
  const photo_url = (formData.get("photo_url") as string) || null;

  if (!name) return { error: "Description is required" };
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  const { error } = await supabase
    .from("transactions")
    .update({ type, amount, name, category_id, wallet_id, date, photo_url })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function deleteTransaction(id: string) {
  const { supabase } = await getHouseholdId();
  if (!supabase) return { error: "Not authenticated" };

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function addTransfer(formData: FormData) {
  const { supabase, householdId } = await getHouseholdId();
  if (!supabase || !householdId) return { error: "Not authenticated" };

  const fromWalletId = (formData.get("from_wallet_id") as string) || "";
  const toWalletId = (formData.get("to_wallet_id") as string) || "";
  const amount = parseAmount(formData.get("amount") as string);
  const name = ((formData.get("name") as string) || "Transfer").trim() || "Transfer";
  const date = (formData.get("date") as string) || new Date().toISOString().split("T")[0];

  if (!fromWalletId || !toWalletId) return { error: "Both wallets required" };
  if (fromWalletId === toWalletId) return { error: "Source and destination wallets must differ" };
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  const { error } = await supabase.rpc("create_transfer", {
    p_from_wallet: fromWalletId,
    p_to_wallet: toWalletId,
    p_amount: amount,
    p_name: name,
    p_date: date,
  });
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function moveTransaction(id: string, targetHouseholdId: string) {
  const { supabase } = await getHouseholdId();
  if (!supabase) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("move_transaction", {
    p_transaction_id: id,
    p_target_household_id: targetHouseholdId,
  });

  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}
