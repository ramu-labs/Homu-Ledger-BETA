import { NextResponse } from "next/server";

// Kill-switch for the production service worker.
//
// If we ever ship a broken sw.js — one that, say, returns the wrong cached
// HTML for /transactions or never lets a fetch reach the network — users
// can be stuck on the broken version forever (the SW is in front of every
// request, including the request for the next sw.js). This endpoint is
// the escape hatch: the registrar fetches it on every page load and, if
// `kill === true`, unregisters all SWs and wipes caches before reloading.
//
// To activate: set NEXT_PUBLIC_SW_KILL=1 in Vercel (Production env), redeploy.
// To recover: unset the var, redeploy.
//
// `dynamic = force-dynamic` makes sure Vercel's edge cache never holds the
// response (otherwise flipping the switch wouldn't take effect for users
// whose CDN edge has a stale answer).

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const kill = process.env.NEXT_PUBLIC_SW_KILL === "1";
  return NextResponse.json(
    { kill },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
