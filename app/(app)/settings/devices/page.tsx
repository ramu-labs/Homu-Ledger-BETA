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
  // Friendly nickname the user can set per device (v1.31.0). Empty
  // string when not set — the UI falls back to `label` (the parsed
  // user-agent string) in that case.
  nickname: string;
  // Auto-parsed label from the UA — "iPhone · Safari", "Mac · Chrome".
  // Always shown either as the primary line (no nickname) or as a
  // small subtitle under the nickname.
  label: string;
  glyph: string;
  createdAt: string;
  refreshedAt: string | null;
  isCurrent: boolean;
  isSignedOut: boolean;
  rawUserAgent: string;
};

export default async function DevicesPage() {
  const { supabase } = await requireSession();

  const { data: rows } = await supabase.rpc("list_user_sessions");

  const devices: DeviceRow[] = (rows ?? []).map((r) => {
    const parsed = parseUserAgent(r.user_agent);
    return {
      id: String(r.id),
      nickname: r.nickname ?? "",
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
