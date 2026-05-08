"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Invite a user to the current household by email or username.
 * Looks up the existing profile and creates a pending invitation.
 */
export async function inviteMember(emailOrUsername: string): Promise<{ error?: string; success?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = emailOrUsername.trim();
  if (!trimmed) return { error: "Email or username required" };

  // Get current household
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { error: "No active ledger" };

  // Resolve invitee via SECURITY DEFINER RPC (RLS on profiles only allows reading
  // same-household members, so a direct query can't find users outside the ledger)
  const isEmail = trimmed.includes("@");
  const { data: rpcRows, error: lookupError } = await supabase
    .rpc("lookup_user_for_invite", { p_query: trimmed });

  if (lookupError) return { error: lookupError.message };

  const invitee = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!invitee) {
    return { error: `No user found with that ${isEmail ? "email" : "username"}.` };
  }

  if (invitee.id === user.id) {
    return { error: "You can't invite yourself." };
  }

  // Already a member?
  const { data: existingMember } = await supabase
    .from("household_members")
    .select("profile_id")
    .eq("household_id", profile.household_id)
    .eq("profile_id", invitee.id)
    .maybeSingle();

  if (existingMember) return { error: `${invitee.name} is already a member.` };

  // Pending invite already?
  const { data: existingInvite } = await supabase
    .from("household_invitations")
    .select("id")
    .eq("household_id", profile.household_id)
    .eq("invited_user_id", invitee.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvite) return { error: `${invitee.name} already has a pending invitation.` };

  const { error } = await supabase.from("household_invitations").insert({
    household_id: profile.household_id,
    invited_by: user.id,
    invited_user_id: invitee.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/members");
  return { success: `Invitation sent to ${invitee.name}.` };
}

/**
 * Accept a pending invitation. Adds the user to household_members and switches them in.
 */
export async function acceptInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: invite } = await supabase
    .from("household_invitations")
    .select("id, household_id, invited_by, invited_user_id, status")
    .eq("id", invitationId)
    .single();

  if (!invite) return { error: "Invitation not found" };
  if (invite.invited_user_id !== user.id) return { error: "Not your invitation" };
  if (invite.status !== "pending") return { error: "Invitation is no longer pending" };

  // Verify the inviter is STILL a member of the household at accept time.
  // Without this, a removed member's stale pending invites would still grant
  // access to their old ledger.
  const { data: inviterMembership } = await supabase
    .from("household_members")
    .select("profile_id")
    .eq("household_id", invite.household_id)
    .eq("profile_id", invite.invited_by)
    .maybeSingle();
  if (!inviterMembership) {
    // Auto-decline so the now-invalid invite stops appearing in the
    // recipient's pending list. (The status CHECK constraint allows
    // pending/accepted/declined; 'declined' fits closest semantically.)
    await supabase
      .from("household_invitations")
      .update({ status: "declined" })
      .eq("id", invitationId);
    return { error: "This invitation is no longer valid — the inviter is no longer a member of that ledger." };
  }

  // Add to household_members
  const { error: memberError } = await supabase
    .from("household_members")
    .upsert({ household_id: invite.household_id, profile_id: user.id, role: "member" });

  if (memberError) return { error: memberError.message };

  // Mark invitation accepted
  await supabase
    .from("household_invitations")
    .update({ status: "accepted" })
    .eq("id", invitationId);

  // Switch the user into the new ledger
  await supabase
    .from("profiles")
    .update({ household_id: invite.household_id })
    .eq("id", user.id);

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings");
  revalidatePath("/settings/members");
  return {};
}

/**
 * Decline a pending invitation.
 */
export async function declineInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: invite } = await supabase
    .from("household_invitations")
    .select("id, invited_user_id, status")
    .eq("id", invitationId)
    .single();

  if (!invite) return { error: "Invitation not found" };
  if (invite.invited_user_id !== user.id) return { error: "Not your invitation" };
  if (invite.status !== "pending") return { error: "Invitation is no longer pending" };

  const { error } = await supabase
    .from("household_invitations")
    .update({ status: "declined" })
    .eq("id", invitationId);

  if (error) return { error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/settings/members");
  return {};
}

/**
 * Cancel a pending invitation (inviter or household owner).
 */
export async function cancelInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("household_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) return { error: error.message };

  revalidatePath("/settings/members");
  return {};
}

/**
 * Join a ledger using its 6-character invite code.
 * Mirrors the join flow from auth.ts but for already-authenticated users in the app.
 */
export async function joinLedgerByCode(code: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { error: "Invite code required" };

  const { data: lookupRows, error: lookupError } = await supabase
    .rpc("lookup_household_by_invite_code", { p_code: trimmed });
  const household = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows;

  if (lookupError || !household) return { error: "Invalid invite code." };

  await supabase
    .from("household_members")
    .upsert({ household_id: household.id, profile_id: user.id, role: "member" });

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ household_id: household.id })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/settings");
  return {};
}
