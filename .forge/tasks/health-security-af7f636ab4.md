---
id: health-security-af7f636ab4
title: cancelInvitation deletes by ID with no caller ownership check
status: backlog
priority: P2
assignee: unassigned
project: homu-ledger-beta
labels:
  - Health check
  - Warning
  - Security
created_at: 2026-05-20T19:13:36.478Z
updated_at: 2026-05-20T19:13:36.478Z
---

**Source:** Security · OWASP A01 (Broken Access Control)
**File:** `app/actions/invitations.ts:132`
**Severity:** warning

## Description

The `cancelInvitation` server action deletes a `household_invitations` row filtered only by `invitationId`, without verifying that the authenticated user is the inviter (`invited_by`) or a household owner:

```typescript
export async function cancelInvitation(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("household_invitations")
    .delete()
    .eq("id", invitationId); // ← no ownership check
}
```

Contrast with `declineInvitation` (line 102), which correctly validates `invite.invited_user_id === user.id`. Any authenticated user who discovers a valid `invitationId` UUID can cancel any pending invitation in any household. Exploitability depends on whether the Supabase RLS `DELETE` policy on `household_invitations` restricts deletions to the `invited_by` user or household owner.

## Recommended Fix

Verify ownership before deleting:

```typescript
const { data: invite } = await supabase
  .from("household_invitations")
  .select("id, invited_by, household_id, status")
  .eq("id", invitationId)
  .single();

if (!invite) return { error: "Invitation not found" };
if (invite.status !== "pending") return { error: "Invitation is no longer pending" };

if (invite.invited_by !== user.id) {
  const { data: membership } = await supabase
    .from("household_members").select("role")
    .eq("household_id", invite.household_id)
    .eq("profile_id", user.id).eq("role", "owner").maybeSingle();
  if (!membership) return { error: "Not authorized" };
}
```

Also audit the RLS `DELETE` policy on `household_invitations` to enforce the same constraint at the DB level.
