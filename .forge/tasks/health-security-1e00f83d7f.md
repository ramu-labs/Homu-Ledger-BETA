---
id: health-security-1e00f83d7f
title: replyToFeedback server action allows non-developer users to post admin replies
status: backlog
priority: P2
assignee: unassigned
project: homu-ledger-beta
labels:
  - Health check
  - Warning
  - Security
created_at: 2026-05-20T19:14:08.372Z
updated_at: 2026-05-20T19:14:08.372Z
---

**Source:** Security · OWASP A01 (Broken Access Control) / Missing Authorization
**File:** `app/actions/feedback.ts:72`
**Severity:** warning

## Description

The `replyToFeedback` server action correctly authenticates the caller but **does not verify that the caller has a developer role**. Any authenticated user can post a reply to any feedback ticket on behalf of the development team:

```typescript
export async function replyToFeedback(id: string, reply: string): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  // ← no is_developer check

  const { error } = await supabase.from("feedback")
    .update({ reply: trimmed, replied_at: ..., replied_by: user.id })
    .eq("id", id);
  ...
}
```

The admin UI at `/settings/feedback-admin` gates access client-side on `is_developer`, but server actions are callable directly, bypassing UI-level guards.

## Risk

- A non-developer authenticated user can impersonate support staff by replying to any ticket.
- `replied_by` will be set to the attacker's `user.id`, which could mislead the support team.

## Recommended Fix

Add a role check before updating:

```typescript
const { data: profile } = await supabase
  .from("profiles").select("is_developer").eq("id", user.id).single();
if (!profile?.is_developer) return { error: "Not authorized" };
```
