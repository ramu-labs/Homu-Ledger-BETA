---
id: health-security-7a25785cd9
title: updateFeedbackStatus server action has no authentication check
status: backlog
priority: P0
assignee: unassigned
project: homu-ledger-beta
labels:
  - Health check
  - Critical
  - Security
created_at: 2026-05-20T19:13:49.009Z
updated_at: 2026-05-20T19:13:49.009Z
---

**Source:** Security · OWASP A01 (Broken Access Control) / Missing Authentication
**File:** `app/actions/feedback.ts:61`
**Severity:** critical

## Description

The `updateFeedbackStatus` server action updates any row in the `feedback` table **without authenticating the caller**. No call to `auth.getUser()` is made:

```typescript
export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("feedback")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  return {};
}
```

Next.js server actions provide CSRF protection against browser-based cross-site forgery, but the function is accessible to any client that can POST to the Next.js action endpoint. Any unauthenticated (or authenticated but non-admin) user can change the status of any feedback ticket to any value.

## Risk

- Feedback tickets can be silently closed, re-opened, or marked in-progress by anyone who knows a ticket ID.
- This obscures the real state of user-reported bugs and feature requests.

## Recommended Fix

Add authentication and authorization — only developers (users with `is_developer = true` in their profile) should be able to update feedback status:

```typescript
export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles").select("is_developer").eq("id", user.id).single();
  if (!profile?.is_developer) return { error: "Not authorized" };

  const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/feedback-admin");
  return {};
}
```
