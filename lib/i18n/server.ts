import { createClient } from "@/lib/supabase/server";
import { getT, type Lang } from "./dictionaries";

/**
 * Server-side translation helper. Reads the current user's language preference
 * from their profile and returns a t() function for that language.
 *
 * Also returns `isDeveloper` because:
 *   - The layout needs it to decide whether to mount the dev feedback
 *     notifier, and
 *   - The profile fetch here is already happening, so adding `is_developer`
 *     to the SELECT costs nothing extra.
 *
 * Doing it this way avoids a second `auth.getUser()` call inside the (app)
 * layout — two getUser() calls in one request can race the Supabase SSR
 * cookie-refresh flow and trigger a "refresh token already used" error
 * (Server Components silently swallow cookie writes), which kicks the user
 * out to /login on the next navigation.
 */
export async function getServerT() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let lang: Lang = "en";
  let isDeveloper = false;
  // `username` is included so callers (notably the (app) layout) can detect
  // Google-OAuth users who haven't completed /auth/setup and bounce them
  // there. Cost is zero (same row, two extra columns).
  let username: string | null = null;
  let hasHousehold = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("language, is_developer, username, household_id")
      .eq("id", user.id)
      .single();
    lang = (profile?.language as Lang) ?? "en";
    isDeveloper = profile?.is_developer === true;
    username = profile?.username ?? null;
    hasHousehold = !!profile?.household_id;
  }
  return { t: getT(lang), lang, isDeveloper, username, hasHousehold };
}
