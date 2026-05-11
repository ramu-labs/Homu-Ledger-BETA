"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DbRecurringItem } from "@/lib/types";

const SELECT_FIELDS =
  "id, type, amount, name, category_id, wallet_id, frequency, next_due_date, repeat_until, created_by, created_at, categories(id, name, symbol, color, type), wallets(id, name, symbol, color, initial_balance, is_default)";

function parseItem(data: any): DbRecurringItem {
  return {
    ...data,
    amount: Number(data.amount),
    categories: Array.isArray(data.categories) ? data.categories[0] ?? null : data.categories,
    wallets: Array.isArray(data.wallets) ? data.wallets[0] ?? null : data.wallets,
  };
}

export async function addRecurringItem(
  formData: FormData
): Promise<{ item?: DbRecurringItem; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { error: "No household" };

  const type = formData.get("type") as "income" | "expense";
  const amount = formData.get("amount") as string;
  const name = (formData.get("name") as string).trim();
  const category_id = (formData.get("category_id") as string) || null;
  const frequency = formData.get("frequency") as "weekly" | "monthly" | "yearly";
  const next_due_date = (formData.get("next_due_date") as string) || null;
  const repeat_until = (formData.get("repeat_until") as string) || null;

  if (!name) return { error: "Name required" };
  if (!amount || isNaN(Number(amount))) return { error: "Valid amount required" };
  if (!frequency) return { error: "Frequency required" };

  const { data, error } = await supabase
    .from("recurring_items")
    .insert({
      household_id: profile.household_id,
      created_by: user.id,
      type,
      amount: Number(amount),
      name,
      category_id: category_id || null,
      frequency,
      next_due_date: next_due_date || null,
      repeat_until: repeat_until || null,
    })
    .select(SELECT_FIELDS)
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to add" };

  revalidatePath("/transactions");
  return { item: parseItem(data) };
}

export async function updateRecurringItem(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const type = formData.get("type") as "income" | "expense";
  const amount = formData.get("amount") as string;
  const name = (formData.get("name") as string).trim();
  const category_id = (formData.get("category_id") as string) || null;
  const frequency = formData.get("frequency") as "weekly" | "monthly" | "yearly";
  const next_due_date = (formData.get("next_due_date") as string) || null;
  const repeat_until = (formData.get("repeat_until") as string) || null;

  if (!name) return { error: "Name required" };
  if (!amount || isNaN(Number(amount))) return { error: "Valid amount required" };

  const { error } = await supabase
    .from("recurring_items")
    .update({
      type,
      amount: Number(amount),
      name,
      category_id: category_id || null,
      frequency,
      next_due_date: next_due_date || null,
      repeat_until: repeat_until || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  return {};
}

export async function deleteRecurringItem(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("recurring_items").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  return {};
}
