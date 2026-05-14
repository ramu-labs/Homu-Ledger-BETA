import { getSession } from "@/lib/auth/session";
import { getT, type Lang } from "./dictionaries";

/**
 * Server-side translation helper. Returns the user's language, plus a few
 * profile fields that callers (notably the (app) layout) need so they don't
 * have to refetch.
 *
 * Routed through getSession() (React.cache), so this is FREE if any other
 * code in the same request has already called it — auth.getUser() and the
 * profile SELECT happen exactly once per request, no matter how many places
 * pull from getServerT()/getSession()/requireSession(). See
 * lib/auth/session.ts for why that matters (it closes the SSR cookie-refresh
 * race that kept kicking users to /login).
 */
export async function getServerT() {
  const { profile } = await getSession();
  const lang: Lang = (profile?.language as Lang) ?? "en";
  const isDeveloper = profile?.is_developer === true;
  const username: string | null = profile?.username ?? null;
  const hasHousehold = !!profile?.household_id;
  return { t: getT(lang), lang, isDeveloper, username, hasHousehold };
}
