// API key management — moved here in v1.26.0 from the main /settings/
// ai-admin page so a stray tap on Clear can't wipe the key while you're
// just looking at usage stats.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import AiKeyForm from "@/components/ai-key-form";

export default async function AiKeyPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.is_developer) notFound();

  const { data: keyRow } = await supabase
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "gemini_api_key")
    .maybeSingle();

  const keyConfigured = !!keyRow?.value && keyRow.value.trim().length > 0;
  const keyUpdatedAt = keyConfigured ? keyRow?.updated_at ?? null : null;

  return <AiKeyForm keyConfigured={keyConfigured} keyUpdatedAt={keyUpdatedAt} />;
}
