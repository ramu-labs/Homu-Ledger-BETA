"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const username = (formData.get("username") as string).trim().toLowerCase();
  const promoCodeRaw = (formData.get("promo_code") as string | null)?.trim();
  const promoCode = promoCodeRaw ? promoCodeRaw.toUpperCase() : "";

  if (!promoCode) {
    return { error: "Promo code is required to create an account." };
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only." };
  }

  // Pre-check: confirm the code is valid and unredeemed before we create
  // the auth account. Avoids creating an orphan account if the code is bad.
  // Use the admin client so this RPC is no longer reachable by anon REST
  // callers (see migration 0012).
  const admin = getAdminClient();
  const { data: codeIsValid } = await admin.rpc("is_promo_code_valid", { p_code: promoCode });
  if (!codeIsValid) {
    return { error: "Invalid or already-redeemed promo code." };
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

    // Atomic redeem: marks code used + writes subscription_tier on the profile.
    // Race-condition window is tiny; if it does fail here we surface the error
    // but the auth account already exists (user can sign in but won't have PRO).
    const { error: redeemError } = await supabase.rpc("redeem_promo_code", { p_code: promoCode });
    if (redeemError) {
      return { error: `Account created but code redemption failed: ${redeemError.message}` };
    }
  }

  redirect("/onboarding?welcome=1");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const identifier = (formData.get("identifier") as string).trim();
  const password = formData.get("password") as string;

  let email = identifier;

  if (!identifier.includes("@")) {
    // Treat as username — resolve via the service-role admin client so the
    // username→email RPC is not exposed to anon REST callers (which would
    // let anyone enumerate registered emails). See migration 0012.
    const admin = getAdminClient();
    const { data: resolvedEmail, error: rpcError } = await admin
      .rpc("get_email_by_username", { p_username: identifier });

    if (rpcError || !resolvedEmail) return { error: "No account found with that username." };
    email = resolvedEmail as string;
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

  // Bust cache for every page that reads icon_style from the profile
  revalidatePath("/", "layout");
  return {};
}

export async function joinHousehold(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const code = (formData.get("invite_code") as string).trim().toUpperCase();

  const { data: lookupRows, error: lookupError } = await supabase
    .rpc("lookup_household_by_invite_code", { p_code: code });
  const household = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows;

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
