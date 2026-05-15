"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

// Valid gender values — kept in lock-step with the CHECK on
// profiles.gender (migration 0027). Re-validated client-side too so we
// can give a friendly error before round-tripping.
const VALID_GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;
type Gender = (typeof VALID_GENDERS)[number];

/**
 * v1.32.0 signup START — validates the form, creates the auth.user, and
 * (if email-confirmation is enabled in the Supabase dashboard) triggers
 * the OTP email. Returns `needsOtp: true` so the client switches to the
 * OTP step; the OTP step then calls `verifySignUpOtp` to finalise.
 *
 * Why split: if we wrote the profile fields + redeemed the promo code
 * here, an unverified account would leave a redeemed code dangling.
 * Doing it post-verification keeps the promo redemption tied to a
 * confirmed user.
 *
 * Backwards-compat: if email confirmation is OFF in the project,
 * supabase.auth.signUp returns a live session immediately. In that
 * case we skip the OTP detour, finalise here, and redirect — the old
 * behaviour.
 */
export async function signUpStartEmailOtp(
  formData: FormData
): Promise<{ ok: true; needsOtp: boolean; email: string } | { error: string }> {
  const supabase = await createClient();
  const email = ((formData.get("email") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";
  const passwordConfirm = (formData.get("password_confirm") as string) ?? "";
  const name = ((formData.get("name") as string) ?? "").trim();
  const username = ((formData.get("username") as string) ?? "").trim().toLowerCase();
  const genderRaw = ((formData.get("gender") as string) ?? "").trim();
  const birthDate = ((formData.get("birth_date") as string) ?? "").trim();
  const promoCodeRaw = (formData.get("promo_code") as string | null)?.trim();
  const promoCode = promoCodeRaw ? promoCodeRaw.toUpperCase() : "";

  // ── Validation (client also checks, but server-side is the source of truth) ──
  if (!email || !email.includes("@")) return { error: "A valid email is required." };
  if (!name) return { error: "Name is required." };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== passwordConfirm) return { error: "Passwords don't match." };
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only." };
  }
  if (!VALID_GENDERS.includes(genderRaw as Gender)) {
    return { error: "Pick a gender option." };
  }
  if (!birthDate || Number.isNaN(new Date(birthDate).getTime())) {
    return { error: "Date of birth is required." };
  }
  // Refuse obviously-bogus DoBs — child under 13 (most jurisdictions
  // require parental consent for under-13 sign-ups) or a future date.
  const birth = new Date(birthDate);
  const now = new Date();
  const minBirth = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
  const maxBirth = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
  if (birth < minBirth || birth > maxBirth) {
    return { error: "You must be 13 or older to sign up." };
  }
  if (!promoCode) return { error: "Promo code is required to create an account." };

  // Promo code validity check via admin client (the RPC is gated to
  // service_role since migration 0012).
  const admin = getAdminClient();
  const { data: codeIsValid } = await admin.rpc("is_promo_code_valid", { p_code: promoCode });
  if (!codeIsValid) return { error: "Invalid or already-redeemed promo code." };

  // Username uniqueness check. Case-insensitive.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existing) return { error: "Username already taken." };

  // Create auth account. Stash the post-OTP fields in user_metadata so
  // `verifySignUpOtp` can read them back without a separate side-table.
  // The handle_new_user trigger creates the profiles row from `name`;
  // the other fields are applied after OTP verification.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        username,
        gender: genderRaw,
        birth_date: birthDate,
        promo_code: promoCode,
      },
    },
  });

  if (error) return { error: error.message };

  // If Supabase returns a session, email-confirmation is OFF in the
  // project — finalise inline like the pre-v1.32.0 flow.
  if (data.session) {
    const finishErr = await finalizeSignUp(supabase, {
      username, email, gender: genderRaw as Gender, birthDate, promoCode,
    });
    if (finishErr) return { error: finishErr };
    redirect("/onboarding?welcome=1");
  }

  // No session = confirmation required. Tell the client to swap into
  // the OTP step.
  return { ok: true, needsOtp: true, email };
}

/**
 * v1.32.0 signup FINISH — called from the OTP step. Verifies the
 * 6-digit code, then writes the username / gender / birth_date and
 * redeems the promo code that was stashed in user_metadata at
 * signUpStartEmailOtp time.
 */
