// Voice transactions admin (v1.41.0). Dev-only.
// Two switches in one place: Groq Whisper API key, and the
// voice_input_enabled feature flag.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import VoiceAdminForm from "@/components/voice-admin-form";

export default async function VoiceAdminPage() {
  const { supabase, profile } = await requireSession();
  if (!profile?.is_developer) notFound();

  const [{ data: keyRow }, { data: flagRow }] = await Promise.all([
    supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", "groq_api_key")
      .maybeSingle(),
    supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", "voice_input_enabled")
      .maybeSingle(),
  ]);

  const keyConfigured = !!keyRow?.value && keyRow.value.trim().length > 0;
  const keyUpdatedAt = keyConfigured ? keyRow?.updated_at ?? null : null;
  const flagEnabled = flagRow?.value === "true";

  return (
    <VoiceAdminForm
      keyConfigured={keyConfigured}
      keyUpdatedAt={keyUpdatedAt}
      flagEnabled={flagEnabled}
    />
  );
}
