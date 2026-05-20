---
id: "ram-13"
title: "Native app store release — Google Play + Apple App Store"
status: "backlog"
priority: "P2"
assignee: "ramu-labs"
project: "homu-ledger-beta"
labels:
  - "Feature"
linear_id: "RAM-13"
linear_url: "https://linear.app/ramulabs/issue/RAM-13/native-app-store-release-google-play-apple-app-store"
created_at: "2026-05-16T01:56:56.581Z"
updated_at: "2026-05-17T12:11:33.421Z"
---

Take HOMU from a PWA (installable, served from Vercel) to the native app stores.

## The work

* **Google Play** — wrap the PWA as a Trusted Web Activity (Bubblewrap / TWA). Low effort, fast review.
* **Apple App Store** — needs a real wrapper (Capacitor or a WKWebView shell). Apple rejects thin PWA wrappers; it wants native-feeling touches (proper splash, status bar, share sheet, no obvious "this is a website").
* Store listings: screenshots, descriptions (bilingual EN + ID), app icons, privacy nutrition labels, age rating, data-safety form.

## When to push — needs a decision

This issue exists partly to *decide the timing*. Suggested readiness gate:

1. Out of BETA.
2. Core flows stable — no P1 bugs for ~2 weeks.
3. Offline/sync proven on real devices.
4. If monetizing through store billing, the Free/Premium tier must exist first.

Apple in particular reviews more favorably when the app is substantial — having Budgets (RAM-5) and Reports depth (RAM-12) shipped first strengthens the review.

**Open questions:** Play Store first (low bar) then App Store later, or simultaneous? Does charging for Premium go through Apple/Google IAP (15–30% cut, their APIs required) or stay web-billing only?
