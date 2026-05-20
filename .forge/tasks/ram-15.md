---
id: "ram-15"
title: "Hide home-screen totals — privacy toggle + eye reveal button"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Design & Polish"
  - "Feature"
linear_id: "RAM-15"
linear_url: "https://linear.app/ramulabs/issue/RAM-15/hide-home-screen-totals-privacy-toggle-eye-reveal-button"
created_at: "2026-05-16T14:24:03.300Z"
updated_at: "2026-05-16T14:24:03.300Z"
---

A privacy toggle that hides the home-screen money figures — Total Balance, Income, and Expense — plus a quick eye-icon button to reveal/hide them on the spot.

## Why

Shoulder-surfing privacy. Opening a finance app in public shouldn't broadcast your balance to anyone glancing at the screen. Standard pattern in banking apps.

## Behavior

* **Settings toggle** — a new row in Settings ("Hide amounts on home screen"). When ON, the app opens with Total Balance, Income, and Expense masked **every time**.
* **Masked state** — figures render as dots (e.g. `Rp ••••••`), keeping the currency symbol and the layout fixed so nothing shifts when toggled.
* **Eye button** — an eye icon on the home screen, near the balance card. Tap to reveal; tap again (eye-off icon) to re-hide. Lets the user peek without going into Settings.
* **Open question:** does the eye's reveal persist across app reopens, or reset to hidden on each open? Recommended: the Settings toggle decides the on-open default (hidden); the eye is a temporary peek for the current view.

## Dev notes

* The preference can live in `localStorage`, mirroring the existing `homu-theme` pattern — **no DB migration needed**.
* Main surface is `components/balance-card.tsx`; also check anywhere else the home screen renders income/expense totals.
* Eye icon: `Eye` / `EyeOff` from `lucide-react` (already a dependency).
* Settings row label ships **bilingual** (EN + ID) via `lib/i18n/dictionaries.ts`.
* Watch the **first-paint flash** — if the home renders with real numbers server-side, render masked by default and reveal only after the client reads the preference, so the real figure never flashes when the toggle is ON.

Small, self-contained, no migration — a good candidate for the autonomous backlog runner.
