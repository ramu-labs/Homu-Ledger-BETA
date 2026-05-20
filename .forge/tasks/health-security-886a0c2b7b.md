---
id: health-security-886a0c2b7b
title: Cursor query params interpolated raw into PostgREST filter string
status: backlog
priority: P2
assignee: unassigned
project: homu-ledger-beta
labels:
  - Health check
  - Warning
  - Security
created_at: 2026-05-20T19:13:23.787Z
updated_at: 2026-05-20T19:13:23.787Z
---

**Source:** Security · OWASP A03 (Injection)
**File:** `app/api/transactions/route.ts:45`
**Severity:** warning

## Description

The cursor pagination in `GET /api/transactions` interpolates raw query-string values directly into a PostgREST `.or()` filter string:

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

PostgREST parses the `.or()` string as a filter expression. Injecting a comma or closing parenthesis (e.g. `date=2026-01-01,amount.gt.0`) can add extra filter conditions. Because RLS is active, cross-household data cannot be accessed — but an attacker can bypass the intended cursor restriction and return rows outside the intended page window.

## Recommended Fix

Validate cursor parameters with strict regexes before interpolation:

```typescript
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (date && createdAt && id &&
    DATE_RE.test(date) && ISO_RE.test(createdAt) && UUID_RE.test(id)) {
  query = query.or(`...`);
}
```

Or switch to typed `.lt()` / `.gte()` chained column filters which PostgREST parameterizes safely.
