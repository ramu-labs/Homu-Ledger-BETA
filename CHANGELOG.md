# Homu Release History

This file is the GitHub-facing release log for Homu. Every production release must be documented here and in `lib/changelog.ts` before it is deployed.

## v1.15.0 - May 12, 2026

### Recurring items auto-post to history

The Transactions page now materializes recurring items into the actual transaction log when their `next_due_date` arrives. Until now `recurring_items` was a reference list with no auto-post; the user had to re-enter the row manually every period. v1.15.0 closes that gap.

**How it works**
- Migration `0019_recurring_item_id_on_transactions.sql` adds a `recurring_item_id uuid` FK on `transactions` (nullable, `on delete set null`) plus the SECURITY DEFINER RPC `materialize_due_recurring_items()`.
- The Transactions page server component calls the RPC on every load. For each recurring item where `next_due_date <= current_date`, the RPC inserts a transaction copying `type/amount/name/category_id/wallet_id/created_by` (date = the due date, `recurring_item_id` = the source row) and advances `next_due_date` by the frequency interval (weekly → +7d, monthly → +1 month, yearly → +1 year). The advance loops, so back-fill works automatically if you haven't opened the app in weeks. Stops once `next_due_date` passes `repeat_until` (if set), at which point the recurring item is considered done and its `next_due_date` is nulled.
- The transaction list shows a small **Recurring** pill next to the name on rows with `recurring_item_id` set. Manually-entered rows are unchanged.

⚠ **Migration 0019 must be applied to the Supabase project before this is live.** If the migration hasn't run, the RPC call returns an error which is swallowed (best-effort) — the rest of the page renders normally, but no auto-posting happens.

## v1.14.3 - May 12, 2026

### Transactions page

