-- Repair the checked-in schema so a fresh database can recreate the app
-- objects that were originally added directly in production: wallets,
-- invitations, promo codes, transfer helpers, username lookup helpers, and
-- transaction photo storage policies. Keep the file idempotent because live
-- projects may already have these objects.

-- -------------------------------------------------------------------------
-- Ledger/profile columns used by current app code
-- -------------------------------------------------------------------------
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS symbol TEXT NOT NULL DEFAULT '🏠';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS is_developer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- -------------------------------------------------------------------------
-- Wallets
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  color           TEXT NOT NULL,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallets_household_id_idx
  ON public.wallets (household_id);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets: members can read" ON public.wallets;
CREATE POLICY "wallets: members can read"
  ON public.wallets FOR SELECT
  USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "wallets: members can insert" ON public.wallets;
CREATE POLICY "wallets: members can insert"
  ON public.wallets FOR INSERT
  WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "wallets: members can update" ON public.wallets;
CREATE POLICY "wallets: members can update"
  ON public.wallets FOR UPDATE
  USING (household_id = public.current_household_id())
  WITH CHECK (household_id = public.current_household_id());

DROP POLICY IF EXISTS "wallets: members can delete non-default" ON public.wallets;
CREATE POLICY "wallets: members can delete non-default"
  ON public.wallets FOR DELETE
  USING (household_id = public.current_household_id() AND is_default = FALSE);

CREATE OR REPLACE FUNCTION public.ensure_single_default_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.wallets
      SET is_default = FALSE
      WHERE household_id = NEW.household_id
        AND id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_wallet_default_changed'
  ) THEN
    CREATE TRIGGER on_wallet_default_changed
      BEFORE INSERT OR UPDATE OF is_default ON public.wallets
      FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_wallet();
  END IF;
END $$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_pair_id UUID;

CREATE INDEX IF NOT EXISTS transactions_wallet_idx
  ON public.transactions (wallet_id);
CREATE INDEX IF NOT EXISTS transactions_transfer_pair_idx
  ON public.transactions (transfer_pair_id);

ALTER TABLE public.recurring_items
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recurring_wallet_idx
  ON public.recurring_items (wallet_id);

