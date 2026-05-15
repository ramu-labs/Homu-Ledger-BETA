"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LIMITS, validateAmount, validateDate, validateName, validateType } from "@/lib/validation";
import { getClientOpId, isClientOpDuplicate } from "@/lib/idempotency";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type ActionResult = { error?: string };

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

async function validateTransactionRefs(
  supabase: Supabase,
  householdId: string,
  categoryId: string | null,
  walletId: string | null
): Promise<ActionResult> {
  if (categoryId) {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Category does not belong to this ledger" };
  }

  if (walletId) {
    const { data, error } = await supabase
      .from("wallets")
      .select("id")
      .eq("id", walletId)
      .eq("household_id", householdId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Wallet does not belong to this ledger" };
  }

  return {};
}

// Photo uploads are now done client-side directly to Supabase Storage so we
// don't relay multi-MB iPhone photos through Vercel server actions (which
// hit the 4.5 MB body limit on Hobby and stall on slow mobile networks).
// Server actions only receive the resulting private storage object path.

export async function addTransaction(formData: FormData): Promise<ActionResult> {
  const { supabase, userId, householdId } = await getHouseholdId();
  if (!supabase || !userId || !householdId) return { error: "Not authenticated" };

  const typeRaw = formData.get("type");
  const name = (formData.get("name") as string).trim();
  const amount = parseAmount(formData.get("amount") as string);
  const category_id = (formData.get("category_id") as string) || null;
  const wallet_id = (formData.get("wallet_id") as string) || null;
  const date = formData.get("date") as string;
  const photo_url = (formData.get("photo_url") as string) || null;

  if (!validateType(typeRaw)) return { error: "Type must be income or expense" };
  const type = typeRaw;
  const nameErr = validateName(name, LIMITS.TX_NAME, "Description");
  if (nameErr) return { error: nameErr };
  const amountErr = validateAmount(amount);
  if (amountErr) return { error: amountErr };
  const dateErr = validateDate(date);
  if (dateErr) return { error: dateErr };

  const refs = await validateTransactionRefs(supabase, householdId, category_id, wallet_id);
  if (refs.error) return refs;

  const client_op_id = getClientOpId(formData);

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
    ...(client_op_id ? { client_op_id } : {}),
  });

  if (error) {
    // Idempotent retry from the offline queue: this client_op_id already
    // landed for this household, so the prior attempt succeeded — return
    // success and revalidate so the UI converges on the existing row.
    if (isClientOpDuplicate(error)) {
      revalidatePath("/transactions");
      revalidatePath("/reports");
      return {};
    }
    return { error: error.message };
  }
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function updateTransaction(id: string, formData: FormData): Promise<ActionResult> {
  const { supabase, householdId } = await getHouseholdId();
  if (!supabase || !householdId) return { error: "Not authenticated" };

  // Transfers are immutable — the user must delete and recreate to change them,
  // since a transfer is two paired rows and partial updates would desync them.
  const { data: existing } = await supabase
    .from("transactions")
    .select("transfer_pair_id")
    .eq("id", id)
    .eq("household_id", householdId)
    .single();
  if (existing?.transfer_pair_id) {
    return { error: "Transfers can't be edited — delete this row and create a new transfer." };
  }

  const typeRaw = formData.get("type");
  const name = (formData.get("name") as string).trim();
  const amount = parseAmount(formData.get("amount") as string);
  const category_id = (formData.get("category_id") as string) || null;
  const wallet_id = (formData.get("wallet_id") as string) || null;
  const date = formData.get("date") as string;
  const photo_url = (formData.get("photo_url") as string) || null;

  if (!validateType(typeRaw)) return { error: "Type must be income or expense" };
  const type = typeRaw;
  const nameErr = validateName(name, LIMITS.TX_NAME, "Description");
  if (nameErr) return { error: nameErr };
  const amountErr = validateAmount(amount);
  if (amountErr) return { error: amountErr };
  const dateErr = validateDate(date);
  if (dateErr) return { error: dateErr };

  const refs = await validateTransactionRefs(supabase, householdId, category_id, wallet_id);
  if (refs.error) return refs;

  const { error } = await supabase
    .from("transactions")
    .update({ type, amount, name, category_id, wallet_id, date, photo_url })
    .eq("id", id)
    .eq("household_id", householdId);

  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const { supabase, householdId } = await getHouseholdId();
  if (!supabase || !householdId) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return {};
}

export async function addTransfer(formData: FormData): Promise<ActionResult> {
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

export async function moveTransaction(id: string, targetHouseholdId: string): Promise<ActionResult> {
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