- **Wallet inline as text.** Replaces the small wallet badge that sat on the bottom-left of each row's category icon. Each row now reads `Category · Wallet name` (e.g. `Food & Drink · Marcel's`). Member badge on the bottom-right stays — it's small enough that two badges + a circle icon was getting busy. Frees the icon to be a clean category-only glyph.

### Recurring items

- **Created date on each row.** Recurring items now show `Added DD MMM YYYY` (or `Dibuat …` in Indonesian) beneath the schedule info — handy for telling new entries from long-running ones.

## v1.14.2 - May 12, 2026

### Transactions page

- **Day-group headers.** The transaction list now groups rows by date with a section header (`Today`, `Mon, 11 May`, `Tue, 10 May`, …). Per-row date suffixes are gone — each row shows just category and (for transfers) From → To. Less visual repetition, easier to scan a day's activity. Year is included on dates outside the current year (e.g. `Mon, 11 May 2025`).
- **Income / Expense summary pills restructured.** The arrow icon is now inline with the `Income` / `Expenses` label on a single row at the top, and the amount sits below on its own line at 17px (was 15px). The amount column no longer competes with the icon for horizontal space, so longer numbers (millions and up) don't truncate as eagerly.

## v1.14.1 - May 12, 2026

### Fix

- **Sticky headers on Settings pages actually stick now.** v1.14.0 added `sticky top-0` to every Settings page header, but on iOS Safari the rule `html, body { overflow-x: hidden }` in `globals.css` traps `position: sticky` (WebKit treats it as creating an implicit overflow-y containing block that breaks the sticky scrolling ancestor). Switching to `overflow-x: clip` keeps horizontal-overflow protection without trapping sticky descendants. Affects: `/settings`, `/settings/name`, `/settings/edit-profile`, `/settings/symbol`, `/settings/currency`, `/settings/language`, `/settings/style`, `/settings/members`, `/settings/categories`, `/settings/wallets`, `/settings/promo-codes`, `/settings/updates`.

## v1.14.0 - May 10, 2026

### Categories

- **Delete category now actually persists.** The old RLS policy `"categories: members can delete non-default"` silently filtered out the seeded `is_default=true` rows, so deleting them appeared to succeed (no DB error) but the row stayed in the table. Migration `0018` replaces it with `"categories: members can delete"` — household members can delete any category in their household, defaults included.
- **Two-tap delete confirmation** in the Edit Category sheet: the first tap turns the button red and shows "Tap again to confirm" with a 3-second auto-disarm; the second tap performs the delete.
- **Transactions and recurring items reassign to "Uncategorized"** when their category is deleted. The FK already has `on delete set null`, so the DB does it automatically. The transaction/recurring list and reports now display `null` category as **Uncategorized** (was previously labeled "Other").
- **Expense / Income split**. Categories now have a `type` enum column. Existing rows default to `expense`; the previously-misplaced `Salary` default is reclassified to `income`. Three new income defaults are seeded for every existing household: **Salary**, **Bonus**, **Reimburse**. The seed trigger for newly-created households also seeds these. Settings → Categories has Expense / Income tabs, the picker in Add Transaction / Add Recurring filters by the current type, and switching type clears a now-invalid selection.

### Settings UX

- **Sticky headers** on every Settings page (`sticky top-0 z-20 bg-[var(--background)]/95 backdrop-blur`). Back button is always reachable.
- **Owner-only ledger delete.** `/settings/name` now reads `?owner=1` from the URL (set by `/settings` only when the current user is the household owner) and hides the delete button for non-owners. The server-side check in `deleteCurrentHousehold` was already in place; this just cleans up the UI.

### Reports

- **Daily-trend chart tap highlight removed.** Added `[-webkit-tap-highlight-color:transparent]`, `select-none`, and `[&_*]:outline-none` to the chart container so tapping a bar no longer draws the iOS blue rectangle.
- **Full-day tooltip format.** New helper `formatDayWithWeekday(YYYY-MM-DD) → "Mon, 11 May 2026"` and a Recharts `labelFormatter` that reads each bar's stored `dateKey` to produce that label.

### ⚠️ Database migration required

`supabase/migrations/0018_categories_type_and_delete_policy.sql` must be applied before v1.14.0 is functional. Apply via the Supabase dashboard → SQL editor, or `supabase db push` if using the CLI. Without it, every category-typed query will fail at runtime.

## v1.13.4 - May 10, 2026

- **Search bar bottom outline fix**: dropped the `max-height` keyframe and the `overflow: hidden` from `.animate-search-reveal`. The `overflow: hidden` was clipping the input's `ring-1` outline (Tailwind rings are box-shadow-based and extend slightly outside the box). The animation is now pure `transform` (translateY −8px → 0) + `opacity` (0 → 1) over 240ms — same feel, no clipping.

## v1.13.3 - May 10, 2026

- **Photo viewer**: header now uses `paddingTop: max(1rem, env(safe-area-inset-top))` so the close X clears the iPhone status bar / Dynamic Island.
- **Filter sheet**: applied `animate-sheet-slide-up` (translateY 100% → 0, 360ms cubic-bezier(0.32, 0.72, 0, 1)) on the sheet container and `animate-overlay-fade-in` (opacity 0 → 1, 280ms) on the backdrop. Sheet now glides up from the bottom instead of appearing instantly.
- **Search bar**: applied `animate-search-reveal` (translateY −8px + opacity 0 → 0, max-height 0 → 5rem, 240ms) when the search field opens from the header. Bar slides down and fades in.

Three new keyframes added to `globals.css`: `sheet-slide-up`, `overlay-fade-in`, `search-reveal`.

## v1.13.2 - May 10, 2026

Bottom-nav follow-up:
- **Wider gaps**: `gap-3` → `gap-4` (16px between items, was 12px).
- **Lower position**: `bottom: env(safe-area-inset-bottom)` (was `+ 4px`). Bar's bottom edge now sits exactly at the top of the home-indicator safe area.
- **Tighter shadow**: replaced the diffuse `0 12px 36px rgba(...)/0.18` drop with a layered `0 6px 18px rgba(...)/0.12, 0 1px 4px rgba(...)/0.08`. The smaller secondary shadow gives a crisp lift while the larger primary shadow softens it, so the bar reads as a distinct floating layer against the cream page bg even though the surface colour is close to the page.

## v1.13.1 - May 10, 2026

Bottom-nav follow-up tweaks:
- **Wider gaps**: `gap-1` → `gap-3` between buttons, plus container padding `p-1.5` → `p-2`. Tabs and centre + button now have more breathing room.
- **Lower position**: `bottom: calc(env(safe-area-inset-bottom) + 4px)` (was `+ 8px`). Sits closer to the home-indicator zone without overlapping it.
- **Hidden on Settings**: returns `null` when `pathname.startsWith("/settings")`. Settings screens have their own back-button navigation context, no need for the global bar there.

## v1.13.0 - May 10, 2026

**Bottom navigation refinements** (per user feedback on v1.12.0):

- **Bigger** — each tab is `h-14 w-20` (was `h-12`); centre + is `h-14 w-14` (was `h-12 w-12`).
- **Lower** — sits `bottom: calc(env(safe-area-inset-bottom) + 8px)` (was `+ 16px`).
- **Labels always visible** — each side tab is now a vertical stack: icon on top, label (Transactions / Reports) below in `text-[10px] font-semibold`. No more max-width animation on the label.
- **Centre + button stays put** — side tabs are now fixed-size `h-14 w-20` rectangles regardless of active state (only colour and background pill change between states), so layout never reflows around the centre button. Active state shows a `var(--foreground)/6` background pill behind the side tab.
- **Side tab press animations removed** — only the centre + button retains its tactile `scale-90 + softer shadow` press effect; side tabs intentionally have no scale animation so they don't visually shift the centre button on touch.

**Restored iOS rubber-band scroll** — removed `overscroll-behavior: none` from `html, body` in `globals.css`. The Transactions and Reports pages (which scroll the document body) now bounce naturally at the top and bottom edges, matching iOS native feel. Popup scroll-bleed prevention still works because the popup applies `overflow: hidden` directly on body during open + uses a touchmove guard.

## v1.12.0 - May 9, 2026

Rebuilt the bottom navigation as a floating capsule. The bar is now a single rounded-full pill containing the two side tabs (Transactions, Reports) and the centred + button. It sits `bottom: calc(env(safe-area-inset-bottom) + 16px)` so it always floats clear of the iPhone home indicator and doesn't touch the screen edges.

Press animations:
- **Side tabs:** scale-95 on press; the active tab gets a soft `var(--foreground)/6` background pill and reveals its label (Transactions / Reports) which animates open. Inactive tabs show icon-only and the label collapses to width 0.
- **Center + button:** scale-90 on press with the shadow softening simultaneously, simulating a button being pushed in. `transition-[transform,box-shadow] duration-150 ease-out`.

Same wiring (custom event for in-page +, `?new=1` for cross-page +), so the existing AddTransactionSheet flow is unchanged.

## v1.11.0 - May 9, 2026

Rebuilt the popup chrome from scratch (form contents, validation, photo upload, etc. unchanged). Two structural changes:

**1. Sheet anchored to TOP, not BOTTOM:**
- Was: `fixed bottom-0 ... h-dvh` — iOS PWA standalone clips `bottom: 0` above the home-indicator zone, which is the root of the cream-strip bug.
- Now: `fixed top-0 ... style={{ height: "100lvh" }}` — sheet's bottom edge is just `top + height` (= top + full-screen). No separate bottom anchor for iOS to clip. The slide-in/out animation works identically because translateY is relative to the element's own height regardless of where it's anchored.

**2. Body-scroll lock simplified:**
- Was: `position: fixed` body lock with explicit bounds (multiple variations attempted in v1.7.x–v1.10.x, none reliably solved the cream strip).
- Now: plain `overflow: hidden` on `<html>` and `<body>`. Less aggressive, doesn't trigger the iOS containing-block bug. The existing `touchmove` preventer handles iOS Safari's momentum-scroll bypass.

UI, fields, footer, easing — all unchanged. Same `420ms cubic-bezier(0.32, 0.72, 0, 1)` slide.

## v1.10.2 - May 9, 2026

User confirmed v1.10.1 broke things worse — `h-[100lvh] min-h-screen` extended the popup *above* the visible viewport, pushing the close X off-screen behind the status bar and pushing form content into the Dynamic Island area.

Reverted the popup wrapper height back to `h-dvh`, restoring the v1.8.3 / v1.10.0 baseline. Popup wrapper now matches what the user originally reported as working.

The cream-strip mystery remains unresolved on v1.10.0/v1.10.2. Next step is for me to actually try to reproduce visually in a non-PWA context to understand what's happening — pure code analysis hasn't been enough.

## v1.10.1 - May 9, 2026

User reported the cream strip was still present in v1.10.0 (= v1.8.3 baseline) even though that's the version they last reported as working. Tried one more variable: popup height.

Changed Add Transaction and Add Recurring popup wrapper height from `h-dvh` to `h-[100lvh] min-h-screen`. In iOS PWA standalone, `100dvh` can compute shorter than the physical viewport (the dynamic viewport excludes the home-indicator zone in some standalone WebKit configurations). `100lvh` is the *large* viewport height (always equal to or greater than `100dvh`) and `min-h-screen` adds a safety floor at `100vh`. With either of those reaching the physical bottom, the popup fully covers the home-indicator zone — no strip.

## v1.10.0 - May 9, 2026

Rolled back to the v1.8.3 codebase. v1.9.0–v1.9.3 attempts at animation polish, scroll-bleed mitigation, and the home-indicator-strip mitigation each introduced new regressions, so reverted entirely.

Files restored to their v1.8.3 state:
- `components/add-transaction-sheet.tsx`
- `components/add-recurring-sheet.tsx`
- `components/balance-card.tsx`
- `components/edit-wallet-sheet.tsx`
- `components/add-category-sheet.tsx`
- `components/edit-category-sheet.tsx`
- `components/wallet-picker-sheet.tsx`
- `components/category-picker.tsx`
- `app/globals.css`
- `app/(app)/layout.tsx`

Bumped forward as v1.10.0 (rather than tagging as v1.8.3) so the deployed build can be uniquely identified and the SW cache (`homu-v23`) forces fresh chunks.

## v1.9.3 - May 9, 2026

After multiple attempts (v1.7.x – v1.9.2) failed to make the popup actually cover the iPhone home-indicator zone in iOS PWA standalone, switched strategy: leave the popup's geometry alone and **make the colour shown in that uncovered zone match the popup**.

- New `--page-bg` CSS variable defaults to `var(--background)` (cream).
- New rule `body.popup-open { --page-bg: var(--surface); }` flips it to white.
- `(app)/layout.tsx` outer div and `html, body` rules now use `var(--page-bg)`.
- Both popup body-lock effects toggle `document.body.classList.add/remove("popup-open")` alongside the existing `position: fixed` lock.

So while a popup is open, the entire page underneath (including the strip iOS PWA standalone leaves uncovered above the home indicator) is the same colour as the popup — invisible to the user. When the popup closes, the class is removed and the page returns to cream.

## v1.9.2 - May 9, 2026

User reported the cream strip + scroll-bleed regression on v1.9.0 even after a clean PWA reinstall (so v1.9.1's SW cache bump and Cause #1 are ruled out). Cause #2 from the analysis: the `prev` snapshot pattern in the body-lock effect can stale-capture locked values when popup open/close events overlap (a previous popup's deferred unlock hasn't fired before the next open captures `prev`), leaving body's lock-style state corrupted on subsequent operations.

This release reverts both:
- The `prev` snapshot — body-lock cleanup now **unconditionally** clears the lock-related style properties on close (they're the only ones we set, so wiping them is safe).
- The 420ms `setTimeout` defer — cleanup runs immediately on close.

Trade-off: v1.9.0's smoother close (no page-jump-on-close) regresses to a small jolt as `window.scrollTo` restores the page position mid-slide. We'll revisit smoothing the close differently once the strip is conclusively gone.

## v1.9.1 - May 9, 2026

- Bumped service-worker `CACHE_NAME` from `homu-v19` → `homu-v20` to force eviction of any chunks that may still be cached from earlier builds. The SW activate handler deletes every cache that doesn't match `CACHE_NAME`, so on next launch all stale `_next/static` assets are cleared.

## v1.9.0 - May 9, 2026

Animation polish across the app.

- **Popup close jolt** fixed. Body-scroll unlock + scroll-position restore on Add Transaction / Add Recurring close is now deferred until after the 420ms slide-out animation finishes. Was firing immediately, which caused the page underneath to snap to its scroll position mid-animation (the user perceived this as a "freeze + jolt"). Safe to defer now that v1.8.3's explicit-bounds body-lock keeps fixed children (the bottom nav) anchored correctly throughout the lock.
- **Transaction-row reveal** (`row-in`): 0.22s ease → 0.5s `cubic-bezier(0.22, 1, 0.36, 1)` (easeOutQuart) with translate-up bumped from 8px to 10px. Calmer.
- **Balance count-up** (`useCountUp`): 600ms ease-out cubic → 1100ms easeOutQuart. Number glides instead of snapping.
- **Filter-chip pop** (`chip-pop`): 0.22s ease → 0.32s `cubic-bezier(0.22, 1, 0.36, 1)` with gentler scale range (0.92 → 1.04 instead of 0.88 → 1.06).
- **Secondary sheet modals** (Add Category, Edit Category, Edit Wallet, Wallet Picker, Category Picker): updated transition timing to `360ms cubic-bezier(0.32, 0.72, 0, 1)` for visual consistency with the main popups.
- **`tx-flash`**: 0.9s → 1.1s — matches the calmer feel.

## v1.8.3 - May 9, 2026

Combined fix for both iOS PWA standalone bugs we've been bouncing between:

- v1.7.x's `position: fixed` body lock fixed scroll-bleed but caused the cream strip (iOS resolved `position: fixed; bottom: 0` children against body's collapsed bounds, above the home-indicator zone).
- v1.8.1's `overflow: hidden` body lock fixed the cream strip but let scroll bleed through to the page underneath (iOS Safari standalone bypasses overflow:hidden + overscroll-behavior + touchmove preventer for sufficient touch gestures).

This release uses `position: fixed` body lock (reliable scroll lock) AND gives body explicit `top: -scrollY; bottom: 0; left: 0; right: 0` so its box fills the viewport. With body's bounds explicitly matching the viewport, iOS doesn't collapse body's height — `bottom: 0` on fixed children resolves to the actual viewport bottom.

## v1.8.2 - May 9, 2026

After v1.8.1's `overflow: hidden` body lock fixed the cream strip, scroll inside the popup was bleeding to the page underneath via iOS scroll-chaining (the page-bg scrollbar indicator was visible while scrolling the form). Two fixes:

- Added `overscroll-contain` on the Add Recurring popup's inner scroll container (the Add Transaction popup already had it).
- Added `overscroll-behavior: none` on `html, body` globally in `globals.css` so any scroll chain that escapes a popup's inner scroller cannot bounce the body or trigger pull-to-refresh.

## v1.8.1 - May 9, 2026

After the v1.8.0 v1.5.5 baseline revert still showed the cream strip below the popup in installed iPhone PWA, switched the body-scroll lock from `position: fixed; top: -scrollY; width: 100%` to plain `overflow: hidden` on `<html>` and `<body>`. iOS PWA standalone WebKit was treating `position: fixed` children of a fixed-positioned body as anchored to body's collapsed bounds (above the home-indicator safe-area zone) instead of the actual viewport, which made the popup and the bottom nav both end above the home indicator with a strip of page bg visible. With body in normal flow, fixed children resolve `bottom: 0` to the actual viewport bottom. The existing touchmove preventer still handles the momentum-scroll case where overflow:hidden alone isn't enough on iOS Safari.

## v1.8.0 - May 9, 2026

After v1.7.x's accumulating attempts to fix iOS PWA standalone safe-area rendering kept making things worse, reverted to the v1.5.5 baseline that the user reported as working perfectly:

- **Popup sheets** (Add Transaction + Add Recurring): wrapper-pattern (outer `fixed inset-0` + inner `h-full` + flex stretch) introduced in v1.7.2 reverted to v1.5.5's single-div `fixed bottom-0 left-1/2 -translate-x-1/2 h-dvh` structure. The wrapper variants interacted badly with iOS standalone's containing-block resolution when `<body>` is `position: fixed`-locked.
- **Body-scroll unlock** now fires immediately on popup close (matches v1.5.5). The 420ms `setTimeout` defer added in v1.7.2 was keeping the page in its locked-state coordinate frame for the entire slide-out animation, which made the bottom navigation render in a raised position visible behind the closing popup.
- **Removed `<html>` background manipulation** added in v1.7.5–1.7.6. Reverted `globals.css` to v1.5.5's `html, body { background: var(--background); }`.
- **Removed v1.7.7 safe-area filler** in `(app)/layout.tsx`. It anchored to `bottom: 0` itself, which meant it shifted up with the bottom nav under iOS PWA body-lock — it couldn't help.
- Kept the Dynamic Island top-safe-area handling on the popup via `paddingTop: env(safe-area-inset-top)` (added in v1.7.0; needed to keep the close X reachable on iPhones with Dynamic Island).
- Kept the smoother slide-in easing introduced in v1.7.0.

## v1.7.7 - May 9, 2026

- Final fix for the cream strip below the popup and bottom navigation in the installed iPhone PWA. v1.7.6 set `<html>` bg to `var(--surface)` but `<body>` and the root `<div>` in `(app)/layout.tsx` (which has `bg-[var(--background)]` and `min-h-dvh`) cover the html, so the safe-area zone still showed cream. Added a fixed surface-coloured filler element pinned to `bottom: 0` with `height: env(safe-area-inset-bottom)` and `z-0 pointer-events-none`. It sits behind everything (popup z=70, bottom nav z=50) and only paints in the iPhone home-indicator zone — so any element that ends at the visual viewport boundary blends with it.
- Bumped service-worker `CACHE_NAME` to `homu-v14`.

## v1.7.6 - May 9, 2026

- Fixed the cream strip below the bottom navigation bar in the installed iPhone PWA (and the matching "floating bar" flash visible on popup close, which was the same bar appearing momentarily after the popup slid away). Root cause is iOS PWA standalone clipping `position: fixed; bottom: 0` at the *visual* viewport bottom, above the home-indicator safe-area zone — so any element anchored to bottom-0 (bottom nav, sheet wrappers) ends above the physical screen bottom and the html element's bg shows through in that strip. Globals.css now sets `html { background: var(--surface) }` and `body { background: var(--background) }` separately. The strip is therefore the same surface colour as the bottom nav and the popup sheets, making it invisible — without needing fragile bottom-extension hacks that broke scroll in v1.7.4.

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
