---
id: "ram-6"
title: "Receipt OCR — snap a photo, AI fills the transaction"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "AI Categorization"
  - "Feature"
linear_id: "RAM-6"
linear_url: "https://linear.app/ramulabs/issue/RAM-6/receipt-ocr-snap-a-photo-ai-fills-the-transaction"
created_at: "2026-05-16T01:09:01.748Z"
updated_at: "2026-05-16T01:57:11.463Z"
---

Camera → AI extracts amount, merchant, and date → pre-fills the Add Transaction sheet for review.

**Why:** The infrastructure already exists — photo attachments, Gemini, and the voice-add parse pipeline. Receipt scan is the obvious sibling to voice-add: same "AI drafts, user confirms" pattern.

**Design-heavy** — new capture flow. Mock: the camera/review screen, the confidence/edit affordances on AI-filled fields (reuse the sparkle treatment from voice).

Reuse: the two-call parse pattern, the ghost-row reveal, bilingual prompt handling.
