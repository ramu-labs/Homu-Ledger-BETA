"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DbWallet } from "@/lib/types";
import { getClientOpId, isClientOpDuplicate } from "@/lib/idempotency";

const COLOR_PALETTE = [
  "#22c55e", "#3b82f6", "#8b5cf6", "#f97316",
  "#ef4444", "#ec4899", "#eab308", "#14b8a6", "#6b7280",
];

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;
}

async function getHouseholdId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, householdId: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();
  return { supabase, householdId: profile?.household_id ?? null };
}

export async function addWallet(
  formData: FormData
): Promise<{ wallet?: DbWallet; error?: string }> {
  const { supabase, householdId } = await getHouseholdId();
  if (!supabase || !householdId) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const symbol = (formData.get("symbol") as string).trim();
  const colorDirect = formData.get("color") as string | null;
  const colorIndex = parseInt(formData.get("color_index") as string) || 0;
  const color = colorDirect || COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  const initialBalance = parseAmount(formData.get("initial_balance") as string);

  if (!name) return { error: "Name required" };
  if (!symbol) return { error: "Icon required" };

  const client_op_id = getClientOpId(formData);

  const { data, error } = await supabase
    .from("wallets")
    .insert({
      household_id: householdId,
      name,
      symbol,
      color,
      initial_balance: initialBalance,
      is_default: false,
      ...(client_op_id ? { client_op_id } : {}),
    })
    .select("id, name, symbol, color, initial_balance, is_default")
    .single();

  if (error || !data) {
    // Idempotent retry: refetch the previously-inserted row by its
    // client_op_id (scoped to household) so the caller still gets back a
    // wallet object — they'd expect a successful add to return one.
    if (error && isClientOpDuplicate(error) && client_op_id) {
      const { data: existing } = await supabase
        .from("wallets")
        .select("id, name, symbol, color, initial_balance, is_default")
        .eq("household_id", householdId)
        .eq("client_op_id", client_op_id)
        .single();
      if (existing) {
        revalidatePath("/transactions");
        revalidatePath("/reports");
        revalidatePath("/settings/wallets");
        return { wallet: { ...existing, initial_balance: Number(existing.initial_balance) } };
      }
    }
    return { error: error?.message ?? "Failed to add" };
  }

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings/wallets");
  return { wallet: { ...data, initial_balance: Number(data.initial_balance) } };
}

export async function updateWallet(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const { supabase } = await getHouseholdId();
  if (!supabase) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const symbol = (formData.get("symbol") as string).trim();
  const color = (formData.get("color") as string).trim();
  const initialBalanceRaw = formData.get("initial_balance") as string | null;

  if (!name) return { error: "Name required" };
  if (!symbol) return { error: "Icon required" };

  // Typed against the wallets schema so a column rename here would be a
  // compile error rather than a silent no-op.
  const update: {
    name: string;
    symbol: string;
    color: string;
    initial_balance?: number;
  } = { name, symbol, color };
  // initial_balance is optional on update — only override when explicitly provided
  if (initialBalanceRaw != null && initialBalanceRaw !== "") {
    update.initial_balance = parseAmount(initialBalanceRaw);
  }

  const { error } = await supabase.from("wallets").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings/wallets");
  return {};
}

export async function deleteWallet(id: string): Promise<{ error?: string }> {
  const { supabase } = await getHouseholdId();
  if (!supabase) return { error: "Not authenticated" };

  // Server-side guard so users can't bypass via direct API:
  // Default wallet is also blocked by RLS, but we surface a friendlier message.
  const { data: wallet } = await supabase
    .from("wallets")
    .select("is_default")
    .eq("id", id)
    .single();
  if (wallet?.is_default) {
    return { error: "Set another wallet as default before deleting this one." };
  }

  const { error } = await supabase.from("wallets").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings/wallets");
  return {};
}

export async function setDefaultWallet(id: string): Promise<{ error?: string }> {
  const { supabase } = await getHouseholdId();
  if (!supabase) return { error: "Not authenticated" };

  // The DB trigger flips the previous default to false automatically.
  const { error } = await supabase.from("wallets").update({ is_default: true }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings/wallets");
  return {};
}
