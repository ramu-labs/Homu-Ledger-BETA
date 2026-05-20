---
id: "ram-24"
title: "Category rows too small — long category names get clipped"
status: "planned"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Design & Polish"
  - "Bug"
created_at: "2026-05-20T17:31:51.000Z"
updated_at: "2026-05-20T17:31:51.000Z"
---

In the category picker (and possibly the inline category chip on Add Transaction), the row / chip is too narrow for longer category names. Multi-word categories ("Office supplies", "Personal care", "Subscriptions", Indonesian translations like "Perlengkapan kantor") get visually truncated.

Fix direction:

- Audit row width inside `category-picker` against the longest category names from migration 0030's seed set (both EN and ID).
- Either widen the row, allow it to wrap to two lines, or shrink the icon/padding so the label has more room.
- For the inline chip on the Add Transaction sheet, use `truncate` only if the chip has a tooltip / expanded state — otherwise prefer wrap.

Companion to **ram-22** (redesign + audit pass).
