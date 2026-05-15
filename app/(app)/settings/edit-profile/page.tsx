import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import EditProfileShell from "@/components/edit-profile-shell";

export default async function EditProfilePage() {
  const { supabase, user, profile } = await requireSession();
  if (!profile) redirect("/login");

  // gender + birth_date aren't part of the session cache yet (only
  // the identity fields are), so pull them separately. One extra
  // small SELECT, only on this page.
  const { data: extra } = await supabase
    .from("profiles")
    .select("gender, birth_date")
    .eq("id", profile.id)
    .maybeSingle();

  return (
    <EditProfileShell
      profile={{
        name: profile.name ?? "",
        username: profile.username ?? null,
        initials: profile.initials ?? "",
        avatar_color: profile.avatar_color ?? "#f97316",
        email: profile.email ?? user.email ?? "",
        gender:
          extra?.gender === "male" ||
          extra?.gender === "female" ||
          extra?.gender === "other" ||
          extra?.gender === "prefer_not_to_say"
            ? extra.gender
            : null,
        birth_date: extra?.birth_date ?? null,
      }}
    />
  );
}
