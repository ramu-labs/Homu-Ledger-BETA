---
id: "ram-7"
title: "Settle-up — who-owes-whom balances across household members"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Multi-Ledger"
  - "Feature"
linear_id: "RAM-7"
linear_url: "https://linear.app/ramulabs/issue/RAM-7/settle-up-who-owes-whom-balances-across-household-members"
created_at: "2026-05-16T01:09:06.500Z"
updated_at: "2026-05-16T01:57:11.463Z"
---

Splitwise-style balances: show what each member owes the others, with a "settle up" action that records the repayment.

**Why:** Household members + `created_by` on every transaction already exist. The couple / roommate / travel use-cases want shared-expense settlement, not just a combined total.

**Design-heavy** — new screen. Mock: the balances view, per-transaction split UI (even/custom/percentage), the settle-up confirmation.

Open questions: split at transaction time vs. retroactively, equal-split default, how settle-up repayments appear in the ledger.
