import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import EditProfileShell from "@/components/edit-profile-shell";

export default async function EditProfilePage() {
  const { user, profile } = await requireSession();
  if (!profile) redirect("/login");

  return (
    <EditProfileShell
      profile={{
        name: profile.name ?? "",
        username: profile.username ?? null,
        initials: profile.initials ?? "",
        avatar_color: profile.avatar_color ?? "#f97316",
        email: profile.email ?? user.email ?? "",
      }}
    />
  );
}
