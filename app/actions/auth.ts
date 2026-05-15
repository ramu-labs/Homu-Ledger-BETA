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

/**
 * Completes onboarding for a user that signed in via OAuth (Google).
 *
 * Required: username (3–20 chars, lowercase letters/digits/underscores).
 * Optional: promo code. If provided and valid, it's redeemed and the user
 * gets a PRO subscription tier. If omitted, the user lands on the free tier
 * (subscription_tier stays NULL — the PRO badge and welcome modal both
 * handle null gracefully).
 *
 * Profile may already exist (created by the auth-side handle_new_user
 * trigger on Google sign-in) with `name` populated from Google's metadata;
 * we always upsert so this works whether or not the trigger ran.
 */
export async function completeGoogleProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  // Profiles schema requires a non-null email. Google OAuth always provides
  // one (it's the user's verified Google email), so this branch is more of
  // a TypeScript guard than a real runtime case.
  if (!user.email) return { error: "Email missing from auth session — please re-sign in." };

  const username = ((formData.get("username") as string) ?? "").trim().toLowerCase();
  const nameInput = ((formData.get("name") as string) ?? "").trim();
  const promoRaw = ((formData.get("promo_code") as string | null) ?? "").trim();
  const promoCode = promoRaw ? promoRaw.toUpperCase() : "";

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only." };
  }

  // Username uniqueness — case-insensitive. Exclude the current user (if
  // they're somehow re-running setup, e.g. via a back/refresh).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .neq("id", user.id)
    .maybeSingle();
  if (existing) return { error: "Username already taken." };

  // Optional: if a promo code was provided, validate it BEFORE writing the
  // username. Avoids leaving the user with a half-completed setup if the
  // code is bad.
  if (promoCode) {
    const admin = getAdminClient();
    const { data: codeIsValid } = await admin.rpc("is_promo_code_valid", { p_code: promoCode });
    if (!codeIsValid) return { error: "Invalid or already-redeemed promo code." };
  }

  // Derive a sensible default for `name` and `initials` if the trigger
  // hasn't populated them (Google's `full_name` metadata isn't always set
  // for OAuth-only signups). Falls back to the part before @ in the email.
  const fallbackName =
    nameInput ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.email ? user.email.split("@")[0] : "Friend");
  const initials = fallbackName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

  // Upsert the profile so we cover both "trigger created it" and "trigger
  // didn't fire" cases. RLS update policy already permits self-edit.
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        username,
        name: fallbackName,
        email: user.email,
        initials,
      },
      { onConflict: "id" }
    );
  if (upsertError) return { error: upsertError.message };

  // Redeem the promo last so failures here don't leave the username unset
  // (the validation pre-check above means this almost always succeeds, but
  // a concurrent redemption from another session is still possible).
  if (promoCode) {
    const { error: redeemError } = await supabase.rpc("redeem_promo_code", { p_code: promoCode });
    if (redeemError) {
      return { error: `Profile saved, but promo redemption failed: ${redeemError.message}` };
    }
  }

  redirect(promoCode ? "/onboarding?welcome=1" : "/onboarding");
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
  // scope: 'local' (v1.30.0) — by default Supabase's signOut uses
  // 'global', which revokes EVERY refresh token for the user across
  // every device. That was responsible for the "I signed out on the
  // preview and got kicked from my iPhone PWA" reports. Local keeps
  // other devices alive; users who actually want to sign out
  // everywhere have the new Devices page or the explicit "Sign out
  // other devices" button there.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

/**
 * Sign out every OTHER device (keep the current one). Wraps Supabase's
 * built-in `scope: 'others'`. Used by the bulk button on /settings/
 * devices and by anyone who realises they lost a device.
 */
export async function signOutOtherDevices(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: error.message };
  return {};
}

/**
 * Revoke the refresh tokens for a single auth.sessions row. The row
 * stays so the user can see what was kicked, then optionally delete
 * it. RPC enforces the session belongs to the calling user.
 */
export async function signOutDeviceSession(
  sessionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_out_session", { p_session_id: sessionId });
  if (error) return { error: error.message };
  return {};
}

/**
 * Permanently remove an auth.sessions row (and any leftover refresh
 * tokens via the FK cascade). The row will be removed from the
 * Devices list on the next refresh.
 */
export async function deleteDeviceSession(
  sessionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_user_session", { p_session_id: sessionId });
  if (error) return { error: error.message };
  return {};
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

  // Migration 0011 locked down household_members INSERT to owners only;
  // joins must go through the SECURITY DEFINER RPC which both validates
  // the code and inserts the membership atomically.
  const { error } = await supabase.rpc("join_household_by_invite_code", { p_code: code });
  if (error) return { error: "Invalid invite code. Check the code and try again." };

  redirect("/transactions");
}
