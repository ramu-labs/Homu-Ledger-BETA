# Homu Release History

This file is the GitHub-facing release log for Homu. Every production release must be documented here and in `lib/changelog.ts` before it is deployed.

## v1.32.0 - May 15, 2026

Sign-up flow redesigned end-to-end. Four parts.

### 1. Email-only signup, locked header, logo gone

- `/signup` now lives in a `min-h-dvh` flex column with a `sticky top-[env(safe-area-inset-top)]` header carrying just a back chevron (top-left, matching the rest of the app's Settings sub-pages) and the page title. Header doesn't scroll with the form.
- Homu logo removed — the form is long enough now that the logo was forcing the user to scroll just to see the first input.
- The "Continue with Google" button at the top of the form is gone. Google sign-up lives on `/login` (the landing page); `/signup` is the email path only. Keeps the two paths separate and avoids the "wait, why is there Google here too?" decision tax.
- "Already have an account? Sign in" link now routes to `/login/password` (the actual email/password form), not `/login` (the landing).

### 2. New fields: Gender, Date of birth, Password confirmation

Migration `0027_profile_gender_dob.sql`:

```sql
alter table public.profiles
  add column if not exists gender text
    check (gender is null or gender in ('male','female','other','prefer_not_to_say'));

alter table public.profiles
  add column if not exists birth_date date;
```

Both nullable so existing rows don't break. Gender stored as a small fixed set (4 options) so reports / nudges can rely on it later without freeform-string normalisation. `prefer_not_to_say` is explicit (not NULL) so we can tell "opted out" from "predates this column".

Server-side validation in `app/actions/auth.ts`:
- Password ≥ 8 chars, must match the confirmation field
- DoB must parse, must be 13–120 years ago (refuses future dates and obviously-bogus values)
- Username regex `[a-z0-9_]{3,20}` (unchanged from before)
- Promo code still required

Client uses the native `<input type="date">` picker for DoB with `min`/`max` set to 13/120 years ago — much better UX than three-dropdown month/day/year on mobile.

### 3. Email OTP step (6-digit code)

`signUp` server action split into three actions:

```ts
signUpStartEmailOtp(formData)  // validates + supabase.auth.signUp
verifySignUpOtp(email, token)  // supabase.auth.verifyOtp + finalise
resendSignUpOtp(email)         // supabase.auth.resend
```

Why split: in the old single-action flow, the promo code was redeemed and the profile fields were written immediately after `supabase.auth.signUp`. With email confirmation on, that timing is wrong — the user could abandon at the OTP step and we'd have already burned their promo code. Now:

```
[ form submit ]
        ↓
signUpStartEmailOtp
  → validate everything
  → supabase.auth.signUp({ email, password, options.data: {
       name, username, gender, birth_date, promo_code
    }})
  → DID return a session?
      ├── yes  → email confirmation is OFF → finalize + redirect
      └── no   → return { needsOtp: true, email }
                          ↓
                  [ OTP step renders ]
                          ↓
                  verifySignUpOtp
                    → supabase.auth.verifyOtp({ type:'signup', email, token })
                    → finalise (write profile fields, redeem promo)
                    → redirect /onboarding?welcome=1
```

`finalizeSignUp` is a shared helper that does the profile UPDATE + `redeem_promo_code` RPC call. Used by both the OTP-verified branch and the email-confirmation-off branch so the post-signup state is identical.

Client side (`app/(auth)/signup/page.tsx`) is a two-step state machine with `step: "form" | "otp"`. Back button on OTP step returns to the form (preserving entered data… well, except the password fields, browser-native behaviour). OTP input is `inputMode="numeric"` + `autocomplete="one-time-code"` so iOS / Android auto-fill from the SMS-style code panel.

### 4. Required after deploy

Email confirmation must be **enabled** in the Supabase dashboard for the OTP step to actually fire:

```
Supabase Dashboard
  → Authentication
    → Sign in / providers
      → Email
        → Confirm email = ON
```

Until then `signUp` returns a session immediately and we just redirect — the OTP screen never appears, and the user is signed up the moment they hit Create. The code handles both states (the `if (data.session)` branch in `signUpStartEmailOtp`), so this is a soft switch — no broken state either way.

### Files touched

- `supabase/migrations/0027_profile_gender_dob.sql` (new)
- `app/actions/auth.ts` — `signUp` → three actions + shared `finalizeSignUp` helper; legacy `signUp` re-export for any stale call-sites
- `app/(auth)/signup/page.tsx` (rewritten — two-step state machine + locked header + new fields)
- `lib/supabase/database.types.ts` — `gender` + `birth_date` columns on `profiles`
- `lib/i18n/dictionaries.ts` — gender/DoB/OTP/password-confirm strings
- `lib/changelog.ts` — v1.32.0 entry
- Version bumps in `package.json`, `public/sw.js`, settings footer

---

## v1.31.0 - May 15, 2026

Three things: the redirect-loop fix from yesterday's bug report, device nicknames, and instant Settings navigation.

### 1. Redirect-loop fix (Safari "20 redirections")

Root cause: middleware was using `supabase.auth.getSession()`, which only decodes the cookie's JWT locally. When a session was revoked elsewhere (Devices page → Sign out, OAuth on another device, etc.), the JWT in the cookie stayed syntactically valid for up to ~1h. So middleware said "logged in", but page-level `requireSession()` calls `getUser()` which actually round-trips to Supabase → returns null → page redirects to `/login` → middleware sees the still-decodable cookie → redirects back to `/transactions`. Loop until Safari throws "Load cannot follow more than 20 redirections".

Fix in `lib/supabase/middleware.ts`:

```diff
- const { data: { session } } = await supabase.auth.getSession();
+ const { data: { user } } = await supabase.auth.getUser();
```

`getUser()` validates against Supabase auth on every request — adds ~50–100ms latency but eliminates the loop. This is the [Supabase-recommended pattern](https://supabase.com/docs/guides/auth/server-side/nextjs) since the SSR template update in 2024.

### 2. Device nicknames

New feature on `/settings/devices`. Tap the pencil icon next to any device → inline input → save or cancel. Empty-string nickname clears it.

Migration `0026_device_nicknames.sql`:

- `public.device_nicknames` table keyed by `session_id` with FK cascade to `auth.sessions(id)` — when a session is deleted, its nickname disappears automatically.
- Per-user RLS (4 policies, one per CRUD verb) gates access to your own rows. The actual session-ownership check is done in the RPC, but RLS provides defence-in-depth against direct queries.
- DROP + recreate `list_user_sessions()` because the return type widens (added `nickname` column).
- New `rename_device_session(p_session_id, p_nickname)` SECURITY DEFINER RPC. Empty-string nickname → DELETE the row (revert to parsed UA label). 50-char limit enforced both as a CHECK constraint and a runtime check.

UI in `components/devices-shell.tsx`:
- When a nickname is set: primary line is the nickname, subtitle becomes `"iPhone · Safari · 2 hr ago"`.
- No nickname: primary line is the parsed UA label, subtitle is just the relative time.
- Pencil icon swaps the row header into an inline input with Save / Cancel buttons. Auto-focus the input; Enter to save, Escape to cancel. Optimistic UI on save.

### 3. Instant Settings navigation

`app/(app)/settings/loading.tsx` new — renders a skeleton matching the real page layout (header bar, profile card, 3 section groups with row counts that roughly match reality). Next.js shows it instantly on navigation while the real page server-renders behind it.

The settings page itself runs `requireSession()` + household SELECT + a feedback-count SELECT for developers — ~200ms perceived delay before the skeleton, ~10ms with it. The shape match means no layout jump when the real content swaps in.

### What's NOT in this PR

User asked for a "previous-screen + popup" UX on signed-out devices (instead of redirecting to /login). That requires client-side 401 handling + a modal layer that doesn't exist yet — bigger feature, will queue as a follow-up. The redirect-loop fix alone is the immediate-relief change.

### Files touched

- `supabase/migrations/0026_device_nicknames.sql` (new)
- `lib/supabase/middleware.ts` — getUser() instead of getSession()
- `app/(app)/settings/loading.tsx` (new — skeleton)
- `app/(app)/settings/devices/page.tsx` — thread nickname through `DeviceRow`
- `components/devices-shell.tsx` — rename UI (Pencil, input, Save/Cancel)
- `app/actions/auth.ts` — new `renameDeviceSession` server action
- `lib/supabase/database.types.ts` — `list_user_sessions` widened + `rename_device_session`
- `lib/i18n/dictionaries.ts` — `devices.rename` + `devices.nicknamePlaceholder`
- `lib/changelog.ts` — v1.31.0 entry
- Version bumps in `package.json`, `public/sw.js`, settings footer

---

## v1.30.0 - May 15, 2026

Closes the "I got signed out on my iPhone when I signed out on the web" loop reported in v1.29.0. Two parts:

### 1. Sign out is now local-only

`app/actions/auth.ts`:

```diff
- await supabase.auth.signOut();
+ await supabase.auth.signOut({ scope: "local" });
```

Supabase's default sign-out scope is `'global'` — it revokes every refresh token for the user across every device. That's the right default for a "lost phone, sign me out everywhere" button, but a footgun when you just want to log out of the current tab. Switching to `'local'` keeps the other devices alive.

### 2. New /settings/devices page

A real "manage signed-in devices" surface, lives under Settings → Support → Signed-in Devices. Lists every active row from `auth.sessions` for the current user with a friendly label parsed from the `user_agent` string.

**Per-row two-step flow** (matches the existing two-tap-to-confirm pattern from promo codes / AI key clear):

```
                    ┌───────────────────────┐
                    │   ACTIVE              │
                    │   [Sign out]          │
                    └───┬───────────────────┘
                        │  tap once
                        ▼
                    ┌───────────────────────┐
                    │   ACTIVE — armed      │
                    │   [Tap again to       │
                    │    sign out]   red    │
                    └───┬───────────────────┘
                        │  tap again
                        ▼
                    ┌───────────────────────┐
                    │   SIGNED OUT          │
                    │   [Delete]            │
                    └───┬───────────────────┘
                        │  tap once
                        ▼
                    ┌───────────────────────┐
                    │   SIGNED OUT — armed  │
                    │   [Tap again to       │
                    │    delete]    red     │
                    └───┬───────────────────┘
                        │  tap again
                        ▼
                    (row removed from list)
```

Armed state auto-cancels after 3s so an accidental first tap can't sit around as a one-tap-from-disaster trap.

**Current device** shows a green "This device" badge instead of the action buttons — you can't kick yourself off this page, and for that the main Sign Out in /settings is what to use.

**Bulk action** — "Sign out other devices (N)" at the bottom uses Supabase's built-in `scope: 'others'`. One confirm, then every non-current row flips to "Signed out" optimistically.

### Migration 0025 — three SECURITY DEFINER RPCs over auth schema

We can't expose `auth.sessions` directly via RLS (it's a Supabase-managed table), so three SECURITY DEFINER functions wrap the access:

- `list_user_sessions()` — `auth.sessions` WHERE `user_id = auth.uid()`, plus `is_current` (from `auth.jwt() ->> 'session_id'`) and `is_signed_out` (NOT EXISTS valid refresh_tokens).
- `sign_out_session(p_session_id uuid)` — UPDATE `auth.refresh_tokens` SET `revoked = true` WHERE `session_id = p_session_id` AND the session belongs to the calling user.
- `delete_user_session(p_session_id uuid)` — DELETE FROM `auth.sessions` WHERE id matches AND user_id matches (cascades to refresh_tokens).

Every function re-checks `auth.uid() = sessions.user_id` so a forged session_id can't touch someone else's data. Errors are identical for "not found" vs "not yours" to avoid leaking existence.

### Tiny inline UA parser — `lib/user-agent.ts`

~80 lines of regex covering the device classes and browsers we actually see. Returns `{ device, browser, label, glyph }`. Order of detection matters (Edge UA contains "Chrome", Chrome UA contains "Safari", etc) — comments in the file explain why.

Avoided `ua-parser-js` (~30KB minzipped) for a narrow surface. If our coverage gets worse over time, swap to the library.

### Files touched

- `supabase/migrations/0025_session_management.sql` (new)
- `lib/user-agent.ts` (new)
- `app/(app)/settings/devices/page.tsx` (new — server wrapper)
- `components/devices-shell.tsx` (new — client UI)
- `app/actions/auth.ts` — `signOut()` scope flip + `signOutOtherDevices`, `signOutDeviceSession`, `deleteDeviceSession`
- `app/(app)/settings/page.tsx` — new RowLink + Smartphone icon import
- `lib/supabase/database.types.ts` — three new RPCs
- `lib/i18n/dictionaries.ts` — Devices strings
- `lib/changelog.ts` — v1.30.0 entry
- Version bumps in `package.json`, `public/sw.js`, settings footer

---

## v1.29.0 - May 15, 2026

Follow-up to v1.28.0 — split the two changelog views onto two separate routes instead of using a tab switcher.

### Why

v1.28.0 put User / Developer tabs inside `/settings/updates`. The user wanted devs to see the **same** page users see (no extra dev tab on it), and a separate dedicated entry under the Developer group for the technical breakdown. Cleaner mental model: one route, one audience.

### What shipped

- **`/settings/updates`** is now user-only. Renamed in the UI to **"Version Updates"**. Everyone — including devs — sees the same plain-language release notes. Still lives under Settings → Support.
- **`/settings/dev-changelog`** is new. Lives under Settings → Developer (only visible to `is_developer` accounts; `notFound()` if a non-dev navigates to the URL directly). Shows the technical breakdown.
- **`components/updates-shell.tsx`** no longer renders a tab switcher. Now takes a `view: 'user' | 'dev'` prop + explicit `title`. The two routes pass their own props and the shell stays presentation-only.
- **i18n**: `settings.updates` → "Version Updates" / "Pembaruan Versi". New key `settings.devChangelog` → "Dev Changelog" / "Changelog Developer".

### Files touched

- `components/updates-shell.tsx` — tab-switcher removed, accepts `view` + `title` props
- `app/(app)/settings/updates/page.tsx` — server wrapper, always passes `view="user"` + the i18n title
- `app/(app)/settings/dev-changelog/page.tsx` — new, gated on `is_developer`, passes `view="dev"`
- `app/(app)/settings/page.tsx` — RowLink for the Dev Changelog added to the Developer group
- `lib/i18n/dictionaries.ts` — label rename + new key
- `lib/changelog.ts` — v1.29.0 entry
- Version bumps in `package.json`, `public/sw.js`, settings footer

---

## v1.28.0 - May 15, 2026

Two things — a UX split for the in-app changelog, and a fix for the cut-off Add Transaction button.

### 1. Updates page — User vs Developer tabs

User feedback was that the Updates page (Settings → Updates) was reading too technical: migration numbers, RPC names, RLS notes, file paths. Non-developers don't care. Split the changelog by audience.

**Schema change** in `lib/changelog.ts`:

```ts
export type Audience = "user" | "dev" | "all";

export type ChangeEntry = {
  type: "new" | "fix" | "improvement";
  audience?: Audience;   // ← new, defaults to "all"
  en: string;
  id: string;
};
```

- `audience: "user"` — plain-language note focused on what the user can DO differently.
- `audience: "dev"`  — technical note (migrations, RPCs, file paths). Hidden from non-devs.
- `audience: "all"` (default for legacy entries) — shows on both tabs. Backwards-compatible so older versions don't have to be retroactively re-tagged.

**Page restructure:**

`app/(app)/settings/updates/page.tsx` is now a Server Component that reads `is_developer` from the session and passes `showDevTab` to a new client shell. The shell `components/updates-shell.tsx` renders the tab switcher (only when `showDevTab=true` — non-devs see no tabs, just the User view).

Each tab filters `CHANGELOG` by `audience`. Version blocks whose visible changes after filter are empty get dropped, so the User tab doesn't show empty cards for releases that were purely infrastructural.

**Content pass:**

Re-tagged the last 5 releases (v1.24.0 → v1.28.0) with explicit `audience` values. User-tab entries follow the rule: explain new features with what-the-user-can-do framing; for bug fixes use one short sentence focused on the user benefit ("Fixed Add Transaction button being cut off"). Dev-tab entries keep the existing technical voice.

Older entries (v1.23.x and below) untouched — they default to `audience: "all"` and show on both tabs. Mostly fine as-is, no value spending time rewriting history.

### 2. Add Transaction button cutoff — fixed

Reported on Android Chrome PWA (visible in the user's screenshot — the orange "Add Transaction" button was half-clipped at the bottom edge of the screen).

Root cause: the sheet uses `height: 100lvh` (LARGE viewport). On Android Chrome PWA standalone, `lvh` extends past the gesture-nav strip, pushing the sheet's footer below the visible chrome zone. `env(safe-area-inset-bottom)` reports 0 on this device class so the existing padding floor of 12px wasn't enough to clear it.

Fix in `components/add-transaction-sheet.tsx` and `components/add-recurring-sheet.tsx`:

```diff
- height: "100lvh"
+ height: "100dvh"

- paddingBottom: "max(12px, env(safe-area-inset-bottom))"
+ paddingBottom: "max(20px, env(safe-area-inset-bottom))"
```

`100dvh` (dynamic viewport) tracks the live visible height, so the sheet never extends past visible chrome. The padding bump from 12 → 20px gives extra clearance under gesture-nav strips on devices where `safe-area-inset-bottom` is 0.

The historical reason we chose `100lvh` was the v1.20-era iOS PWA "cream-strip" bug, which only affected bottom-anchored `position: fixed` sheets. This sheet is top-anchored with explicit height, so switching to `dvh` doesn't reintroduce that issue.

### Files touched

- `app/(app)/settings/updates/page.tsx` (rewritten as Server Component)
- `components/updates-shell.tsx` (new — client shell with tab switcher)
- `lib/changelog.ts` (Audience type + re-tagged v1.24.0–v1.27.0 + v1.28.0 entries)
- `components/add-transaction-sheet.tsx` (`100dvh` + footer padding bump)
- `components/add-recurring-sheet.tsx` (same)
- `lib/i18n/dictionaries.ts` (tab labels + empty state)
- Version bumps + cache name

---

## v1.27.0 - May 15, 2026

Four things from the v1.26.0 review.

### 1. Per-household AI language

Auto-detection in Flash-Lite trips on Indonesian phrases that look English-ish ("Babi Cincang" → "Baby Needs" instead of pork → Groceries). New per-household setting tells the AI explicitly.

- Migration `0024_household_ai_language.sql` adds `households.ai_language text not null default 'auto' check (ai_language in ('auto','en','id'))`.
- New action `setHouseholdAiLanguage` in `app/actions/households.ts` (member-gated via existing household RLS).
- `lib/llm/gemini.ts` accepts a `language` arg and prepends a one-line instruction to the prompt when set: for `id` we add *"The description is in Bahasa Indonesia. Do NOT translate Indonesian words as if they were English (e.g. 'babi' means pork, not baby)."* — surgical and cheap (~25 input tokens extra per miss).
- `app/actions/ai.ts` reads the household's `ai_language` alongside categories in one parallel query, passes it through to `categorize`.
- New picker at `/settings/ai-language` (Auto-detect / English / Indonesian, three rows, same Check-on-selected pattern as `/settings/language`).
- New RowLink in the Household section of Settings shows current selection.

Takes effect on the next AI call. Cache hits don't use it — once a hint is stored, the language hint was already applied at first miss.

### 2. AI Settings: usage vs free-tier limits

Replaced the static "limits" cells with three progress bars that show live `used / limit` numbers:

```
RPM    7 / 15              47%
████████░░░░░░░░░░
Requests in the last 1 min

RPD    312 / 1,000         31%
█████░░░░░░░░░░░░░
Requests in the last 24 hr

TPM    1.4K / 250K          1%
░░░░░░░░░░░░░░░░░░
Input tokens in the last 1 min
```

Bar color shifts at 75% (amber) and 90% (rose) so you get a visual nudge before hitting Google's caps.

New SECURITY DEFINER RPC `api_usage_recent_window()` returns the four numbers in one round-trip (last-1-min count, last-24h count, last-1-min input-tokens sum, last-1-min error count). Page fetches it in parallel with the chart data.

### 3. Token in / out split

The previous Tokens mini-stat was just a single number (e.g. "1.4K"). Updated to show the breakdown:

```
TOKENS
1.4K
1.2K in · 200 out
```

Useful because Google charges **4×** more for output tokens ($0.10 input vs $0.40 output per 1M). Knowing the proportion makes the cost number make sense.

Server-side aggregation in `app/(app)/settings/ai-admin/page.tsx` now sums `input_tokens` and `output_tokens` separately into the totals object.

### 4. 20-ledger cap per owner

Sanity ceiling on owned ledgers. Silent until you hit it; on attempt to create the 21st you get a clear error:

> *You've reached the limit of 20 ledgers. Delete one to create a new ledger.*

Implementation in `createNewLedger` (the action used when you tap "Create new ledger" from the ledger switcher). One indexed `COUNT()` query on `households` WHERE `owner_id = auth.uid()`. Joining someone else's household doesn't count against the cap — you didn't create it.

Initial onboarding (`createHousehold` in `app/actions/auth.ts`) is not guarded since you can't be at the cap if you're onboarding.

---

## v1.26.0 - May 15, 2026

AI dev-panel polish + a real fix for the iOS background scroll bleed.

### 1. AI Settings restructured

The single-page panel in v1.25.0 mixed read-only stats (usage, cost, hit rate) with destructive actions (Save key, Clear key). One stray tap on Clear in the middle of glancing at stats would wipe the key. Split it:

- `/settings/ai-admin` — read-only now. RowLink to the key page with a status pill (Configured / Not set), free-tier limits card, daily usage chart with range selector, headline + mini stats.
- `/settings/ai-admin/key` — new sub-page. Holds the API key input, Test Connection, and the Clear button. Clear now lives in a "Danger zone" section below the main form with a **two-tap confirmation**: first tap arms the button (turns red, label flips to "Tap again to clear"), auto-cancels after 3 s if you walk away. Same pattern as the promo-code delete.

Files: `app/(app)/settings/ai-admin/page.tsx` (rewritten, server-side aggregation + day bucketing), `app/(app)/settings/ai-admin/key/page.tsx` (new), `components/ai-admin-shell.tsx` (rewritten), `components/ai-key-form.tsx` (new).

### 2. Free-tier limits card

Hard-coded reference panel matching Google's published rate-limit dashboard for `gemini-2.5-flash-lite`:

| | Limit |
|---|---|
| RPM (requests/min) | 15 |
| RPD (requests/day) | 1,000 |
| TPM (tokens/min) | 250K |

These are the **free-tier** caps. Enabling billing on the Google Cloud project unlocks Tier 1 (4,000 RPM, no daily cap, 4M TPM). If Google updates the numbers, edit `FREE_TIER_LIMITS` in `components/ai-admin-shell.tsx`.

### 3. Daily usage chart

Recharts stacked `BarChart` with two metric tabs (`Calls` / `Tokens`) and a range selector (`7d` / `28d` / `90d`, default `28d`).

- **Calls** view: three stacks per day — green for cache hits, orange for AI calls (misses), red for errors. The cache layer's success is visible at a glance: a tall green bar with a sliver of orange is the steady state we want.
- **Tokens** view: single blue bar per day, raw token count. Useful when calls are sparse but individually large.

Server-side aggregation in `page.tsx`:
- Window is computed from `?range=7d|28d|90d` (default 28d).
- Pulls all matching rows from `api_usage_logs`, buckets them by UTC date in JS (so empty days are zero-padded — Recharts requires a row per day or the X-axis goes uneven).
- Totals (cost / hit-rate / calls / tokens / hits / misses / errors) summed once and passed as a separate object so the headline doesn't have to re-sum the array client-side.

Range selector updates the URL with `router.replace` so the chosen range survives a soft refresh.

### 4. iOS background scroll bleed — fixed

The Add Transaction sheet (and Add Recurring sheet) had a long-standing bug on iOS PWA standalone: when the keyboard was up and you scrolled the sheet to the bottom, momentum-scroll would bleed through to the page underneath. Right-edge swipes occasionally triggered the same thing.

Old approach (v1.21–v1.25): `overflow:hidden` + `touch-action:none` on html/body, plus a `touchmove` preventDefault handler. Worked for most cases, but iOS's `-webkit-overflow-scrolling` momentum still leaked through `overflow:hidden`.

New approach (v1.26.0): same as before **plus** `position:fixed` on body with `top:-scrollY` so there's literally no scrollable surface underneath the sheet. The previous concern about this — the v1.20-era "cream-strip" bug, where a bottom-anchored fixed sheet would re-anchor to a collapsed body — doesn't apply anymore because the sheets are now top-anchored with explicit `height:100lvh`.

Both sheets save `window.scrollY` on open and call `scrollTo(0, scrollY)` on close so the underlying page doesn't snap to top.

Pattern (in both `add-transaction-sheet.tsx` and `add-recurring-sheet.tsx`):

```ts
const scrollY = window.scrollY;
body.style.position = "fixed";
body.style.top = `-${scrollY}px`;
body.style.width = "100%";
body.style.overscrollBehavior = "none";
// ... on close ...
window.scrollTo(0, scrollY);
```

### Files touched

`app/(app)/settings/ai-admin/page.tsx`, `app/(app)/settings/ai-admin/key/page.tsx` (new), `components/ai-admin-shell.tsx`, `components/ai-key-form.tsx` (new), `components/add-transaction-sheet.tsx`, `components/add-recurring-sheet.tsx`, `lib/i18n/dictionaries.ts`, `lib/changelog.ts`, version bumps in `package.json`, `public/sw.js`, `app/(app)/settings/page.tsx`.

---

## v1.25.0 - May 15, 2026

AI auto-categorization. The big feature from the v1.24.0 handoff plus a smart cache layer that turns most lookups into a single indexed Postgres query.

### Why a cache layer

Original brief: every transaction description → Gemini call. Gemini Flash-Lite free tier is 1,500 requests/day, which sounds generous until you imagine a household with several active members.

Inverted the flow:

```
description → normalise → category_hints lookup
                  ├── HIT  → return category, 0 tokens, ~10ms
                  └── MISS → Gemini call → INSERT hint → return
```

After the first time anyone types "Paracetamol", the household's cache permanently associates it with the chosen category. Member-wide learning, zero per-keystroke tokens for repeat transactions, and Gemini stays inside the free tier even for active families.

### What shipped

**Migration `0023_ai_categorization.sql`:**
- `category_hints (household_id, keyword, category_id, source, hits, updated_at)` — PK on `(household_id, keyword)`, FK cascades on both category and household deletion. RLS: members of the household have full CRUD via `current_household_id()`.
- `api_usage_logs` — one row per LLM call. Columns: provider, model, input/output tokens (with a generated `total_tokens` column), `estimated_cost_usd`, `feature`, `cache_status` enum (`miss`|`hit`|`error`), truncated `preview`. RLS: developer-only SELECT.
- `app_settings (key, value, updated_at, updated_by)` — single-row key/value for the Gemini API key. RLS: developer-only SELECT/UPDATE.
- RPCs: `log_api_usage` (auth-gated INSERT into `api_usage_logs`), `save_app_setting` (developer-only UPSERT into `app_settings`), `clear_category_hints` (developer-only wipe for the current household), `seed_default_category_hints` (idempotent bilingual seeding per household).
- Trigger `zz_seed_default_category_hints` on `households` AFTER INSERT runs the seed function — fires after the existing `seed_default_categories` trigger so the categories exist when we look them up by name.
- One-shot backfill at the bottom of the migration seeds existing households.

**Bilingual seed list (~250 keywords across 10 default categories):** Food & Drink, Transport, Housing, Health, Shopping, Entertainment, Education, Salary, Bonus, Reimburse. English + Bahasa where it matters (e.g. `bensin` → Transport, `apotek` → Health, `belanja` → Food & Drink). Other is intentionally NOT seeded so it acts as a real catch-all.

**Server-only LLM service:**
- `lib/llm/normalize.ts` — lowercase, strip noisy punctuation, drop trailing units (`mg`, `ml`, etc), tokenize. Exports `candidateKeys(desc)` (ordered list of cache lookup candidates, longest-first) and `canonicalKey(desc)` (single key for storage after a miss).
- `lib/llm/gemini.ts` — Gemini Flash-Lite REST wrapper. Reads `gemini_api_key` from `app_settings` server-side; never touches the client. 6s timeout via `AbortController`, 30-token output cap, deterministic `temperature: 0.0` so the same description always returns the same category. Logs every call to `api_usage_logs` (including hits via `logCacheHit`).
- `lib/llm/pricing.ts` — per-model `$/1M tokens` table for cost estimates. Falls back to 0 for unknown models.

**Server actions in `app/actions/ai.ts`:**
- `suggestCategory(description, type)` — runs the candidate-keys lookup, then falls through to Gemini on miss. Inserts the canonical hint after a successful AI answer so the next call is a hit. Filters category candidates to the user's selected `income`/`expense` type so we never suggest an expense category for an income transaction.
- `recordCategoryUsage(description, categoryId)` — called from the save handler. Upserts the hint with `source='user'`, so the cache learns the user's actual choice (passive correction learning, no extra AI call).
- `saveGeminiKey`, `clearGeminiKey`, `testGeminiConnection` — developer-only, route via `save_app_setting` RPC.

**Add Transaction wiring (`components/add-transaction-sheet.tsx`):**
- 600ms-debounced effect on the description field calls `suggestCategory`. Only fires for new (non-editing, non-transfer) entries.
- `userTouchedCategory` flag prevents the AI from clobbering a manual pick.
- Category button shows a `Sparkles` icon when the current selection came from AI, and a spinning `Loader2` while the suggestion is in-flight.
- On save, `recordCategoryUsage` fires-and-forgets to teach the cache.

**Dev panel — `/settings/ai-admin`:**
- API key input (masked), Save, Clear, Test Connection.
- This-month usage rollup: cache hit rate (headline), cost (USD), calls, tokens, AI calls vs. hits vs. errors.
- New `RowLink` to it under the Developer group in Settings.

### Required after deploy

The Gemini API key isn't in the repo. After this PR is merged and deployed, go to **Settings → Developer → AI Settings** and paste your key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey). Until a key is set, the suggestion silently no-ops — users can still pick categories manually.

### Trade-offs

- **Wrong cache state on category rename**: if you rename a default category, hints pointing to it still work (FK is by id, not name). If you DELETE a default category, `ON DELETE CASCADE` cleans up its hints automatically.
- **Custom categories pay a warm-up cost**: new categories start with zero hints. After 5-15 transactions the AI fills them in. No special UI needed.
- **`preview` column stores truncated descriptions**: max 80 chars, only the first part of the description. Useful for debugging stale cache mappings; tolerable from a privacy standpoint since household members can already see each other's transactions.

---

## v1.24.0 - May 15, 2026

UX polish + small auth probe. Five themes:

### 1. Login page redesigned — `/login` becomes a landing

Before: one page with a Google button on top, an email/password form, and a sign-up link below. Three competing paths for new users to parse.

After:
- `/login` is now a landing with two CTAs — `Continue with Google` (primary) and `Sign up` (secondary, links to `/signup`) — plus a small "Already have an account? Sign in" link.
- The email/password sign-in form moved to a new `/login/password` route.
- Middleware needs no changes — `PUBLIC_ROUTES` uses `startsWith("/login")` so `/login/password` is already allowed.

Files: `app/(auth)/login/page.tsx` (rewritten as landing), `app/(auth)/login/password/page.tsx` (new, holds the old form).

### 2. Unified Add Transaction ↔ Recurring

The big workflow change. Before, the only way to create a recurring rule was via the separate Recurring tab.

Now in `components/add-transaction-sheet.tsx`:
- A `Repeat` icon sits beside the date row on new (non-transfer) entries.
- Tapping it morphs the form into recurring-create mode: Frequency (Weekly/Monthly/Yearly), Starting date (using the existing date field with a relabel hint), and Repeat until (Forever / On date).
- Photo upload is hidden in recurring mode — a single template can't carry a single photo for many future occurrences.
- Save calls `addRecurringItem` instead of `addTransaction`. The existing post-save "Add as recurring" affordance for editing stays as-is.
- `app/actions/recurring.ts` now also accepts and stores `wallet_id` (the column existed but the action was ignoring it), so recurring rules created from this form remember the user's wallet choice.

### 3. Promo codes — label + redeemer email

Migration `0022_promo_code_label.sql`:
- `alter table promo_codes add column label text`
- Drop + recreate `generate_promo_code(p_tier, p_label default null)` since the return type widens to include `label`.

App side:
- `DbPromoCode.label` added.
- `generatePromoCode` action accepts an optional `label` string (trimmed + empty-to-null normalised before the RPC).
- The `/settings/promo-codes` query now joins `email` on the redeemer.
- `PromoCodesShell` adds a Name input above the Generate button and renders the label inline under each code + the redeemer's email when redeemed.

### 4. Random-logout investigation — logging

We don't have a confirmed repro yet. Added a passive client-side breadcrumb so the next bounce shows up in Vercel logs:
- New `/api/auth-log` POST route — receives `fromPath`, `isStandalone`, `hiddenMs`, `note`; logs single-line JSON with `[auth-log]` prefix.
- The new `/login` landing fires `navigator.sendBeacon` to that endpoint when the referrer is an authenticated path (i.e. unexpected bounce, not a manual sign-out).
- Will be removed once we identify and fix the root cause.

Code review of the auth path (no fixes shipped — none confirmed broken):
- `lib/auth/session.ts` is correctly React.cache-wrapped (v1.23.0 baseline).
- `lib/supabase/middleware.ts` calls `getSession()` (auto-refreshes) and pushes cookies back via `setAll`. Matches the Supabase SSR template verbatim.
- `lib/supabase/server.ts` swallows write attempts from Server Components — that's the documented pattern; middleware is the canonical writer.

### 5. Confirmed-already-done

- **Sticky Income / Expense / Transfer tabs** — already in place. The tabs sit in a `shrink-0` block above the `flex-1 overflow-y-auto` scroll container in `components/add-transaction-sheet.tsx`, so they don't scroll away.
- **Auto-focus amount + numeric keypad** — already in place (lines 79–85, `useEffect` + `requestAnimationFrame` on `amountRef`). If it feels flaky on iOS PWA the next step is to investigate the gesture-context timing, but no code change today.

---

## v1.23.1 - May 14, 2026

Total Balance card on the transactions page simplified — removed the small wallet glyph next to the label, switched the card to `text-center` so the uppercase TOTAL BALANCE label and the 28px amount both sit centered. Reads as the headline number now rather than a sibling of the Income/Expense pills below. The Income / Expense cards still use their left-aligned icon + label pattern; only the headline changed.

`components/balance-card.tsx` — 12 lines net delete (dropped the icon wrapper, the flex container around the label, and the unused `Wallet` import).

---

## v1.23.0 - May 14, 2026

Performance + auth-stability sweep. First half of the audit's top-2 priorities (PR B); the RLS init-plan migration (PR A) is deferred to v1.23.1 — Supabase MCP was down at ship time so I couldn't safely verify each policy's live state before rewriting.

### Closed the auth race for good

Before:
- `(app)/layout.tsx` called `getServerT()` which called `supabase.auth.getUser()`.
- Each page underneath the layout also called `supabase.auth.getUser()` directly.
- When the JWT was near expiry, Supabase would refresh during the first call (rotating the refresh token). Cookie writes from a Server Component are silently swallowed by `lib/supabase/server.ts`'s `try/catch`. The second call then sent the now-invalidated refresh token, Supabase returned `user: null`, middleware redirected to /login on the next navigation.
- v1.18.1 fixed only the layout's duplicate; pages were still vulnerable.

After:
- New `lib/auth/session.ts` exports `getSession()` and `requireSession()`, both wrapped in React's `cache()` so calls in the same server request share one resolution.
- `getServerT()` is now a thin wrapper over `getSession()`.
- Every page in `(app)/*` plus `app/auth/setup` was refactored to call `requireSession()` instead of `createClient` + `auth.getUser` + ad-hoc profile fetch.
- Result: exactly **one** `auth.getUser()` and **one** `profiles` SELECT per page render, no matter how many components ask for the session.

Files touched: `lib/auth/session.ts` (new), `lib/i18n/server.ts`, `app/(app)/layout.tsx`, `app/(app)/settings/page.tsx`, `app/(app)/settings/categories/page.tsx`, `app/(app)/settings/wallets/page.tsx`, `app/(app)/settings/edit-profile/page.tsx`, `app/(app)/settings/members/page.tsx`, `app/(app)/settings/feedback-admin/page.tsx`, `app/(app)/settings/help/page.tsx`, `app/(app)/settings/promo-codes/page.tsx`, `app/(app)/design-system/page.tsx`, `app/(app)/transactions/page.tsx`, `app/(app)/reports/page.tsx`, `app/auth/setup/page.tsx`.

Server actions and API route handlers are untouched — they're single-entry-point per request, so `auth.getUser()` already runs exactly once there.

### Fixed: recurring items missing on first page load

`app/(app)/transactions/page.tsx:104` had `await supabase.rpc(...).then(({error}) => …)` — the `.then` resolves immediately (returns `undefined`), so the outer `await` returned before the RPC actually completed. The page could render before recurring rows were materialised. Now awaits the `rpc()` directly. Audit P0 #5 fixed.

### Cleaner script tag in root layout

`app/layout.tsx`: replaced the bare `<script dangerouslySetInnerHTML>` with `<Script id="homu-theme-bootstrap" strategy="beforeInteractive">` from `next/script`, and added `suppressHydrationWarning` to `<html>`. Fixes two Next.js 16 console warnings (the "scripts in React components are never executed" warning and the hydration mismatch on `data-theme`).

### What's still on the audit punch list

Not done in v1.23.0, but should follow:
- **v1.23.1 — RLS init-plan migration** (`0022_rls_initplan_sweep.sql`): wrap `auth.uid()` and `public.current_household_id()` in `(select …)` across the 14 policies the advisor still flags. Deferred because Supabase MCP was unreachable at ship time and I couldn't verify each policy's live USING/WITH CHECK expression safely.
- **Sheet migration** to `components/ui/sheet.tsx` — ~400 LOC of duplication still in place.
- Feedback admin cross-household author rendering.
- Auth checks in feedback + wallet server actions.
- Splash + manifest dark-mode contrast.
- Parallelise feedback attachment signing.
- Populate `next.config.ts` (image domains, optimizePackageImports, security headers).

---

## v1.22.0 - May 14, 2026

### Continue with Google

Sign in / sign up via Google OAuth, no email + password to remember.

**Flow:**
1. Tap "Continue with Google" on `/login` or `/signup`.
2. Supabase opens the Google consent screen, then redirects back to a new `app/auth/callback/route.ts` handler.
3. Callback exchanges the code for a session, looks up the profile, and routes:
   - No `username` → `/auth/setup` (pick username + optional promo)
   - Has username but no household → `/onboarding`
   - Has both → `/transactions`

**`/auth/setup` page:** username (required, 3–20 chars, lowercase + digits + underscores) plus an optional disclosure for a HOMU promo code. Name + initials are pre-filled from Google's `full_name` metadata, falling back to the email local-part.

**Free tier introduced:** skipping the promo on `/auth/setup` lands you on the free tier — `subscription_tier` stays NULL, no PRO badge, but otherwise full app. Existing PRO-badge / welcome-modal logic already handles null gracefully.

**New files:**
- `app/auth/callback/route.ts` — OAuth code exchange + routing
- `app/auth/setup/page.tsx` — server component that auth-gates + pre-fills
- `app/auth/setup/setup-form.tsx` — client form
- `app/auth/layout.tsx` — mirrors the (auth) group chrome
- `components/google-sign-in-button.tsx` — reusable button with inline multi-colour G glyph

**Modified:**
- `app/(auth)/login/page.tsx` + `app/(auth)/signup/page.tsx` — Google button at top of each form, "or" divider, suspense for the new `useSearchParams()` reading `?oauth_error=…`
- `app/actions/auth.ts` — new `completeGoogleProfile(formData)` server action. Validates username uniqueness, optionally redeems the promo, upserts the profile, redirects to `/onboarding`
- `lib/supabase/middleware.ts` — `/auth/callback` is always passthrough (session-less and session-holding both allowed, no auto-redirect); `/auth/setup` requires session but isn't bounced to `/transactions`
- `lib/i18n/server.ts` — `getServerT()` now also returns `username` and `hasHousehold` so the (app) layout can gate users mid-setup
- `app/(app)/layout.tsx` — defense in depth: if `username === null` for a signed-in user, bounce to `/auth/setup`
- `lib/i18n/dictionaries.ts` — 12 new keys (`auth.continueWithGoogle`, `auth.almostThere`, `auth.pickUsernameSub`, `auth.usernameHint`, `auth.promoCodeOptional`, `auth.promoCodeHintOptional`, `auth.haveAPromoCode`, `auth.saving`, `auth.continue`, `auth.redirecting`, `auth.or`, …), both EN and ID

**Manual config required before this can work in prod / preview:**

1. **Google Cloud Console** — create an OAuth 2.0 Web client. Authorized redirect URI must be `https://qunbbkptumtzgzzwnszy.supabase.co/auth/v1/callback`.
2. **Supabase dashboard** — Authentication → Providers → Google → enable, paste Client ID + Secret.
3. **Supabase dashboard** — Authentication → URL Configuration → Site URL `https://homu.ramu.app`, allow-listed Redirect URLs include `https://homu.ramu.app/auth/callback` (and `http://localhost:3000/auth/callback` for local dev).

Until those are done the button will return a Supabase error and route to `/login?oauth_error=…`.

### Hotfix included — background-scroll while sheet open

Folded in the previously-unmerged v1.21.2 fix: pull-to-refresh was firing on touches inside open sheets and pushing the page content underneath downward, which read as "the background is scrolling." `components/pull-to-refresh.tsx` now bails when `document.body.style.overflow === "hidden"` (the universal "modal is open" signal every sheet in this codebase sets).

---

## v1.21.1 - May 13, 2026

Three follow-up tweaks to v1.21.0's Add Transaction / Add Recurring sheet changes.

### Wallet logo on the wallet row

After v1.21.0 stripped the "Wallet" label above the wallet picker row, the row read as info ("Marcel's") rather than as a tappable selector. Added a 18px Lucide `Wallet` glyph at the left edge of the row, themed `--label-secondary` so it sits subtly. The user's per-wallet color/icon badge still appears after it, and the chevron-right is still at the right — together they unambiguously communicate "tap to switch wallets". Same treatment applied to the From / To pickers in Transfer mode.

### Amount input top-cutoff fix

The Amount input is the first element inside the scrollable form area, and its 1px `ring-1` shadow was being clipped by the scroll container's `overflow-hidden` boundary at the top — visible as a thin gap at the input's top edge in dark mode. Added `pt-1` to the scroll container so the ring has 4px of breathing room.

### Stronger background-scroll lock

v1.21.0 still let the page underneath be scrolled in some cases (likely iOS PWA standalone with rapid pan gestures). Added `document.documentElement.style.touchAction = "none"` to the existing `overflow: hidden` + `touchmove` guard. iOS now rejects pan gestures at the root before they can bubble to body — the sheet itself still scrolls via its own `pan-y` + `overflow-y-auto` inside the `data-scroll` container, so this doesn't break anything in-sheet. Restored on close.

Same lock strengthening applied to both AddTransactionSheet and AddRecurringSheet.

---

## v1.21.0 - May 13, 2026

### Add Transaction / Add Recurring sheet polish

Three coordinated changes to the data-entry sheets.

**1. Locked type tabs at top of the sheet.** Previously the Expense / Income / Transfer pill lived inside the scrollable form area, so it scrolled away with the fields. Moved out of the `data-scroll` flex item and into a non-scrolling `shrink-0` band immediately under the sheet header, so it stays reachable while the user scrolls through Amount → Wallet → Description → Category → Date → Photo.

Same treatment for the Expense / Income pill at the top of AddRecurringSheet.

**2. Auto-focus the Amount input on open** (new entries only). When the user taps the `+` FAB, the sheet slides in and the Amount input takes focus, so iOS pops the numeric keyboard immediately — one tap shorter to enter a transaction.

Implementation: the sheet is always mounted (slides in/out via `translate-y`), so `amountRef.current` exists by the time `open` flips true. A `useEffect` schedules `amountRef.current?.focus()` via `requestAnimationFrame` to keep the focus call within the same tick as the open transition. Skipped when editing (the form is pre-filled and the user is reviewing, not typing fresh data).

**3. Removed redundant field labels above every input.** The "Amount (IDR)", "Wallet", "Description", "Category", "Date", "Photo" labels were duplicating information already conveyed by the placeholders, the input's content, or the visible icon — so they went. The Amount input now carries `Amount (IDR)` as a 15px placeholder (smaller than the 24px input value) so the currency hint is still visible until the user types. `aria-label` set on every input/button so screen readers still announce the same name.

Knock-on win: the form packs noticeably tighter (16px → 12px gaps between fields, no 24px label-row consumed per input). The Description field ends up high enough on screen that when iOS pops the keyboard to type it, the page doesn't have to scroll up much to keep the field visible — fixes the "screen pushed up a lot" feel.

For Transfer mode, the From / To labels are kept inside the wallet picker text (e.g. "From: Marcel's") to keep the two rows distinguishable.

---

## v1.20.0 - May 13, 2026

### Bento Total Balance on the Transactions page

Previously: a hero-style centered 40px Total Balance number, then a 2-col bento grid of Income / Expense cards below. The Total Balance felt like a different visual language from the cards underneath.

Now: Total Balance is a **full-width bento card** with the same chrome (`SurfaceCard`, `--shadow-card`, `--ring-subtle`) as the Income/Expense pair, with a Wallet icon chip + uppercase label, sized at 28px. All three cards read as one stacked set.

Side benefits:
- Income/Expense icon tints now use `--tint-success-bg/text` and `--tint-warning-bg/text` from the design system instead of the hardcoded `bg-emerald-100/70 / bg-amber-100/70` tone — they auto-adapt to dark mode.
- Negative balance color now uses `--color-expense` instead of `text-rose-600` for consistency with the rest of the finance UI.

### Sticky Expense/Income tabs on Categories

`components/categories-shell.tsx` wraps the header + tab pill in one sticky band so the Expense/Income switcher stays pinned to the top while scrolling the category list. Previously the tab pill was below the sticky header and scrolled away with the list.

### Icon-style page contrast + confirmation sheet

`app/(app)/settings/style/page.tsx`:

- **Contrast fix.** The selected card uses `bg-[var(--foreground)]` (cream in dark mode), but every text and icon inside was hardcoded to white — so dark mode showed white-on-cream and was unreadable. Swapped `text-white` / `color="white"` / `bg-white/10` to `text-[var(--on-foreground)]` / `var(--on-foreground)` / `bg-[var(--on-foreground)]/10` so contrast works in both modes (this completes the v1.17.1 `--on-foreground` sweep).
- **Confirmation sheet.** Tapping a style no longer immediately saves. Opens a `<Sheet>` (design-system primitive) with a live preview, description, and Cancel / Apply buttons. Always confirms — including when picking the currently-saved style — per spec.

### Ledger symbol: Default / Custom subtabs

`app/(app)/settings/symbol/page.tsx`:

Previously: 40-emoji grid + a small "or type your own" input shoved at the bottom of the page.

Now: a `<FilterTabs>` switcher with two tabs.
- **Default** — the existing 40-emoji grid, unchanged.
- **Custom** — a 32×28px live-preview card showing whatever the user is typing, a centered 28px emoji input, a one-line hint, and a primary `<Button>` to apply. Reads as a real feature, not an afterthought.

### Internal

- New code in this release uses the v1.19.0 design-system primitives (`SurfaceCard`, `Sheet`, `Button`, `FilterTabs`) where they fit, instead of hand-rolling. Existing pages are still on their original markup.

---

## v1.19.0 - May 13, 2026

### DesignSystem catalog (dev-only)

New developer-only page at `/design-system` (linked from Settings → Developer → DesignSystem). Replaces the "60% of a design system, mostly hand-rolled" state with a single live catalog you can scrub.

**What's in it:**

- **Token editor.** Every CSS custom property from `globals.css` shows up as a row in `lib/design-tokens.ts`. Each row renders a visual preview (swatch / shadow box / radius square / typography specimen / spacing bar) + the appropriate input (color picker + hex input for hex colors, textarea for shadows, number input for z-index/motion scalars, text input for everything else).
- **Per-mode editing.** Auto / Light / Dark tab at the top forces the visible mode while you edit; whichever you're viewing is the mode your edits affect. Shared (non-theme) tokens (radii, type, spacing, z-index, motion) are tagged "shared" and edited once.
- **Live preview via localStorage.** Changes write to `homu-design-overrides` and inline-set CSS variables on `<html>`. The bootstrap script in `app/layout.tsx` re-applies overrides before first paint of *every page in the app*, so the rest of the app re-themes the moment you tweak a value.
- **Copy CSS button** (top-right of the header). Serializes the current overrides into a `:root { … }` + `[data-theme="dark"] { … }` block and copies it to your clipboard. Paste into `app/globals.css` and commit when you like a config.
- **Reset all** clears every override in one shot.
- **Primitives gallery** at the bottom — interactive demos of Button (primary/secondary/danger × default/sm), Chip (selected/unselected × default/sm), StatusPill (success/warning/info/danger), SurfaceCard (card/float elevation), Input/Textarea, EmptyState, Avatar (sm/md/lg), FilterTabs, and Sheet (tap to open). Demos update live as you change tokens.

### New tokens

Added to `globals.css` (with light + dark counterparts):

- **Rings:** `--ring-subtle`, `--ring-default`, `--ring-strong` (replace ad-hoc `ring-black/[0.04]` etc.)
- **Status tints:** `--tint-{success,warning,info,danger}-{bg,text}` (replace `bg-emerald-100/80 text-emerald-800` and friends)
- **Finance:** `--color-income`, `--color-expense`
- **Shadows:** `--shadow-card`, `--shadow-float`, `--shadow-sheet`
- **Radii:** `--radius-{sm,md,lg,xl,2xl,pill}`
- **Typography:** `--text-{xs,sm,md,base,lg,xl,2xl}`
- **Spacing:** `--space-page-x`, `--space-row-x/y`, `--space-section-y`, `--gap-{tight,default,loose}`
- **Z-index:** `--z-{header,shield,fab,sheet-overlay,sheet-content,toast}`
- **Motion:** `--press-scale`, `--transition-{fast,base}`

### New components

In `components/ui/`:

- `<Button variant="primary|secondary|danger" size="default|sm" full />`
- `<Chip selected size />`
- `<StatusPill tone="success|warning|info|danger" />`
- `<SurfaceCard elevation="card|float" as />`
- `<Sheet open onClose title>` — overlay + slide-up + scroll-lock + X close, used in the gallery
- `<Input />` / `<Textarea />`
- `<EmptyState icon title subtitle action />`
- `<Avatar initials color size />`
- `<FilterTabs options value onChange />`
- `<StickyHeader title backHref right />`

Existing pages still use their hand-rolled versions — no migration in this release (Pass 2 in the design-system plan). Future code should reach for these primitives first.

## v1.18.1 - May 13, 2026

### Hotfix — intermittent logout when navigating Settings

v1.18.0's `app/(app)/layout.tsx` added a second `supabase.auth.getUser()` call (on top of the one `getServerT()` already makes) to gate the dev feedback notifier on `profiles.is_developer`. Two `getUser()` calls inside a single Server Component request can race the Supabase SSR cookie-refresh flow: call #1 rotates the refresh token, the cookie write is silently swallowed (Server Components can't persist cookies in Next.js 15+), call #2 then sends the now-invalidated refresh token and Supabase returns `user: null`. On the next navigation, middleware sees no session and redirects to `/login`. Closing and reopening the PWA restores a fresh session, which is why the symptom appeared sporadic.

Fix: consolidated the user/profile lookup into a single call by extending `getServerT()` to also return `isDeveloper` (the profile SELECT was already happening, so adding `is_developer` to the column list costs nothing). The layout reads it from there and no longer creates its own client or calls `getUser()` again.

### Files
- `lib/i18n/server.ts` — return `{ t, lang, isDeveloper }` from `getServerT()`.
- `app/(app)/layout.tsx` — drop the duplicate `createClient` + `auth.getUser` + profile fetch; read `isDeveloper` from `getServerT()`.

## v1.18.0 - May 13, 2026

### Help & Feedback — track your tickets

- **New `My tickets` tab** on Settings → Help & Feedback. Lists every ticket the signed-in user has submitted, newest first, with a status pill (Open / In progress / Closed), the category, and a "Reply" chip when the dev has replied.
- Tap a ticket to open a **read-only bottom sheet** showing the full body, attachments (signed URLs, 1-hour TTL), and the dev's reply in a highlighted card.
- **Realtime**: subscribed to `postgres_changes` UPDATE events filtered to `created_by=eq.<user_id>` so dev replies and status changes appear without refreshing. DELETE events are also handled — a ticket the dev wipes disappears from the list silently.
- Tab state mirrored to URL `?tab=mine` (replace, not push) so deep links land on the right pane.

### Developer feedback alerts

- **Red open-ticket badge** next to the *Feedback Tickets* row in Settings. Counts rows where `status='open'`. Server-renders the initial count; client-side Realtime subscription on `feedback` re-fetches on any change so the badge stays current. Hidden when zero.
- **Top-of-screen toast** (`DevFeedbackNotifier`, mounted in `app/(app)/layout.tsx` only when `profiles.is_developer = true`) pops up on every new feedback INSERT. Tap → routes to `/settings/feedback-admin?ticket=<id>`. Auto-dismisses after 8s, max 3 stacked, de-duped by ticket id.
- New `@keyframes toast-slide-down` in `globals.css` (`.animate-toast-slide-down`).

### Database — migration `0021_feedback_followups.sql`

- RLS init-plan fix: rewrote `feedback` SELECT and INSERT policies to use `(select auth.uid())` instead of bare `auth.uid()` so the function is evaluated once per query, not per row.
- `revoke execute … from public, anon` on the `is_developer_caller()` and `can_access_feedback_attachment(text)` helper functions — they're only meant to be called from inside RLS policies, never via the REST RPC endpoint.
- Covering indexes on `feedback.household_id` and `feedback.replied_by` (the two unindexed foreign keys flagged by the Supabase advisor).
- Added `public.feedback` to the `supabase_realtime` publication (idempotent via a DO block) so the two subscriptions above receive events.

### Internal

- `RowLink` in `app/(app)/settings/page.tsx` gained an optional `rightSlot` prop so client components can be slotted into the right side of a row link (used by the open-ticket badge).
- `app/(app)/layout.tsx` now fetches `profiles.is_developer` per request to gate the notifier — one extra small query for every (app) navigation. Worth it to avoid loading the realtime channel for non-devs.

## v1.17.1 - May 12, 2026

### Dark-mode contrast fixes

- **New CSS variable `--on-foreground`** for text/icons placed on `bg-[var(--foreground)]`:
  - Light: `#ffffff` (was already what `text-white` produced)
  - Dark: `#1a1814` (the dark background) — so the cream-coloured button gets dark text
- Swapped `text-white` → `text-[var(--on-foreground)]` on every line that pairs `bg-[var(--foreground)]` with white text — 24 files, including: bottom-nav `+`, FeedbackForm submit + category chips, FeedbackAdmin status chips + Save reply, all add-recurring/transaction/category sheets, settings name/symbol save buttons, onboarding CTAs, transactions filter chips, reports period chips, ledger-switcher CTAs, invite-member, promo-codes chips, etc.

### UI polish

- **Bottom-nav floating bar outline** changed from `ring-black/[0.04]` to `ring-[var(--foreground)]/15` so it's visible in dark mode (where black-on-dark disappeared). Slightly more visible in light mode too, which is the right call — it was blending a bit with the page background.
- **Locked-header top padding** reduced from `pt-4` to `pt-2` across every sticky header (Transactions, Reports, Settings + sub-pages, Edit profile, Wallets, Categories, Promo codes, Theme, Help, FeedbackAdmin). The shield handles the safe-area gap; the header's own `pt-4` on top of that left too much room.
- **Reports category drilldown sheet**: added a dedicated X close button next to the total, and the sheet now locks `document.body.overflow` while mounted so the background doesn't scroll behind it.
- **Help & Feedback page**: `useEffect` on mount forces `window.scrollTo({ top: 0 })` so opening the page doesn't land mid-form.

## v1.17.0 - May 12, 2026

### Help & Feedback ticketing

Users can now send feedback directly from `Settings → Help & Feedback`. The form has:

- **Subject** (required, up to 120 chars)
- **Category**: Bug · Feature · Question · Other
- **Message body** (required, multi-line)
- **Attachments**: multiple screenshots and at most one video (≤ 50 MB; the form rejects bigger files client-side — server-side compression is a follow-up)

Submitted tickets land in a developer-only queue at `Settings → Developer → Feedback Tickets` (visible only when `profiles.is_developer = true`). The queue:
- Shows the submitter avatar, subject, category, status pill, and date
- Tap to expand: full body, signed-URL attachment previews (3-up grid), status buttons (Open / In Progress / Closed), a delete button, and a reply textarea that becomes visible to the submitter (RLS lets each user read their own tickets back, so they can see the dev reply later if we surface it).

**Migration 0020** introduces:
- `public.feedback` table with `subject`, `body`, `category`, `status`, `attachments text[]`, `reply`, `replied_at`, `replied_by`
- Storage bucket `feedback-attachments` (private). Path convention `<user_id>/<random>.<ext>`
- RLS: users insert/read their own; developers read/update/delete all. Storage policies mirror that.
- Helper function `is_developer_caller()` and `can_access_feedback_attachment(path)`.

⚠ **Apply migration 0020 to Supabase before this is live.**

## v1.16.1 - May 12, 2026

### Reports

- **Category drilldown.** Tap any category row (or the Uncategorized row) in the Reports breakdown to open a bottom sheet listing every transaction that contributed to that category's total for the currently-selected period. The sheet's date range follows the report's period filter — change the period and tap a category again to see a different slice. Each row shows the transaction name, date (with weekday), wallet, and signed amount.

## v1.16.0 - May 12, 2026

### Dark mode

- **Theme switcher** at `Settings → Account → Theme` with three options:
  - **Automatic** — follows the phone's system appearance (default).
  - **Always Light** — forces the warm cream theme regardless of system.
  - **Always Dark** — forces the dark theme regardless of system.
- CSS variables (`--background`, `--surface`, `--foreground`, `--separator`, `--label-secondary`, `--label-tertiary`, `--accent`) all have dark counterparts. The dark palette keeps the warm tone (slight brown tint rather than pure neutral).
- Theme is persisted to `localStorage` and applied via an inline bootstrap `<script>` in `<head>` before first paint, so there's no flash of wrong theme on app launch.
- iOS PWA status-bar color follows the theme via media-query `theme-color` meta.

## v1.15.1 - May 12, 2026

### Status-bar shield + sticky headers

- **iOS safe-area status-bar zone is now opaque.** Added a fixed, backdrop-blur shield in the app layout that covers `env(safe-area-inset-top)`. All sticky page headers (Settings + sub-pages, Reports, Transactions, Edit profile, Wallets, Categories, Promo codes) now use `top: env(safe-area-inset-top)` so they pin flush below the shield instead of sliding behind the dynamic island. Fixes (a) the transparent strip on Reports during scroll and (b) the Settings header content drawing under the iPhone status bar when scrolled.

### Transactions

- **Sticky header on Transactions.** The avatar / household-name / search / filter header now pins to the top when scrolling, matching every other page in the app.

### Settings

- **No more empty gap at the bottom.** Settings hides the bottom nav, but the layout still reserved 7rem of bottom padding for it. The settings page now cancels that padding via a negative margin so the version label sits comfortably above the home indicator instead of floating in a sea of whitespace.
- **Removed Privacy Policy entry** from the Support group.

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