export async function verifySignUpOtp(
  email: string,
  token: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const trimmedEmail = (email ?? "").trim();
  const trimmedToken = (token ?? "").trim();

  if (!trimmedEmail || !trimmedToken) {
    return { error: "Enter the 6-digit code from your email." };
  }
  if (!/^\d{4,8}$/.test(trimmedToken)) {
    return { error: "Code should be all digits (usually 6)." };
  }

  // `type: 'signup'` matches the OTP sent by signUp(). 'email' would
  // be the type for re-confirmation / passwordless flows.
  const { data, error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: "signup",
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Verification failed — try again." };

  // Pull the metadata we stashed at signUpStart and finalise the
  // profile + promo redemption. The handle_new_user trigger has
  // already created the profile row (with `name` from metadata); we
  // just need to fill in the rest and run the redemption.
  const meta = (data.user.user_metadata ?? {}) as {
    username?: string;
    gender?: string;
    birth_date?: string;
    promo_code?: string;
  };

  const finishErr = await finalizeSignUp(supabase, {
    username: (meta.username ?? "").toLowerCase(),
    email: data.user.email ?? trimmedEmail,
    gender: (meta.gender as Gender) ?? null,
    birthDate: meta.birth_date ?? null,
    promoCode: (meta.promo_code ?? "").toUpperCase(),
  });
  if (finishErr) return { error: finishErr };

  redirect("/onboarding?welcome=1");
}

/**
 * Re-send the OTP if the user didn't get the first email. Supabase
 * rate-limits this server-side; we surface the rate-limit error to
 * the user so they know to wait.
 */
export async function resendSignUpOtp(
  email: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const trimmed = (email ?? "").trim();
  if (!trimmed) return { error: "Email is missing — start over." };
  const { error } = await supabase.auth.resend({ type: "signup", email: trimmed });
  if (error) return { error: error.message };
  return {};
}

/**
 * Shared finalisation: write the post-signup profile fields and redeem
 * the promo code. Returns an error string on failure, null on success.
 * Used by BOTH the "email confirmation off" branch in
 * `signUpStartEmailOtp` and the OTP-verified branch in `verifySignUpOtp`.
 */
async function finalizeSignUp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    username: string;
    email: string;
    gender: Gender | null;
    birthDate: string | null;
    promoCode: string;
  }
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Session missing — sign in and try again.";

  // The trigger has created the row; UPDATE to add the rest. Typed
  // explicitly (not Record<string, unknown>) so the generated
  // database.types.ts can validate column names + value types.
  const updates: {
    email: string;
    username: string;
    gender?: string;
    birth_date?: string;
  } = {
    email: args.email,
    username: args.username,
  };
  if (args.gender) updates.gender = args.gender;
  if (args.birthDate) updates.birth_date = args.birthDate;

  const { error: profileErr } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
  if (profileErr) return profileErr.message;

  if (args.promoCode) {
    const { error: redeemError } = await supabase.rpc("redeem_promo_code", { p_code: args.promoCode });
    if (redeemError) {
      // Account created but redemption failed — surface but don't
      // block. The user has an account, just no PRO tier.
      return `Account created but promo redemption failed: ${redeemError.message}`;
    }
  }
  return null;
}

/**
 * Legacy export so any existing call-sites that still import `signUp`
 * keep compiling — they just route through the new flow.
 */
export const signUp = signUpStartEmailOtp;

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

/**
 * Set / update / clear a session's friendly nickname (v1.31.0).
 * Empty-string `nickname` clears any existing nickname, falling the UI
 * back to the parsed user-agent label.
 *
 * RPC enforces ownership: the session must belong to the calling user.
 * Same opaque "Session not found" error for missing vs not-yours.
 */
export async function renameDeviceSession(
  sessionId: string,
  nickname: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const trimmed = (nickname ?? "").trim();
  if (trimmed.length > 50) {
    return { error: "Nickname must be 50 characters or fewer." };
  }
  const { error } = await supabase.rpc("rename_device_session", {
    p_session_id: sessionId,
    p_nickname: trimmed,
  });
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

  // v1.38.0 — the new flow passes "use_case" + "selected_categories"
  // (JSON-encoded array of CategoryPreset ids from
  // EXPENSE_CATEGORY_MASTER). When present we replace the trigger-
  // seeded defaults with the user's selection; when absent we keep
  // the legacy behaviour (defaults untouched) for backwards-compat
  // with any caller that hasn't been updated to the multi-step page.
  const useCase = (formData.get("use_case") as string | null)?.trim() || null;
  const selectedCategoriesRaw = (formData.get("selected_categories") as string | null) ?? "";
  let selectedCategoryIds: string[] = [];
  if (selectedCategoriesRaw) {
    try {
      const parsed = JSON.parse(selectedCategoriesRaw);
      if (Array.isArray(parsed)) selectedCategoryIds = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // Malformed JSON — fall through to legacy behaviour.
    }
  }

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

  // v1.38.0 — apply the use-case-driven setup if the page sent it.
  // Best-effort: failures here don't block the redirect (the user
  // still has the household + the trigger-seeded categories to fall
  // back on).
  if (useCase && selectedCategoryIds.length > 0) {
    await applyHouseholdPresets(supabase, household.id, selectedCategoryIds);
  }

  redirect("/transactions");
}

