---
id: "ram-18"
title: "Dev analytics dashboard — usage, adoption & retention (Phase 1)"
status: "in_progress"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Reports & Insights"
  - "Feature"
linear_id: "RAM-18"
linear_url: "https://linear.app/ramulabs/issue/RAM-18/dev-analytics-dashboard-usage-adoption-and-retention-phase-1"
started_at: "2026-05-17T12:32:20.696Z"
created_at: "2026-05-17T12:10:12.944Z"
updated_at: "2026-05-17T12:46:21.807Z"
---

Developer-only analytics screen for early-stage validation. From the Homu Analytics Dashboard PRD (v1.0), Phase 1 — **aggregate metrics only; friction-point event tracking is deferred to its own issue.**

Single scrollable mobile screen, `is_developer`-gated, under Settings → Developer (next to AI Admin). Every metric is computed from **existing Supabase tables** via `SECURITY DEFINER` RPCs — same pattern as the `api_usage_recent_window` RPC. No third-party SDK, no instrumentation.

## Sections

**1. Active users & retention** *(added in review — the PRD lacked this)*

* DAU / WAU / MAU + stickiness (DAU÷MAU). "Active" = logged or edited a transaction.
* Activation rate — % of signups who ever logged ≥1 transaction.
* D7 / D30 retention by signup cohort. **The core PMF signal.**

**2. User rankings**

* Top 10, expandable to Top 20. Sortable: transactions logged, last active date.
* Week-over-week change indicator + 4-week sparkline (transaction-count based).
* Note: "total logins / app opens" from the PRD is dropped — not measurable for a PWA without event tracking (see RAM-19). Use transactions logged as the activity signal.

**3. Feature adoption** — % of active users using each: custom category creation, custom-category share, multi-wallet, voice, recurring, photos, multi-ledger. Description-usage rate. ("Category usage rate" from PRD §5.3 is **dropped** — confirmed that a transaction cannot be saved without a category, so the metric would always read 100%. The custom-category metrics are the real signal of whether the default category set is sufficient.)

**4. AI categorization accuracy** — accept / override rate from the `category_ai` flag. **Caveat (confirmed):** that flag is only a boolean — it can't tell "user overrode the AI" apart from "the AI never suggested one," so the rate is approximate. "Top miscategorized descriptions" is **deferred** — confirmed the AI's original guess is *not* logged anywhere durable: `category_hints` is a keyword→category cache that gets **overwritten** when the user corrects (the wrong guess is destroyed), and `api_usage_logs` records only call cost / tokens / a preview. A precise accuracy metric needs new logging — see RAM-19.

**5. Financial behavior** — top categories, avg transaction size **segmented by currency** (HOMU is multi-currency — a global mean is meaningless), categories per user.

**6. Export** — CSV, time ranges 7d / 30d / all-time. **Pseudonymized: stable hashed IDs, no names.** A separate local-only ID↔name map preserves interview cross-referencing; the file shared with AI tools carries no PII.

## Build notes

* Compute **live on page load** (cache ~60s) — no daily aggregation job. The friends-&-family user base is small enough that aggregates run in milliseconds; add a job only if queries get slow.
* Aggregate counts only — never render individual transaction content.
* BETA caveat: small N → watch trends over weeks, not absolute values; D30 retention is meaningless until a cohort is genuinely 30 days old.

## Dependencies

* **Blocked by** RAM-20 — Privacy Policy + consent must ship in the same package.
* RAM-19 (event tracking) unlocks the deferred Friction-Point section + "top miscategorized" metric.
* Feeds RAM-14 — adoption data informs Free vs Pro placement (validates feature *value*, not pricing; all validation users are on Pro).
* Budgeting analytics = Phase 2, after RAM-5 ships.

<!-- forge-comments -->
[
  {
    "id": "08559aad-c382-450c-9d66-6c65e78fa8d2",
    "author": "Ramu Labs",
    "ts": "2026-05-17T12:46:21.852Z",
    "body": "PR opened — https://github.com/ramu-labs/Homu-Ledger-BETA/pull/60\n\nPhase 1 built end-to-end: migration `0031_analytics_overview.sql` (guarded `SECURITY DEFINER` RPC), `lib/analytics.ts` (all metric computation), the dev-gated screen + shell, pseudonymized CSV export, and the Settings link. `npm run build` passes; the new files are lint-clean.\n\n**Before it shows data:** apply migration `0031` to Supabase. Until then the screen renders a graceful \"unavailable\" state.\n\nDecisions made during the build (also in the PR body):\n- AI accuracy is a `category_hints` proxy — `category_ai` is not a DB column. Voice adoption omitted (no DB marker).\n- \"Category usage rate\" dropped — transactions can't be saved uncategorized.\n- CSV 7d/30d/all-time range selector deferred; v1 exports a full snapshot.\n\nLeaving this issue **In Progress** — move to Done on merge."
  }
]
<!-- /forge-comments -->
