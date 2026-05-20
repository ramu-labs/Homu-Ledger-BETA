---
id: health-security-d2007636a2
title: deleteFeedback server action has no authentication check
status: backlog
priority: P0
assignee: unassigned
project: homu-ledger-beta
labels:
  - Health check
  - Critical
  - Security
created_at: 2026-05-20T19:13:58.131Z
updated_at: 2026-05-20T19:13:58.131Z
---

**Source:** Security · OWASP A01 (Broken Access Control) / Missing Authentication
**File:** `app/actions/feedback.ts:91`
**Severity:** critical

## Description

The `deleteFeedback` server action permanently deletes any row from the `feedback` table **without authenticating the caller**. No call to `auth.getUser()` is made:

```typescript
export async function deleteFeedback(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  return {};
}
```

Next.js server actions provide CSRF protection against browser-based cross-site forgery, but the function is accessible to any client that can POST to the Next.js action endpoint. Any unauthenticated (or authenticated but non-admin) user can permanently delete any feedback ticket by ID.

## Risk

- Permanently destroys user-reported feedback (bugs, feature requests, questions).
- Data loss is irreversible without a database backup.
- An attacker can systematically wipe all feedback, eliminating the support queue.

## Recommended Fix

Add authentication and developer-role authorization before deleting:

```typescript
export async function deleteFeedback(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles").select("is_developer").eq("id", user.id).single();
  if (!profile?.is_developer) return { error: "Not authorized" };

  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  return {};
}
```
