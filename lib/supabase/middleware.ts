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

  // Use getSession() — reads cookie locally, no network round-trip.
  // Pages call getUser() themselves for authoritative checks.
  const { data: { session } } = await supabase.auth.getSession();
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
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    return response;
  }

  if (!session && !isPublic && !isAuthPassthrough) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isPublic) {
    return NextResponse.redirect(new URL("/transactions", request.url));
  }

  return response;
}
