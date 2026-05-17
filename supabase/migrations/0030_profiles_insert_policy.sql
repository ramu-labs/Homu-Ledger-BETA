-- v1.46.2 — Add the missing INSERT RLS policy on profiles.
--
-- The profiles table had SELECT + UPDATE policies but no INSERT policy.
-- completeGoogleProfile() — the username step after Google sign-in —
-- writes the profile with supabase.upsert(), which compiles to
-- `INSERT ... ON CONFLICT DO UPDATE`. Postgres evaluates the INSERT
-- policy for ANY upsert, even when the row already exists and the
-- statement resolves to an UPDATE. With no INSERT policy, every upsert
-- was denied:
--
--   new row violates row-level security policy for table "profiles"
--
-- This blocked 100% of Google sign-ups at the "pick a username" step.
-- Email/password signups were unaffected — their profile row is created
-- by the handle_new_user SECURITY DEFINER trigger (which bypasses RLS)
-- and written with a plain .update(), permitted by the UPDATE policy.
--
-- Fix: a user may INSERT only their own profile row (id = auth.uid()),
-- mirroring the UPDATE policy's self-check.

drop policy if exists "profiles: self insert" on public.profiles;
create policy "profiles: self insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
