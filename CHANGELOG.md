# Homu Release History

This file is the GitHub-facing release log for Homu. Every production release must be documented here and in `lib/changelog.ts` before it is deployed.

## v1.7.5 - May 9, 2026

- Reverted v1.7.4's `bottom: -env(safe-area-inset-bottom)` hack on the sheet wrapper — it was extending the sheet past the visual viewport, which broke scroll inside the form (only the submit button responded to touch) and pushed the footer off-screen. Standard `fixed inset-0` is back.
- New approach for the cream strip below the popup: while the sheet is open, set `document.documentElement.style.backgroundColor = var(--surface)`. iOS PWA standalone renders the home-indicator safe-area zone using the `<html>` element's bg, so when the sheet is open the safe-area zone is the same colour as the sheet (no visible strip). The colour is reset 420ms after close (after the slide-out animation finishes).
- Bumped service-worker `CACHE_NAME` to `homu-v12`.

## v1.7.4 - May 9, 2026

- iOS PWA standalone evidently clips `position: fixed; bottom: 0` at the visual viewport boundary (above the home-indicator safe-area zone), leaving a strip of page background visible below the popup even with the v1.7.2/v1.7.3 wrapper-pattern + `h-full` approach. Added inline style `bottom: calc(0px - env(safe-area-inset-bottom))` on the slide-animated outer wrapper of both Add Transaction and Add Recurring sheets so the box (and therefore its bg) extends past the visual viewport bottom into the home-indicator zone.
- Bumped service-worker `CACHE_NAME` to `homu-v11` so the new chunks load on relaunch.

## v1.7.3 - May 9, 2026

- Forced explicit `h-full` on the inner sheet card (Add Transaction + Add Recurring) so its `bg-[var(--surface)]` reaches the very bottom of the iPhone screen. v1.7.2's wrapper relied on flexbox `align-items: stretch` (the default), which evidently wasn't always extending the inner card through the home-indicator zone on iOS PWA standalone.
- Bumped service-worker `CACHE_NAME` from `homu-v9` to `homu-v10` to force eviction of any stale `_next/static` chunks so the new sheet structure actually loads on first launch after the deploy.

## v1.7.2 - May 9, 2026

- Restructured Add Transaction and Add Recurring sheets so the white surface bg actually reaches every edge of the iPhone screen. The slide-animated wrapper is now `fixed inset-0` (definitely covers the viewport in all iOS PWA standalone configurations); the actual sheet card is a flex child inside that wrapper, max-width-constrained, stretching to full height. v1.7.1's `inset-y-0` direct approach didn't reliably extend through the home-indicator safe area on iOS PWA.
- Body-scroll unlock + scroll-position restore is now deferred until after the 420ms slide-out animation finishes (was firing immediately on close, which caused the page underneath to visibly jump while the sheet was still animating away).

## v1.7.1 - May 9, 2026

- Fixed the Add Transaction and Add Recurring popups not reaching the bottom of the iPhone screen, and the close animation flashing the page background strip during slide-out. The sheets now use `inset-y-0` (top:0 bottom:0) instead of `bottom-0 + h-dvh` — `h-dvh` was reporting shorter than the full viewport on iOS PWA standalone mode, leaving the safe-area zone uncovered.

## v1.7.0 - May 9, 2026

- Fixed the Add Recurring popup being unusable on iPhones with Dynamic Island. The sheet now respects `env(safe-area-inset-top)` so the close button is reachable, and adopts the same touchmove guard as Add Transaction so the page underneath can no longer scroll while the popup is open.
- Add Transaction popup now uses `h-dvh` (was `h-[95dvh]`) so it fills the screen with no background strip showing underneath, and the footer's bottom padding now respects `env(safe-area-inset-bottom)` so the submit button sits a clean distance above the home indicator.
- Replaced the bouncy spring entrance animation on both popups (`cubic-bezier(0.34, 1.56, 0.64, 1)`, 380ms) with a smooth Apple-style ease-out (`cubic-bezier(0.32, 0.72, 0, 1)`, 420ms). No more overshoot.
- Renamed `"familyledger"` → `"homu"` in `package.json` (and `package-lock.json`), bumped the service-worker `CACHE_NAME` to `homu-v9`, and replaced the `"e.g. Personal, Family"` ledger-name placeholder with `"e.g. Personal, Homu"` (and the Bahasa version `"mis. Pribadi, Keluarga"` → `"mis. Pribadi, Homu"`) so the brand is consistent everywhere it appears.

## v1.6.0 - May 9, 2026

- Added a branded launch splash to cover the gap between iOS's PWA pre-render and the first paint of the app. Cream background with the Homu icon centred, gentle breathing animation, fades out after ~900ms.
- Switched PWA `theme_color` and `background_color` from `#1a1a1a` / `#f5f0eb` to a unified `#f6f1e9` so the iOS pre-render flash and the splash blend seamlessly with the app's body colour instead of appearing black.

## v1.5.5 - May 9, 2026

- Cropped the bottom navigation's empty white space above the icons. Previously the bar was 72px + safe-area-inset-bottom (~106px on iPhone) tall with icons at bottom: 8px, leaving ~38px of empty white above them. The bar is now a flat 72px with the icon row filling its full height; the bar still reaches the physical bottom of the screen and the home indicator overlays its bottom edge as iOS expects.

