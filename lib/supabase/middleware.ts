import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that are accessible without a session.
const PUBLIC_ROUTES = ["/login", "/signup", "/privacy"];

// /auth/callback — Supabase posts here mid-OAuth flow with ?code=… and
// it MUST be reachable both without a session (we're about to create one)
// and without auto-redirecting an existing session away (e.g. linking a
// second account). Treated as fully neutral by the middleware.
//
// /auth/setup — username + optional promo form for users who just OAuthed
// in but don't have a profile.username yet. Requires a session, but should
// NOT be auto-redirected to /transactions even though that's normally what
// we'd do for a signed-in user on a "public" route.
const AUTH_PASSTHROUGH = ["/auth/callback", "/auth/setup"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // v1.31.0 — switched from getSession() to getUser().
  //
  // Why this matters: getSession() only DECODES the JWT in the cookie.
  // It doesn't ask Supabase whether the session is still valid. When a
  // session is revoked elsewhere (Devices page → Sign out, or a global
  // sign-out from another device), the cookie's JWT remains decodable
  // for up to its expiry (~1h), so getSession() returns it as
  // "logged in". The page-level requireSession() then calls getUser()
  // which actually validates with Supabase → null → redirect to /login.
  // Middleware then redirects /login → /transactions because cookie
  // "still has a session". Infinite redirect → "Load cannot follow
  // more than 20 redirections" in Safari.
  //
  // getUser() pays one round-trip per request (~50–100ms in our
  // region) but it's the only correct check. Without it, revoked
  // tokens can't be detected until they naturally expire, leaving
  // users stuck in the loop above.
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
  const isAuthPassthrough = AUTH_PASSTHROUGH.some((r) => pathname.startsWith(r));

  // /auth/callback runs the OAuth code exchange — let it through regardless
  // of session state, and crucially don't redirect a session-holder away.
  if (pathname.startsWith("/auth/callback")) {
    return response;
  }

  // /auth/setup requires a session (you can't pick a username if you're
  // not signed in) but doesn't get the "signed-in user gets bounced to
  // /transactions" treatment that PUBLIC_ROUTES get.
  if (pathname.startsWith("/auth/setup")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    return response;
  }

  if (!user && !isPublic && !isAuthPassthrough) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isPublic) {
    return NextResponse.redirect(new URL("/transactions", request.url));
  }

  return response;
}
