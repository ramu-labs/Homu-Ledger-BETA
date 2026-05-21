---
id: "ram-23"
title: "Add Transaction sheet dismisses after creating a new category"
status: "planned"
priority: "P1"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Bug"
created_at: "2026-05-20T17:38:09.923171+00:00"
updated_at: "2026-05-21T05:22:42.192Z"
---

Repro:

1. Open Add Transaction sheet.
2. Tap the category row → bento picker opens.
3. Tap "New category" → fill in name/icon/color → Save.
4. The new category is created, but the entire Add Transaction sheet also closes.
5. User has to reopen Add Transaction and re-enter amount / description / wallet / date.

Expected:

After creating the new category, the picker closes, the new category is preselected on the still-open Add Transaction sheet, and the user can hit Save on the transaction they were building.

Probable root cause: `add-category-sheet` is calling its `onClose` after success, which the parent (Add Transaction) interprets as a request to close too — or the dismiss event bubbles. Needs scoped close handler that targets only the category picker stack.

Companion to **ram-22** (redesign + audit pass).
