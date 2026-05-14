// Lightweight diagnostic endpoint for the "random logout" investigation.
//
// The client posts to this route when the user lands on /login from an
// authenticated path (i.e. they got bounced unexpectedly — not from a
// manual sign-out). We just log to console so the breadcrumbs show up
// in Vercel's runtime logs, where we can search by user agent + path
// to spot patterns (e.g. always after >1h idle, always PWA standalone,
// always after re-opening the app, etc).
//
// Deliberately no DB writes — we don't have enough signal yet to design
// a schema, and a console log is enough to confirm or refute hypotheses.
// Promote to a proper table only if we hit a high false-positive rate
// in the logs.

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "edge";

type Payload = {
  // The page the user was on before getting bounced to /login.
  fromPath?: string;
  // Whether the browser thinks the PWA is installed (standalone).
  // iOS Safari PWAs have separate cookie storage from the browser
  // tab — historically the source of mysterious logouts.
  isStandalone?: boolean;
  // How long the app was hidden (page-visibility hidden → visible),
  // or null if not measured. A multi-hour gap suggests session
  // expiry; a sub-minute gap suggests a mid-session race.
  hiddenMs?: number | null;
  // Free-form note from the client (e.g. "service worker activated").
  note?: string;
};

export async function POST(request: NextRequest) {
  let payload: Payload | null = null;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    // Body wasn't JSON — that's fine, just log the headers.
  }

  const ua = request.headers.get("user-agent") ?? "unknown";
  const referer = request.headers.get("referer") ?? "none";
  // Keep this single-line + stable-keyed so we can grep / chart it.
  // Prefix makes it easy to spot in a busy log stream.
  console.log(
    "[auth-log]",
    JSON.stringify({
      ts: new Date().toISOString(),
      fromPath: payload?.fromPath ?? null,
      isStandalone: payload?.isStandalone ?? null,
      hiddenMs: payload?.hiddenMs ?? null,
      note: payload?.note ?? null,
      referer,
      ua,
    })
  );

  // Always 204 — the client doesn't react to the response, and any
  // error here would only confuse the user (they're already mid-bounce).
  return new NextResponse(null, { status: 204 });
}