/**
 * Replace the trigger-seeded default categories with the user-picked
 * set, AND seed the default wallets. Called only from the new
 * onboarding flow — old callers skip this.
 */
async function applyHouseholdPresets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  selectedCategoryIds: string[]
): Promise<void> {
  const {
    EXPENSE_CATEGORY_MASTER,
    DEFAULT_INCOME_CATEGORIES,
    DEFAULT_WALLETS,
  } = await import("@/lib/onboarding-presets");

  // 1. Wipe whatever the seed_default_categories trigger created.
  //    is_default=true is the trigger's marker; user-added categories
  //    have is_default=false so they're safe.
  await supabase
    .from("categories")
    .delete()
    .eq("household_id", householdId)
    .eq("is_default", true);

  // 2. Insert chosen expense categories (filtered against the master).
  const chosenExpense = EXPENSE_CATEGORY_MASTER.filter((c) =>
    selectedCategoryIds.includes(c.id)
  );
  if (chosenExpense.length > 0) {
    await supabase.from("categories").insert(
      chosenExpense.map((c) => ({
        household_id: householdId,
        name: c.name,
        symbol: c.symbol,
        color: c.color,
        is_default: true, // still treat them as the "starter" set
        type: "expense" as const,
      }))
    );
  }

  // 3. Insert the 3 default income categories (always, no picker).
  await supabase.from("categories").insert(
    DEFAULT_INCOME_CATEGORIES.map((c) => ({
      household_id: householdId,
      name: c.name,
      symbol: c.symbol,
      color: c.color,
      is_default: true,
      type: "income" as const,
    }))
  );

  // 4. Insert the 3 default wallets — the existing trigger doesn't
  //    seed wallets, so this is a fresh insert. One is_default=true
  //    so the Add Transaction sheet preselects it.
  await supabase.from("wallets").insert(
    DEFAULT_WALLETS.map((w) => ({
      household_id: householdId,
      name: w.name,
      symbol: w.symbol,
      color: w.color,
      initial_balance: 0,
      is_default: w.is_default ?? false,
    }))
  );
}

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string).trim();
  const username = (formData.get("username") as string).trim().toLowerCase();
  const avatar_color = formData.get("avatar_color") as string;
  const initials = (formData.get("initials") as string).trim().slice(0, 2);
  // gender + birth_date are optional in Edit Profile (added v1.33.0).
  // Missing form fields = "don't change" (we omit from the UPDATE
  // payload entirely so the column keeps its current value).
  const genderRaw = (formData.get("gender") as string | null)?.trim() ?? "";
  const birthDate = (formData.get("birth_date") as string | null)?.trim() ?? "";

  if (!name) return { error: "Name is required." };
  if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only." };
  }
  if (genderRaw && !VALID_GENDERS.includes(genderRaw as (typeof VALID_GENDERS)[number])) {
    return { error: "Invalid gender option." };
  }
  if (birthDate) {
    const d = new Date(birthDate);
    if (Number.isNaN(d.getTime())) return { error: "Invalid date of birth." };
    const now = new Date();
    const minBirth = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    const maxBirth = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
    if (d < minBirth || d > maxBirth) {
      return { error: "You must be 13 or older." };
    }
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

  // Build the UPDATE payload conditionally so unset optional fields
  // don't overwrite existing values with empty strings / null.
  const updates: {
    name: string;
    username: string | null;
    avatar_color: string;
    initials: string;
    gender?: string;
    birth_date?: string;
  } = { name, username: username || null, avatar_color, initials };
  if (genderRaw) updates.gender = genderRaw;
  if (birthDate) updates.birth_date = birthDate;

  const { error: profileError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return {};
}

/**
 * Update the password while the user is already signed in. Lives at
 * /settings/security in the UI (v1.33.0). No "current password"
 * confirmation per the design decision — we accept the friction
 * trade-off in exchange for a cleaner form.
 *
 * Supabase rejects updateUser({ password }) for users whose only auth
 * identity is OAuth (no email/password set up). The /settings/security
 * page hides the form for those users so we never reach this branch.
 */
export async function updatePassword(
  newPassword: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const next = (newPassword ?? "").trim();
  if (next.length < 8) return { error: "Password must be at least 8 characters." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return {};
}

/**
 * Step 1 of the forgot-password flow on /login/forgot (v1.33.0).
 * Sends a Supabase password-recovery email. The email contains both
 * a magic link AND a 6-digit token; the next step in our flow uses
 * the token via `verifyPasswordResetOtp`.
 *
 * Supabase rate-limits this server-side — surface the error verbatim.
 * We always say "if the email exists, we sent a code" to avoid
 * enumerating registered emails.
 */
export async function sendPasswordResetOtp(
  email: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const trimmed = (email ?? "").trim();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email." };
  // We don't pass redirectTo — the user will type the code into our
  // /login/forgot OTP step instead of clicking the link.
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
  if (error) return { error: error.message };
  return {};
}

/**
 * Step 2 of the forgot-password flow — verify the 6-digit code the
 * user just typed. On success Supabase returns a fresh session
 * (cookies are written automatically by the SSR client), so step 3
 * can call `supabase.auth.updateUser({ password })` against that
 * session.
 */
export async function verifyPasswordResetOtp(
  email: string,
  token: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const trimmedEmail = (email ?? "").trim();
  const trimmedToken = (token ?? "").trim();
  if (!trimmedEmail || !trimmedToken) return { error: "Enter the code from your email." };
  if (!/^\d{4,8}$/.test(trimmedToken)) return { error: "Code should be all digits." };

  // `type: 'recovery'` is the recovery-email branch of verifyOtp,
  // distinct from the 'signup' type used in the signup OTP flow.
  const { error } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: "recovery",
  });
  if (error) return { error: error.message };
  return {};
}

