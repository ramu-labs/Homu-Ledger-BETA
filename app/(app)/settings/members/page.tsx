import { redirect } from "next/navigation";
import { ChevronLeft, Crown } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InviteMemberForm from "@/components/invite-member-form";
import CancelInviteButton from "@/components/cancel-invite-button";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, household_id")
    .eq("id", user.id)
    .single();

  const { data: household } = profile?.household_id
    ? await supabase
        .from("households")
        .select("id, name, owner_id")
        .eq("id", profile.household_id)
        .single()
    : { data: null };

  if (!household) redirect("/settings");

  // The `household_members` table stores the join timestamp under
  // `joined_at`, NOT `created_at`. Selecting / ordering by `created_at`
  // here used to make Supabase silently return zero rows — which is why
  // the M&D ledger's Members page rendered as an empty container even
  // though Marcel and Della were both in the table.
  const { data: memberRows } = await supabase
    .from("household_members")
    .select("joined_at, profile:profiles(id, name, initials, avatar_color)")
    .eq("household_id", household.id)
    .order("joined_at", { ascending: true });

  const members = (memberRows ?? [])
    .map((row: any) => {
      const p = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return p ? { ...p, joined_at: row.joined_at } : null;
    })
    .filter(Boolean);

  const { data: pending } = await supabase
    .from("household_invitations")
    .select("id, created_at, invited_user:profiles!household_invitations_invited_user_id_fkey(id, name, initials, avatar_color)")
    .eq("household_id", household.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const pendingInvitations = (pending ?? []).map((p: any) => ({
    id: p.id,
    created_at: p.created_at,
    invited_user: Array.isArray(p.invited_user) ? p.invited_user[0] : p.invited_user,
  })).filter((p: any) => p.invited_user);

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[var(--background)]/95 px-5 pt-4 pb-2 backdrop-blur">
        <Link
          href="/settings"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03)] active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-[20px] w-[20px]" strokeWidth={2.25} />
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">Members</h1>
        <div className="h-9 w-9" />
      </header>

      {/* Invite form */}
      <section className="mt-4 px-5">
        <InviteMemberForm />
      </section>

      {/* Members + pending invitations (single list) */}
      <p className="mb-2 mt-6 px-6 text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
        Members of {household.name}
      </p>

      <div className="mx-5 overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-black/[0.04]">
        {(members ?? []).map((m: any) => {
          const isOwner = m.id === household.owner_id;
          const isMe = m.id === user.id;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 border-b border-[var(--separator)] px-4 py-3.5 last:border-0"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
                style={{ backgroundColor: m.avatar_color }}
              >
                {m.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--foreground)]">
                  {m.name}
                  {isMe && (
                    <span className="ml-1.5 text-[12px] text-[var(--label-tertiary)]">(you)</span>
                  )}
                </p>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ backgroundColor: isOwner ? "#fef3c7" : "#f3f4f6" }}
              >
                {isOwner && <Crown className="h-3 w-3 text-amber-600" strokeWidth={2.25} />}
                <span className={`text-[11px] font-semibold ${isOwner ? "text-amber-700" : "text-[var(--label-secondary)]"}`}>
                  {isOwner ? "Owner" : "Member"}
                </span>
              </div>
            </div>
          );
        })}

        {/* Pending invitations — same row style with a "Pending" badge */}
        {pendingInvitations.map((inv: any) => (
          <div
            key={inv.id}
            className="flex items-center gap-3 border-t border-[var(--separator)] px-4 py-3.5"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white opacity-60"
              style={{ backgroundColor: inv.invited_user.avatar_color }}
            >
              {inv.invited_user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-[var(--label-secondary)]">
                {inv.invited_user.name}
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              Pending
            </span>
            <CancelInviteButton invitationId={inv.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
