// Signed-in Devices page.
//
// Server wrapper: pulls the user's sessions via the SECURITY DEFINER
// list_user_sessions() RPC, parses each user_agent into a friendly
// label, hands the array off to the client shell. The shell handles
// the two-step Sign-out → Delete flow per row.
//
// Why a server wrapper (vs. fetching on the client): the session list
// includes which row is the CURRENT device, which we determine from
// auth.jwt() server-side. Doing this client-side would require an
// extra round-trip and a flicker on mount.

import { requireSession } from "@/lib/auth/session";
import DevicesShell from "@/components/devices-shell";
import { parseUserAgent } from "@/lib/user-agent";

export type DeviceRow = {
  id: string;
  label: string;
  glyph: string;
  createdAt: string;
  refreshedAt: string | null;
  isCurrent: boolean;
  isSignedOut: boolean;
  // Show truncated raw UA in the dev tooltip so we can debug a
  // mis-parsed device without round-tripping to SQL.
  rawUserAgent: string;
};

export default async function DevicesPage() {
  const { supabase } = await requireSession();

  const { data: rows } = await supabase.rpc("list_user_sessions");

  const devices: DeviceRow[] = (rows ?? []).map((r) => {
    const parsed = parseUserAgent(r.user_agent);
    return {
      id: String(r.id),
      label: parsed.label,
      glyph: parsed.glyph,
      // RPC returns refreshed_at as a `timestamp` (no zone). Cast back
      // to ISO so the client can format it; null when the session has
      // never refreshed (cold sign-in that hasn't aged into a refresh).
      createdAt: String(r.created_at),
      refreshedAt: r.refreshed_at ? String(r.refreshed_at) : null,
      isCurrent: !!r.is_current,
      isSignedOut: !!r.is_signed_out,
      rawUserAgent: r.user_agent ?? "",
    };
  });

  return <DevicesShell devices={devices} />;
}
