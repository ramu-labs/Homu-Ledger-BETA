// Supabase OAuth callback handler.
//
// Flow:
//   1. User taps "Continue with Google" on /login or /signup.
//   2. supabase.auth.signInWithOAuth() opens the Google consent screen
//      and after consent Supabase redirects back here with ?code=<token>.
//   3. We exchange the code for a session, then decide where to send the
//      user based on their profile state:
//        - no profiles row OR username is null  → /auth/setup
//        - has username but no household        → /onboarding
//        - has both                              → /transactions

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  // Google or the user cancelled — Supabase forwards the error here.
  if (errorParam) {
    const desc = searchParams.get("error_description") ?? errorParam;
    return NextResponse.redirect(
      `${origin}/login?oauth_error=${encodeURIComponent(desc)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?oauth_error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Session is set. Look up the profile to decide where to send the user.
  // The auth-side `handle_new_user` trigger may have already created a
  // profile row with the user's id (and name from raw_user_meta_data if
  // present), but for a brand-new Google sign-up there's no username yet.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, household_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.username) {
    return NextResponse.redirect(`${origin}/auth/setup`);
  }
  if (!profile.household_id) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }
  return NextResponse.redirect(`${origin}/transactions`);
}
