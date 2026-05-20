---
id: "ram-21"
title: "Fix keyboard issues on Add Transaction sheet"
status: "planned"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Bug"
created_at: "2026-05-20T17:31:51.000Z"
updated_at: "2026-05-20T17:31:51.000Z"
---

Keyboard interactions on the Add Transaction sheet still misbehave — sheet positioning, focus shifts, or gaps above the keyboard. Companion issue to the v1.46.1 fix that switched the sheet to `visualViewport`-based positioning; either a regression slipped through or there are additional symptoms not covered by that fix.

Needs a fresh repro pass on iOS Chrome PWA + iOS Safari PWA + Android Chrome to capture the exact failures before scoping the fix.
