// Security settings page (v1.33.0).
//
// Currently houses the password-change form; future home for 2FA,
// connected accounts, etc. Lives under Settings → Account.
//
// We detect whether the user has an email/password identity (vs.
// Google-only) server-side and pass it through — Google-only users
// see the page but the password section is hidden, since
// supabase.auth.updateUser({ password }) would reject them.

import { requireSession } from "@/lib/auth/session";
import SecurityShell from "@/components/security-shell";

export default async function SecurityPage() {
  const { user } = await requireSession();

  // user.identities is populated by supabase.auth.getUser() — each
  // identity row has a `provider` field ('email', 'google', etc).
  // A user signed up via email always has an 'email' identity.
  // OAuth-only users won't have one.
  const hasEmailPassword =
    Array.isArray(user.identities) &&
    user.identities.some((i) => i.provider === "email");

  return <SecurityShell hasEmailPassword={hasEmailPassword} email={user.email ?? ""} />;
}
