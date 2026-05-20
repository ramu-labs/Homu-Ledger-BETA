---
id: "ram-14"
title: "Free vs Premium tier — feature separation & gating"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Feature"
linear_id: "RAM-14"
linear_url: "https://linear.app/ramulabs/issue/RAM-14/free-vs-premium-tier-feature-separation-and-gating"
created_at: "2026-05-16T01:57:11.463Z"
updated_at: "2026-05-17T12:10:12.944Z"
---

Define and enforce a clear split between a Free tier and a paid Premium tier.

## Why

Monetization. Partial groundwork already exists — `profiles.subscription_tier` + `subscription_expires_at` columns, promo codes that grant a tier, and a `components/welcome-pro-modal.tsx` — but there is **no actual feature gating** yet. This issue is the real separation work.

## Open decisions (product + design)

Which features are Premium vs Free. Candidates for **Premium**, weighted by real cost / value:

* AI voice input & Receipt OCR (RAM-6) — genuine per-use API cost
* AI categorization beyond a monthly free quota
* Multiple ledgers beyond 1–2 (RAM-7 territory)
* Advanced reports & insights (RAM-12)
* Export (RAM-10), push notifications (RAM-9)

**Free** must stay genuinely useful — manual transaction logging, basic categories, one ledger, basic reports. A crippled free tier kills word-of-mouth.

## The work

* A tier-check helper (reads `subscription_tier` + expiry) usable server-side and client-side.
* Gated UI: locked states + upgrade prompts, reusing the welcome-pro modal pattern.
* A paywall / upgrade screen — **design-heavy**, mock this first.
* Billing: Stripe for web; or store IAP if shipping native (see RAM-13 — Apple/Google take 15–30%).

Every user-facing string ships bilingual (EN + ID).
