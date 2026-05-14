import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupForm from "./setup-form";

/**
 * Username + (optional) promo setup page shown to users who just signed in
 * via Google OAuth and don't have a profile.username yet. The auth callback
 * route routes them here automatically.
 *
 * Server component: auth-gates and pre-fills the form with whatever the
 * trigger / Google metadata already populated (name from full_name claim).
 */
export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If the user already finished setup, don't show this page again.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.username) {
    redirect("/transactions");
  }

  // Pre-fill the name field if we have anything useful — first from any
  // existing profile row, then from Google's metadata, then from the email
  // local-part. The user can still edit it.
  const initialName =
    profile?.name ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.email ? user.email.split("@")[0] : "");

  return <SetupForm initialName={initialName} email={user.email ?? ""} />;
}
