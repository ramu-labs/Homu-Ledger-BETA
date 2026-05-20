---
id: "ram-19"
title: "Event-tracking infrastructure — friction-point funnels"
status: "in_progress"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Feature"
linear_id: "RAM-19"
linear_url: "https://linear.app/ramulabs/issue/RAM-19/event-tracking-infrastructure-friction-point-funnels"
started_at: "2026-05-17T15:52:44.766Z"
created_at: "2026-05-17T12:11:28.384Z"
updated_at: "2026-05-17T16:03:49.492Z"
---

Net-new instrumentation to capture UI events for drop-off / funnel analysis. Split out of the Homu Analytics Dashboard PRD (§5.6) — it is **not** a dashboard section, it is its own infrastructure project.

## Why this is separate

The Phase-1 dashboard (RAM-18) reads aggregates off tables that already exist. Event tracking does **not** exist anywhere in HOMU today — migrations 0001–0030 cover transactions, wallets, categories, feedback, sessions, and AI-usage logs, but nothing event-based. Building it means:

* A new `events` table.
* A lightweight client logging helper.
* Instrumentation calls across every tracked surface — sheets, pickers, settings.
* An **offline event queue** — HOMU is offline-first; events fired offline must queue and sync like transactions, or the data skews toward online users.

That is arguably a bigger build than the dashboard itself, which is why it is deferred.

## Scope

* Events table + client logging helper + offline queue (reuse the existing sync-queue pattern).
* Instrument the PRD §5.6 funnels: `transaction_started → completed`, `category_picker_opened → category_selected`, `wallet_view_opened → wallet_action_taken`, `settings_opened → setting_changed`, and `budget_created_started → completed` (post-RAM-5).
* Add a "Friction Points" section to the dashboard (RAM-18): raw event counts + drop-off paths.
* Also enables the deferred "top miscategorized descriptions" metric. **Confirmed this needs net-new logging:** today the AI's guess is not recorded anywhere durable — `category_hints` is a keyword→category cache that **overwrites** the wrong guess the moment the user corrects it. Capture the (description, AI-guessed category, user-corrected category) triple at override time.

## Constraints

* Event collection requires the consent flow (RAM-20) — gate all event logging on consent.
* BETA sample size: funnel percentages are directional, not statistically meaningful — label them as such in the UI.

<!-- forge-comments -->
[
  {
    "id": "dfe07aa7-a613-4ffd-9f21-715b536548b1",
    "author": "Ramu Labs",
    "ts": "2026-05-17T16:03:49.563Z",
    "body": "PR opened — https://github.com/ramu-labs/Homu-Ledger-BETA/pull/61\n\n**Stacked on the RAM-18 PR ([#60](https://github.com/ramu-labs/Homu-Ledger-BETA/pull/60))** — it extends that dashboard, so its base is the RAM-18 branch. Merge after #60.\n\nBuilt: `events` table (migration `0032`, also extends `analytics_overview`), `lib/events.ts` (bulletproof consent-gated offline-buffered logger), `<TrackView>` helper, instrumentation of three funnels (transaction, category-picker, settings), and a Friction Points section on the dashboard. `npm run build` passes; lint unchanged (zero new problems).\n\n**Collection defaults OFF** — gated on analytics consent; the logger is dormant until RAM-20 wires real consent via `setEventsConsent()`. Apply migrations `0031` + `0032` to Supabase before testing.\n\nDeferred (each a small follow-up now the `logEvent` API exists): wallet funnel, granular `setting_changed`, the AI-miscategorization triple, and server-side consent enforcement (RAM-20).\n\nLeaving this issue **In Progress** — move to Done on merge."
  }
]
<!-- /forge-comments -->
