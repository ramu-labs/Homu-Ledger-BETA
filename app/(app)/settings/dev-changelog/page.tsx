// Dev Changelog — technical release notes for developers (v1.29.0).
//
// Separated from /settings/updates so the developer never has to flip
// a tab to see the technical view, and so non-devs literally cannot
// route here (404'd via notFound()).

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getServerT } from "@/lib/i18n/server";
import UpdatesShell from "@/components/updates-shell";

export default async function DevChangelogPage() {
  const { profile } = await requireSession();
  if (!profile?.is_developer) notFound();

  const { t } = await getServerT();
  return <UpdatesShell view="dev" title={t("settings.devChangelog")} />;
}