CREATE OR REPLACE FUNCTION public.seed_default_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.wallets (household_id, name, symbol, color, initial_balance, is_default) VALUES
    (NEW.id, 'Cash',    '💵', '#22c55e', 0, true),
    (NEW.id, 'Savings', '🐷', '#3b82f6', 0, false),
    (NEW.id, 'Credit',  '💳', '#8b5cf6', 0, false);
  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_household_created_seed_wallet'
  ) THEN
    CREATE TRIGGER on_household_created_seed_wallet
      AFTER INSERT ON public.households
      FOR EACH ROW EXECUTE FUNCTION public.seed_default_wallet();
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Transfers
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_transfer(
  p_from_wallet UUID,
  p_to_wallet UUID,
  p_amount NUMERIC,
  p_name TEXT,
  p_date DATE
)
RETURNS TABLE(source_id UUID, dest_id UUID, pair_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_household_id UUID;
  v_pair_id UUID := gen_random_uuid();
  v_source_id UUID;
  v_dest_id UUID;
BEGIN
  SELECT household_id INTO v_household_id
    FROM public.profiles
    WHERE id = auth.uid();

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No active ledger' USING ERRCODE = '42501';
  END IF;
  IF p_from_wallet = p_to_wallet THEN
    RAISE EXCEPTION 'Source and destination wallets must differ' USING ERRCODE = '23514';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.wallets
    WHERE id IN (p_from_wallet, p_to_wallet)
      AND household_id = v_household_id
    GROUP BY household_id
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION 'Both wallets must belong to the active ledger' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transactions (
    household_id, created_by, type, amount, name, wallet_id, date, transfer_pair_id
  )
  VALUES (
    v_household_id, auth.uid(), 'expense', p_amount, COALESCE(NULLIF(trim(p_name), ''), 'Transfer'),
    p_from_wallet, COALESCE(p_date, CURRENT_DATE), v_pair_id
  )
  RETURNING id INTO v_source_id;

  INSERT INTO public.transactions (
    household_id, created_by, type, amount, name, wallet_id, date, transfer_pair_id
  )
  VALUES (
    v_household_id, auth.uid(), 'income', p_amount, COALESCE(NULLIF(trim(p_name), ''), 'Transfer'),
    p_to_wallet, COALESCE(p_date, CURRENT_DATE), v_pair_id
  )
  RETURNING id INTO v_dest_id;

  RETURN QUERY SELECT v_source_id, v_dest_id, v_pair_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_transfer(UUID, UUID, NUMERIC, TEXT, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.move_transaction(
  p_transaction_id UUID,
  p_target_household_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_household_id UUID;
BEGIN
  SELECT household_id INTO v_current_household_id
    FROM public.profiles
    WHERE id = auth.uid();

  IF v_current_household_id IS NULL THEN
    RAISE EXCEPTION 'No active ledger' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_target_household_id
      AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of target ledger' USING ERRCODE = '42501';
  END IF;

  UPDATE public.transactions
    SET household_id = p_target_household_id,
        category_id = NULL,
        wallet_id = NULL
    WHERE id = p_transaction_id
      AND household_id = v_current_household_id
      AND transfer_pair_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or cannot be moved' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.move_transaction(UUID, UUID) TO authenticated;

-- -------------------------------------------------------------------------
-- Invitations and invite-code lookup
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS household_invitations_invited_user_status_idx
  ON public.household_invitations (invited_user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS household_invitations_pending_unique_idx
  ON public.household_invitations (household_id, invited_user_id)
  WHERE status = 'pending';

ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_invitations: invitee can read" ON public.household_invitations;
CREATE POLICY "household_invitations: invitee can read"
  ON public.household_invitations FOR SELECT
  USING (invited_user_id = auth.uid());

DROP POLICY IF EXISTS "household_invitations: members can read ledger invites" ON public.household_invitations;
CREATE POLICY "household_invitations: members can read ledger invites"
  ON public.household_invitations FOR SELECT
  USING (household_id = public.current_household_id());

DROP POLICY IF EXISTS "household_invitations: members can insert" ON public.household_invitations;
CREATE POLICY "household_invitations: members can insert"
  ON public.household_invitations FOR INSERT
  WITH CHECK (
    household_id = public.current_household_id()
    AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS "household_invitations: invitee can update own" ON public.household_invitations;
CREATE POLICY "household_invitations: invitee can update own"
  ON public.household_invitations FOR UPDATE
  USING (invited_user_id = auth.uid())
  WITH CHECK (invited_user_id = auth.uid());

DROP POLICY IF EXISTS "household_invitations: inviter or members can delete" ON public.household_invitations;
CREATE POLICY "household_invitations: inviter or members can delete"
  ON public.household_invitations FOR DELETE
  USING (invited_by = auth.uid() OR household_id = public.current_household_id());

CREATE OR REPLACE FUNCTION public.lookup_household_by_invite_code(p_code TEXT)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT h.id, h.name
  FROM public.households h
  WHERE h.invite_code = upper(trim(p_code))
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.lookup_household_by_invite_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_user_for_invite(p_query TEXT)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.name
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(p_query))
     OR lower(p.username) = lower(trim(p_query))
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.lookup_user_for_invite(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.email
  FROM public.profiles p
  WHERE lower(p.username) = lower(trim(p_username))
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- Promo codes
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  tier        TEXT NOT NULL CHECK (tier IN ('3_months', '6_months', '1_year', 'lifetime', 'developer')),
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes: developers can read all" ON public.promo_codes;
CREATE POLICY "promo_codes: developers can read all"
  ON public.promo_codes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_developer IS TRUE
  ));

DROP POLICY IF EXISTS "promo_codes: redeemer can read own" ON public.promo_codes;
CREATE POLICY "promo_codes: redeemer can read own"
  ON public.promo_codes FOR SELECT
  USING (redeemed_by = auth.uid());

CREATE OR REPLACE FUNCTION public.generate_promo_code_string()
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  body TEXT := '';
BEGIN
  FOR i IN 1..8 LOOP
    body := body || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN 'HOMU-' || substr(body, 1, 4) || '-' || substr(body, 5, 4);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_promo_code(p_tier TEXT)
RETURNS TABLE(id UUID, code TEXT, tier TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code TEXT;
  v_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_developer IS TRUE
  ) THEN
    RAISE EXCEPTION 'Only developers can generate promo codes' USING ERRCODE = '42501';
  END IF;

  IF p_tier NOT IN ('3_months', '6_months', '1_year', 'lifetime', 'developer') THEN
    RAISE EXCEPTION 'Invalid promo tier' USING ERRCODE = '23514';
  END IF;

  LOOP
    v_code := public.generate_promo_code_string();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.promo_codes pc WHERE pc.code = v_code);
  END LOOP;

  INSERT INTO public.promo_codes (code, tier, created_by)
  VALUES (v_code, p_tier, auth.uid())
  RETURNING promo_codes.id, promo_codes.created_at INTO v_id, v_created_at;

  RETURN QUERY SELECT v_id, v_code, p_tier, v_created_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_promo_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_promo_code_valid(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.promo_codes pc
    WHERE pc.code = upper(trim(p_code))
      AND pc.redeemed_at IS NULL
  );
$function$;

GRANT EXECUTE ON FUNCTION public.is_promo_code_valid(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT)
RETURNS TABLE(tier TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code public.promo_codes%ROWTYPE;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_code
  FROM public.promo_codes
  WHERE code = upper(trim(p_code))
    AND redeemed_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already-redeemed promo code' USING ERRCODE = 'P0002';
  END IF;

  v_expires_at := CASE v_code.tier
    WHEN '3_months' THEN now() + interval '3 months'
    WHEN '6_months' THEN now() + interval '6 months'
    WHEN '1_year' THEN now() + interval '1 year'
    ELSE NULL
  END;

  UPDATE public.promo_codes
    SET redeemed_by = auth.uid(),
        redeemed_at = now()
    WHERE id = v_code.id;

  UPDATE public.profiles
    SET subscription_tier = v_code.tier,
        subscription_expires_at = v_expires_at
    WHERE id = auth.uid();

  RETURN QUERY SELECT v_code.tier, v_expires_at;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT) TO authenticated;

-- -------------------------------------------------------------------------
-- Transaction photo storage
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-photos', 'transaction-photos', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "transaction_photos: authenticated can upload" ON storage.objects;
CREATE POLICY "transaction_photos: authenticated can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'transaction-photos');

DROP POLICY IF EXISTS "transaction_photos: public can read" ON storage.objects;
CREATE POLICY "transaction_photos: public can read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'transaction-photos');
