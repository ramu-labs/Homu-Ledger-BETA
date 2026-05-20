---
id: "ram-9"
title: "Push notifications — recurring due, budget warnings, daily log nudge"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Offline & Sync"
  - "Feature"
linear_id: "RAM-9"
linear_url: "https://linear.app/ramulabs/issue/RAM-9/push-notifications-recurring-due-budget-warnings-daily-log"
created_at: "2026-05-16T01:09:14.430Z"
updated_at: "2026-05-16T01:57:11.463Z"
---

Opt-in push notifications: a recurring item is due, a budget hit its threshold, a gentle "you haven't logged today" nudge.

**Why:** The service worker already exists. Notifications turn HOMU from a passive log into something that keeps the household on track.

**Dev notes:** needs Web Push (VAPID keys), a subscriptions table, a scheduled trigger for the recurring/budget checks. Pairs naturally with the Budgets issue. Per-type opt-in toggles in Settings.