// ── Change-email flow (v1.37.0) ──────────────────────────────────────
//
// Two-step in-app flow:
//   1. `requestEmailChange(newEmail)` calls `supabase.auth.updateUser
//      ({ email: newEmail })`. Supabase sends a confirmation email to
//      the NEW address containing a 6-digit token. The PROFILE'S email
//      is NOT updated yet — only auth.users gets a pending email.
//   2. `verifyEmailChangeOtp(newEmail, token)` confirms ownership via
//      `verifyOtp({ type: 'email_change' })`. Supabase rotates the
//      session and updates `auth.users.email`. We then mirror it onto
//      `public.profiles.email` so the rest of the app (display, RLS
//      that reads profile.email) stays consistent.
//
// Note on Supabase project setting: with "Secure email change" ON
// (default), Supabase ALSO requires the OLD email to be confirmed via
// the magic link in its own message. That second confirmation has to
// happen in the OLD inbox; we surface a hint to the user about it
// after step 2 so they know to check. If you toggle Secure email
// change OFF in Authentication → Email, one OTP is sufficient.

export async function requestEmailChange(
  newEmail: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = (newEmail ?? "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return { error: "Enter a valid email." };
  if (trimmed === (user.email ?? "").toLowerCase()) {
    return { error: "That's already your current email." };
  }

  // updateUser triggers Supabase's email-change email. We deliberately
  // don't pass emailRedirectTo — the user will type the 6-digit code
  // into our inline OTP step, not click a link.
  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) return { error: error.message };
  return {};
}

export async function verifyEmailChangeOtp(
  newEmail: string,
  token: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const trimmedEmail = (newEmail ?? "").trim().toLowerCase();
  const trimmedToken = (token ?? "").trim();
  if (!trimmedEmail || !trimmedToken) return { error: "Enter the code from your email." };
  if (!/^\d{4,8}$/.test(trimmedToken)) return { error: "Code should be all digits." };

  // `type: 'email_change'` is the branch of verifyOtp for the new-
  // email confirmation flow. On success Supabase rotates the session
  // and `auth.users.email` is updated. We then mirror to profiles.
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: "email_change",
  });
  if (verifyErr) return { error: verifyErr.message };

  // Mirror the new email onto profiles.email — without this the
  // Settings header / Edit Profile would keep showing the old value
  // until the next session refresh. We're authenticated as the user
  // who just verified, so RLS allows the update.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ email: trimmedEmail }).eq("id", user.id);
    revalidatePath("/settings");
    revalidatePath("/settings/edit-profile");
  }
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
