---
id: "ram-22"
title: "Redesign 'New category' UI inside Add Transaction — inconsistent design + bugs"
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

The "New category" affordance launched from inside Add Transaction looks inconsistent with the rest of the sheet system (spacing, header style, button treatment) and has bugs in the flow (see ram-23 for one specific failure).

Scope:

- Audit the in-flow "New category" form against the standalone `add-category-sheet` and the rest of the bento-picker family — pick one visual language.
- Align headers, input styling, icon/color picker, primary/secondary buttons.
- Fix the bugs the redesign surfaces (parent sheet dismissal, return-to-flow, validation messages).

Related: **ram-23** (parent Add Transaction sheet closes after creating a new category), **ram-24** (category row width / truncation).
