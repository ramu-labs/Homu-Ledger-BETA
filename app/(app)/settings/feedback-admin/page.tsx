import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FeedbackAdminShell from "@/components/feedback-admin-shell";
import type { DbFeedback } from "@/lib/types";

export default async function FeedbackAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_developer")
    .eq("id", user.id)
    .single();

  if (!profile?.is_developer) redirect("/settings");

  const { data: feedbackRaw } = await supabase
    .from("feedback")
    .select("id, created_at, created_by, household_id, subject, body, category, status, attachments, reply, replied_at, replied_by")
    .order("created_at", { ascending: false });

  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, name, initials, avatar_color");

  const profilesMap = new Map<string, { id: string; name: string; initials: string; avatar_color: string }>();
  for (const p of profilesRaw ?? []) {
    profilesMap.set(p.id, p);
  }

  const tickets: DbFeedback[] = (feedbackRaw ?? []) as DbFeedback[];

  return (
    <FeedbackAdminShell
      tickets={tickets}
      profilesById={Object.fromEntries(profilesMap)}
    />
  );
}
