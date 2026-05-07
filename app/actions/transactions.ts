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

async function uploadPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from("transaction-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error || !data) return null;
  const { data: { publicUrl } } = supabase.storage
    .from("transaction-photos")
    .getPublicUrl(data.path);
  return publicUrl;
}

export async function addTransaction(formData: FormData) {
  const { supabase, userId, householdId } = await getHouseholdId();
  if (!supabase || !userId || !householdId) return { error: "Not authenticated" };

  const type = formData.get("type") as "income" | "expense";
  const name = (formData.get("name") as string).trim();
  const amount = parseAmount(formData.get("amount") as string);
  const category_id = (formData.get("category_id") as string) || null;
  const wallet_id = (formData.get("wallet_id") as string) || null;
  const date = formData.get("date") as string;

  if (!name) return { error: "Description is required" };
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  const photoFile = formData.get("photo") as File | null;
  let photo_url: string | null = null;
  if (photoFile && photoFile.size > 0) {
    photo_url = await uploadPhoto(supabase, householdId, photoFile);
  }

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
}

export async function updateTransaction(id: string, formData: FormData) {
  const { supabase, householdId } = await getHouseholdId();
  if (!supabase || !householdId) return { error: "Not authenticated" };

  const type = formData.get("type") as "income" | "expense";
  const name = (formData.get("name") as string).trim();
  const amount = parseAmount(formData.get("amount") as string);
  const category_id = (formData.get("category_id") as string) || null;
  const wallet_id = (formData.get("wallet_id") as string) || null;
  const date = formData.get("date") as string;

  if (!name) return { error: "Description is required" };
  if (amount <= 0) return { error: "Amount must be greater than 0" };

  const photoFile = formData.get("photo") as File | null;
  let photo_url: string | null = null;
  if (photoFile && photoFile.size > 0) {
    photo_url = await uploadPhoto(supabase, householdId, photoFile);
  } else if (formData.get("keep_photo") === "1") {
    photo_url = (formData.get("existing_photo_url") as string) || null;
  }

  const { error } = await supabase
    .from("transactions")
    .update({ type, amount, name, category_id, wallet_id, date, photo_url })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
}

export async function deleteTransaction(id: string) {
  const { supabase } = await getHouseholdId();
  if (!supabase) return { error: "Not authenticated" };

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/transactions");
  revalidatePath("/reports");
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
