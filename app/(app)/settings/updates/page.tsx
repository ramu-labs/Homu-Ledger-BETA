// Version Updates page — what users see (plain-language release notes).
//
// v1.29.0 rename: was "Updates" with developer-tab inside; now this
// route is user-only. Developers see the same thing here (matches what
// the userbase sees) and have a separate /settings/dev-changelog route
// in the Developer group for the technical breakdown.

import { requireSession } from "@/lib/auth/session";
import { getServerT } from "@/lib/i18n/server";
import UpdatesShell from "@/components/updates-shell";

export default async function UpdatesPage() {
  // Auth-gated like every other (app) route. We don't need the
  // profile here, but requireSession keeps the auth check consistent.
  await requireSession();
  const { t } = await getServerT();
  return <UpdatesShell view="user" title={t("settings.updates")} />;
}