## v1.5.4 - May 9, 2026

- Fixed the bottom navigation looking floaty in the installed iPhone PWA. The bar background now fills through `env(safe-area-inset-bottom)` to the physical bottom of the screen (previously the whole nav was lifted off the bottom by half the inset, leaving a beige strip below the white). Icons are positioned at `bottom: 8px` and the icon row was tightened from 72px to 60px so they sit just above the home indicator instead of in the middle of the bar.

## v1.5.3 - May 9, 2026

- Fixed the empty white strip below the bottom-nav icons in the installed iPhone PWA. The bar background no longer stretches through the home-indicator safe area; instead the whole nav (background + icons) sits half-way into the inset (~17px above the physical bottom on iPhone, flush on Android/desktop).

## v1.5.2 - May 9, 2026

- Lowered the bottom navigation icons. The gap above the iPhone home indicator was halved (full safe-area inset → half), so Transactions, Add, and Reports sit closer to the physical bottom while still clearing the home indicator.

## v1.5.1 - May 9, 2026

- Fixed the top of every page being hidden behind the iPhone status bar in the installed PWA. The layout, the Reports sticky header, and the Add-to-Home-Screen banner now all respect `env(safe-area-inset-top)` so the profile, ledger switcher, search, and filter buttons are tappable again.

## v1.5.0 - May 9, 2026

- Added the ability to delete a ledger from Settings → Ledger name. Tap the trash icon at the top-right and confirm; the ledger and all of its wallets, categories, transactions, recurring items, and members are permanently removed. The user's only ledger cannot be deleted — they must create or join another first.

## v1.3.4 - May 8, 2026

- Fixed fresh database setup so migrations include wallets, invitations, promo codes, transfer helpers, storage policies, and current security rules.
- Fixed Dashboard balances and Reports totals so they use full ledger history instead of only the first loaded transaction page.
- Fixed Reports wallet filtering so selecting every wallet behaves exactly like All wallets, including older transactions without a wallet.
- Tightened invite-code lookups and promo-code deletion so ledger invites stay private and developers can only delete their own unused promo codes.

## v1.3.3 - May 8, 2026

- Added developer-only deletion for generated promo codes that have not been redeemed yet, with two-tap confirmation.

## v1.3.2 - May 8, 2026

- Replaced the large Reports donut chart with a compact horizontal stacked bar so the breakdown list is visible sooner.

## v1.3.1 - May 8, 2026

- Added multi-wallet selection to the Reports wallet filter.

## v1.3.0 - May 8, 2026

- Added wallet filtering to the Reports page.
- Reorganized the Reports header with wallet filter, date range, and period selector.

## v1.2.0 - May 8, 2026

- Added fullscreen receipt photo viewing with download.
- Added browser-side photo compression before upload for faster saves on mobile data.

## v1.1.2 - May 8, 2026

- Fixed iOS Chrome photo saves hanging on "Saving..." by uploading photos directly to Supabase Storage.
- Added clearer upload failure handling with timeout behavior.

## v1.1.1 - May 7, 2026

- New ledgers now start with Cash, Savings, and Credit wallets.
- Fixed wallet badge centering on transaction rows.
- Improved wallet picker sizing and iPhone home-indicator spacing.

## v1.1.0 - May 7, 2026

- Added wallet-to-wallet transfers.
- Rendered transfer rows with neutral styling and From to To labeling.
- Excluded transfers from income, expense, and report aggregates.
- Fixed per-wallet balance handling for transfers.
- Fixed a Total Balance card hydration mismatch.

## v0.9.0 - May 7, 2026

- Added single-use promo-code signup.
- Added developer-only promo-code generation and stats.
- Added welcome modal for new PRO users.
- Added PRO badge showing subscription tier and expiry.
- Grandfathered existing users into Lifetime PRO.

## v0.8.0 - May 7, 2026

- Added wallets for tracking transaction source.
- Added wallet picker to Add Transaction.
- Added wallet badges to transaction rows.
- Added transaction filtering by wallet.
- Applied Homu coral branding to key app surfaces.

## v0.7.1 - May 6, 2026

- Localized the Updates page in English and Bahasa Indonesia.

## v0.7.0 - May 6, 2026

- Added quick recurring setup from any transaction.

## v0.6.3 - May 6, 2026

- Made categories a single editable list.
- Fixed Edit Category icon style handling.
- Fixed Lucide symbols rendering as text in filter chips and recurring editors.

## v0.6.2 - May 6, 2026

- Added pending invitees inline in the Members list.

## v0.6.1 - May 6, 2026

- Fixed inviting users outside the current ledger by email or username.

## v0.6.0 - May 6, 2026

- Added member invites by email or username.
- Added pending invitation accept/decline flow in My Ledgers.
- Added join-by-invite-code from My Ledgers.
- Added owner controls for canceling pending invitations.

## v0.5.0 - May 6, 2026

- Migrated to the new `homu.ramu.app` infrastructure.
- Added ledger renaming from Settings.
- Renamed Household to Ledger.
- Made the floating action button open the recurring sheet from the Recurring tab.
- Added the in-app Updates page.
