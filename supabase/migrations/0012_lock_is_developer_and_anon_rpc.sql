-- Lock down two privilege-escalation / enumeration vectors.
--
-- 1) profiles.is_developer was writable by the row's owner under the
--    "self can update" policy. Anyone could promote themselves to
--    developer with a single Supabase REST call and then call the
--    developer-only RPCs (delete_promo_code, generate_promo_code, …).
--
-- 2) is_promo_code_valid() and get_email_by_username() were granted to
--    anon. Anyone with the public anon key (i.e. the whole internet,
--    since the key ships in the client bundle) could hit
--    /rest/v1/rpc/get_email_by_username with arbitrary usernames and
--    enumerate registered emails for phishing. Promo-code probing is
--    less critical (36^8 entropy makes brute-force infeasible) but
--    we revoke it for symmetry and defence-in-depth.
--
-- Operational note for #2:
-- The auth flow needs server-side access to these RPCs while the user
-- is logging in / signing up (no auth.uid() yet). The codebase will
-- now call them via a service-role client created in lib/supabase/admin.ts.
-- That requires SUPABASE_SERVICE_ROLE_KEY in the Vercel env. Apply
-- THIS migration only AFTER that env var is set and the new code is
-- deployed, otherwise sign-in/sign-up will break.

-- 1) Block is_developer self-promotion -----------------------------------
-- Replace the existing UPDATE policy on profiles. The policy drops the
-- previous "self can update" / "self can update safe fields" variants
-- and replaces them with one that explicitly compares is_developer to
-- the current row value — so the user can only "update" the column to
-- the same value it already had.
DROP POLICY IF EXISTS "profiles: self can update" ON public.profiles;
DROP POLICY IF EXISTS "profiles: self can update safe fields" ON public.profiles;
CREATE POLICY "profiles: self can update safe fields"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- household_id may only point at a ledger the user is a member of
    AND (
      household_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.household_members hm
        WHERE hm.household_id = profiles.household_id
          AND hm.profile_id = auth.uid()
      )
    )
    -- is_developer is server-controlled; the user cannot flip it via UPDATE
    AND is_developer = (
      SELECT p2.is_developer FROM public.profiles p2 WHERE p2.id = auth.uid()
    )
  );

-- 2) Revoke anon enumeration ---------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_promo_code_valid(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(TEXT) FROM anon;
-- Authenticated grant remains — and the auth-flow callers will use the
-- service role key, which bypasses RLS and these grants entirely.
