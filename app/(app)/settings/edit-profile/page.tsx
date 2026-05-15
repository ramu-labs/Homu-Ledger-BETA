import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import EditProfileShell from "@/components/edit-profile-shell";

export default async function EditProfilePage() {
  const { supabase, user, profile } = await requireSession();
  if (!profile) redirect("/login");

  // gender + birth_date aren't part of the session cache, so pull
  // them with one extra SELECT scoped to this page.
  const { data: extra } = await supabase
    .from("profiles")
    .select("gender, birth_date")
    .eq("id", profile.id)
    .maybeSingle();

  // v1.36.0 — Password change moved INTO Edit Profile (Section 3).
  // For Google-only users (no email/password identity) we hide the
  // password subsection. Detected server-side from user.identities
  // so the page renders the right shape on first paint, no flicker.
  const hasEmailPassword =
    Array.isArray(user.identities) &&
    user.identities.some((i) => i.provider === "email");

  return (
    <EditProfileShell
      profile={{
        name: profile.name ?? "",
        username: profile.username ?? null,
        initials: profile.initials ?? "",
        avatar_color: profile.avatar_color ?? "#f97316",
        email: profile.email ?? user.email ?? "",
        // v1.40.0 — Gender narrowed to Male / Female in the UI. If
        // an existing row stores 'other' or 'prefer_not_to_say'
        // (allowed by the DB constraint, set via the pre-v1.40
        // signup), we treat it as null — neither pill is
        // pre-highlighted but the value remains in the DB until the
        // user picks one. Picking Male or Female overwrites it.
        gender:
          extra?.gender === "male" || extra?.gender === "female"
            ? extra.gender
            : null,
        birth_date: extra?.birth_date ?? null,
      }}
      hasEmailPassword={hasEmailPassword}
    />
  );
}
