// Server wrapper. Reads is_developer so the client shell can decide
// whether to show the Developer tab (we'd rather not flash it for a
// split-second on hydration, hence the server-side gate).
//
// The actual rendering — tab switcher, audience filtering, change
// list — lives in components/updates-shell.tsx so it can be a Client
// Component (useState for the active tab).

import { requireSession } from "@/lib/auth/session";
import UpdatesShell from "@/components/updates-shell";

export default async function UpdatesPage() {
  const { profile } = await requireSession();
  return <UpdatesShell showDevTab={!!profile?.is_developer} />;
}
