"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DbCategory, TransactionType } from "@/lib/types";

const COLOR_PALETTE = [
  "#f97316", "#3b82f6", "#8b5cf6", "#ef4444",
  "#ec4899", "#eab308", "#14b8a6", "#22c55e", "#6b7280",
];

function parseType(raw: FormDataEntryValue | null): TransactionType {
  return raw === "income" ? "income" : "expense";
}

export async function addCategory(
  formData: FormData
): Promise<{ category?: DbCategory; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { error: "No household" };

  const name = (formData.get("name") as string).trim();
  const symbol = (formData.get("symbol") as string).trim();
  const colorDirect = formData.get("color") as string | null;
  const colorIndex = parseInt(formData.get("color_index") as string) || 0;
  const color = colorDirect || COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  const type = parseType(formData.get("type"));

  if (!name) return { error: "Name required" };
  if (!symbol) return { error: "Emoji required" };

  const { data, error } = await supabase
    .from("categories")
    .insert({ household_id: profile.household_id, name, symbol, color, type })
    .select("id, name, symbol, color, type, is_default")
    .single();

  if (error || !data) return { error: error?.message ?? "Failed to add" };

  revalidatePath("/transactions");
  revalidatePath("/settings/categories");
  return { category: data as DbCategory };
}

export async function updateCategory(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const symbol = (formData.get("symbol") as string).trim();
  const color = (formData.get("color") as string).trim();

  if (!name) return { error: "Name required" };
  if (!symbol) return { error: "Symbol required" };

  const { error } = await supabase
    .from("categories")
    .update({ name, symbol, color })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/settings/categories");
  return {};
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/settings/categories");
  return {};
}
