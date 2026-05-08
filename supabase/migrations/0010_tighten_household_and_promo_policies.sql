-- Forward migration for live databases that already applied earlier schema
-- files. Tightens household reads so invite codes are not listable and makes
-- promo-code deletion match the "delete only your generated codes" product
-- rule.

DROP POLICY IF EXISTS "households: authenticated can read" ON public.households;
DROP POLICY IF EXISTS "households: members or owner can read" ON public.households;

CREATE POLICY "households: members or owner can read"
  ON public.households FOR SELECT
  TO authenticated
  USING (
    id = public.current_household_id()
    OR owner_id = auth.uid()
  );

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

CREATE OR REPLACE FUNCTION public.delete_promo_code(p_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_dev BOOLEAN;
  v_created_by UUID;
  v_redeemed_at TIMESTAMPTZ;
  v_deleted UUID;
BEGIN
  SELECT is_developer INTO v_is_dev
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_is_dev IS NOT TRUE THEN
    RAISE EXCEPTION 'Only developers can delete promo codes' USING ERRCODE = '42501';
  END IF;

  SELECT created_by, redeemed_at INTO v_created_by, v_redeemed_at
  FROM public.promo_codes
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promo code not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete another developer''s promo code' USING ERRCODE = '42501';
  END IF;
  IF v_redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete a redeemed promo code' USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.promo_codes
  WHERE id = p_id
  RETURNING id INTO v_deleted;

  RETURN v_deleted;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_promo_code(UUID) TO authenticated;
