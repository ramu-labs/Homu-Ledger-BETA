"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const username = (formData.get("username") as string).trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only." };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existing) return { error: "Username already taken." };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, username } },
  });

  if (error) return { error: error.message };

  // Persist username + email to profile (trigger may have already created the row)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ username, email }).eq("id", user.id);
  }

  redirect("/onboarding");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const identifier = (formData.get("identifier") as string).trim();
  const password = formData.get("password") as string;

  let email = identifier;

  if (!identifier.includes("@")) {
    // Treat as username — look up the email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", identifier)
      .maybeSingle();

    if (!profile) return { error: "No account found with that username." };

    // Get the email from auth.users via admin lookup isn't possible client-side,
    // so we store email on the profile as a workaround
    const { data: profileWithEmail } = await supabase
      .from("profiles")
      .select("email")
      .ilike("username", identifier)
      .maybeSingle();

    if (!profileWithEmail?.email) return { error: "Could not resolve username to an email." };
    email = profileWithEmail.email;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/transactions");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createHousehold(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const openingBalanceRaw = formData.get("opening_balance") as string;
  const openingBalance = parseFloat(openingBalanceRaw.replace(/\./g, "").replace(",", ".")) || 0;

  // Generate a unique invite code via the DB function
  const { data: codeData, error: codeError } = await supabase.rpc("generate_invite_code");
  if (codeError) return { error: codeError.message };

  // Insert the household (trigger auto-seeds default categories)
  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ name, invite_code: codeData, opening_balance: openingBalance, owner_id: user.id })
    .select()
    .single();

  if (householdError) return { error: householdError.message };

  // Track membership
  await supabase
    .from("household_members")
    .insert({ household_id: household.id, profile_id: user.id, role: "owner" });

  // Link the current user's profile to this household
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };
  redirect("/transactions");
}

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const username = (formData.get("username") as string).trim().toLowerCase();
  const avatar_color = formData.get("avatar_color") as string;
  const initials = (formData.get("initials") as string).trim().slice(0, 2);
  const newPassword = (formData.get("new_password") as string | null)?.trim();

  if (!name) return { error: "Name is required." };
  if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only." };
  }

  if (username) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .neq("id", user.id)
      .maybeSingle();
    if (existing) return { error: "Username already taken." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ name, username: username || null, avatar_color, initials })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  if (newPassword) {
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    if (pwError) return { error: pwError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return {};
}

export async function updateUserLanguage(language: string): Promise<{ error?: string }> {
  if (!["en", "id"].includes(language)) return { error: "Unsupported language" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ language })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export async function updateUserIconStyle(iconStyle: string): Promise<{ error?: string }> {
  if (!["2d", "3d"].includes(iconStyle)) return { error: "Unsupported icon style" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ icon_style: iconStyle })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return {};
}

export async function joinHousehold(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const code = (formData.get("invite_code") as string).trim().toUpperCase();

  const { data: household, error: lookupError } = await supabase
    .from("households")
    .select("id, name")
    .eq("invite_code", code)
    .single();

  if (lookupError || !household) return { error: "Invalid invite code. Check the code and try again." };

  // Track membership (upsert in case they're re-joining)
  await supabase
    .from("household_members")
    .upsert({ household_id: household.id, profile_id: user.id, role: "member" });

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };
  redirect("/transactions");
}
