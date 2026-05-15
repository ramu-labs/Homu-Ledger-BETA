import { NextResponse } from "next/server";
import { APP_VERSION, MIN_CLIENT_VERSION } from "@/lib/version";

// Version contract for the offline write-queue.
//
// Two values out:
//   current — what the server was deployed from. Informational; useful for
//             support ("what version are you actually running?")
//   min     — the floor. Clients older than this MUST refresh before the
//             server will trust their writes. Bump this only when a release
//             genuinely breaks older clients (RPC signature change, schema
//             column the old client still writes to, etc.).
//
// Phase 2 leaves min == previous release, so existing clients keep working
// unchanged. Phase 3 (queued writes) will start enforcing the gate.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { current: APP_VERSION, min: MIN_CLIENT_VERSION },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
