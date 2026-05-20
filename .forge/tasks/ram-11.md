---
id: "ram-11"
title: "Voice queries — ask about spending, don't just add"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Voice"
  - "Feature"
linear_id: "RAM-11"
linear_url: "https://linear.app/ramulabs/issue/RAM-11/voice-queries-ask-about-spending-dont-just-add"
created_at: "2026-05-16T01:09:23.584Z"
updated_at: "2026-05-16T01:09:23.584Z"
---

Extend voice from write-only to read: "berapa pengeluaran makan bulan ini?" / "how much did I spend on transport this week?" → a spoken or inline answer.

**Why:** The entire voice stack (Whisper STT, Gemini NLU, the discriminated VoiceAction union) is already built for *adding* rows. A `query` action kind reuses all of it for *asking*.

**Dev notes:** new `VoiceAction` kind that resolves to a DB aggregate query rather than a mutation. Keep the answer surface simple first (inline text); spoken TTS can be a follow-up.
