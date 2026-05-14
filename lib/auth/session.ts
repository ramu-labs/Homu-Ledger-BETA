// Per-request session helper, memoised via React.cache() so the layout,
// every page in the tree, and lib/i18n/server.ts all share a SINGLE
// auth.getUser() round-trip and a SINGLE profiles SELECT per render.
//
// Why this exists
// ─────────────────
// Before v1.18.1, the (app) layout and each page were independently calling
// supabase.auth.getUser(). When the access token was near expiry, Supabase's
// SSR client refreshes during the FIRST call (rotating the refresh token
// server-side) and tries to write the new cookies back. In a React Server
// Component cookie writes are silently swallowed by lib/supabase/server.ts's
// try/catch. The SECOND call then sends the now-invalidated refresh token —
// Supabase returns user: null — and the next navigation redirects to /login.
//
// v1.18.1 fixed the layout-side instance only. v1.23.0 extends the fix
// across every authenticated page by routing all of them through this
// cache. React.cache() dedupes for the lifetime of one server request, so
// concurrent or sequential calls from layout / page / actions all resolve
// to the same Promise.
//
// Note: server actions run in their own request (not part of the page
// render tree). The cache doesn't span across them — actions still do
// their own auth.getUser() exactly once, which is correct.

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SessionProfile = {
  id: string;
  name: string | null;
  initials: string | null;
  avatar_color: string | null;
  household_id: string | null;
  language: "en" | "id" | null;
  icon_style: "2d" | "3d" | null;
  is_developer: boolean | null;
  subscription_tier:
    | "3_months"
    | "6_months"
    | "1_year"
    | "lifetime"
    | "developer"
    | null;
  subscription_expires_at: string | null;
  email: string | null;
  username: string | null;
};

export type Session =
  | { supabase: SupabaseServerClient; user: User; profile: SessionProfile | null }
  | { supabase: SupabaseServerClient; user: null; profile: null };

/**
 * Memoised per-request session lookup. First call hits Supabase auth + the
 * profiles table; subsequent calls in the same request return the cached
 * Promise. Returns user: null when there's no session.
 */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, name, initials, avatar_color, household_id, language, icon_style, is_developer, subscription_tier, subscription_expires_at, email, username"
    )
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    profile: (profile ?? null) as SessionProfile | null,
  };
});

/**
 * Convenience wrapper that redirects to /login if there's no session.
 * Returns a Session with non-null `user`. Use this in pages that require
 * auth (i.e. all of /(app)/*).
 */
export async function requireSession(): Promise<{
  supabase: SupabaseServerClient;
  user: User;
  profile: SessionProfile | null;
}> {
  const session = await getSession();
  if (!session.user) redirect("/login");
  return session;
}
