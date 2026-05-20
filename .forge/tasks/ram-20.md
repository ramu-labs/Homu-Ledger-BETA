---
id: "ram-20"
title: "Privacy Policy + analytics consent flow"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Auth & Security"
  - "Feature"
linear_id: "RAM-20"
linear_url: "https://linear.app/ramulabs/issue/RAM-20/privacy-policy-analytics-consent-flow"
created_at: "2026-05-17T12:11:33.421Z"
updated_at: "2026-05-17T16:03:49.982Z"
---

A Privacy Policy document + in-app consent flow. From the Homu Analytics Dashboard PRD §6 — this ships **as one package with the analytics dashboard** (RAM-18); the app cannot collect non-essential data without it.

## Why it matters beyond analytics

* **Unblocks** RAM-13 (native app store release) — both the App Store and Play Store require a published privacy policy plus accurate disclosures.
* **Current gap:** AI categorization already ships and sends transaction descriptions to Gemini with no opt-out — this issue fixes that.

## Consent model — three layers (required vs optional)

Consent for non-essential processing must be **freely given** (GDPR / Indonesia UU PDP) — it cannot be a condition of using the app. Declining an optional consent must **never block the app**. Apple guideline 5.1.1 and the Play Data Safety policy require the same.

| Layer | Required? | If the user declines |
| -- | -- | -- |
| 1. Accept Terms + Privacy Policy | Required to sign up | No account — normal, lawful practice |
| 2. Analytics / event tracking | **Optional** opt-in | Full app works; user is excluded from event tracking + identifiable analytics |
| 3. AI categorization | **Optional** opt-in | Full app works; falls back to manual categorization |

Layer 1 covers *necessary* processing (storing transactions, categories, wallets, auth) — that runs on contractual necessity, not consent, and is simply disclosed in the policy. Layers 2 and 3 are *not necessary* to track expenses, so they must be optional and have a working fallback.

## Consent revocation — behavior (decided; was an open question)

On revoke of **analytics** consent:

1. Stop collecting new events immediately.
2. Delete the user's already-collected event/analytics data (the RAM-19 `events` rows).
3. Exclude the user from identifiable analytics surfaces — per-user rankings + CSV export. They may still count *anonymously* in aggregate totals (DAU, retention).
4. **Never touch their transactions / categories / wallets** — that is core ledger data, not analytics.

On revoke of **AI** consent: switch that user to manual categorization; stop sending descriptions to Gemini.

## Deliverables

* **Privacy Policy** — data collected, storage & retention, who has access, user rights (access / export / delete), UU PDP + GDPR-aligned principles. `app/privacy/page.tsx` already exists — update it rather than starting from scratch.
* **Consent at signup** — Layer 1 acceptance + Layer 2 & 3 optional opt-ins. Plain-language, bilingual (EN + ID).
* **Settings** — toggles to turn Layer 2 and Layer 3 on/off at any time, a user-facing data-export request, and an account/data-deletion request.
* **Store compliance** — Apple privacy nutrition labels, Play Data Safety form. No non-essential collection before opt-in.

## Open question

* Retention period for historical event data — how long before auto-purge?

## Note

Not legal advice — have the final policy wording reviewed, especially UU PDP specifics, before app-store submission.
