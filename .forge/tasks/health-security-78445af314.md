---
id: health-security-78445af314
title: Cursor query params interpolated raw into PostgREST filter string
status: completed
priority: P1
labels:
  - security
  - warning
  - health-check
created_at: 2026-05-20T17:55:00Z
updated_at: 2026-05-20T19:14:12.280Z
---

## Finding

**Source:** Security · OWASP A03 (Injection)  
**File:** `app/api/transactions/route.ts:38`  
**Severity:** warning

## Description

The cursor pagination in `GET /api/transactions` interpolates raw query-string values into the Supabase PostgREST `.or()` filter string:

```typescript
const date = searchParams.get("date");       // user-controlled
const createdAt = searchParams.get("createdAt"); // user-controlled
const id = searchParams.get("id");           // user-controlled

if (date && createdAt && id) {
  query = query.or(
    `date.lt.${date},and(date.eq.${date},created_at.lt.${createdAt}),and(date.eq.${date},created_at.eq.${createdAt},id.lt.${id})`
  );
}
```

PostgREST parses the `.or()` string as a filter expression. If `date` contains a comma or closing parenthesis (e.g. `2026-01-01,amount.gt.0`), additional filter conditions can be injected. Because Supabase RLS is active, an attacker can only affect data within their own household scope — they cannot cross household boundaries. However, they can:
- Bypass the cursor restriction and return rows outside the intended page window
- Inject predicates that expose all of their transactions regardless of the cursor

## Recommended Fix

Validate and sanitize cursor parameters before interpolation. A lightweight approach:

```typescript
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (date && createdAt && id &&
    DATE_RE.test(date) && ISO_RE.test(createdAt) && UUID_RE.test(id)) {
  query = query.or(`date.lt.${date},...`);
}
```

Or switch to `.lt()` / `.gte()` chained column filters using typed parameters, which PostgREST parameterizes safely.

