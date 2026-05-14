-- Promo-code "label" (free-text note assigned by the developer when
-- generating). Lets the developer remember who a code was given to
-- (e.g. "For Andi", "Twitter giveaway") without locking the code to
-- a specific email — anyone with the string can still redeem.
--
-- The label is set ONLY at generation time via the RPC. RLS still
-- blocks direct INSERT/UPDATE on promo_codes from clients, so we
-- bake the parameter into generate_promo_code itself.

alter table public.promo_codes
  add column if not exists label text;

-- generate_promo_code's return type widens (adds `label`) and its
-- argument list adds `p_label`. Postgres doesn't allow CREATE OR
-- REPLACE to change a function's return type, so drop + create.
drop function if exists public.generate_promo_code(text);

create or replace function public.generate_promo_code(
  p_tier  text,
  p_label text default null
)
returns table(
  id          uuid,
  code        text,
  tier        text,
  created_at  timestamptz,
  label       text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user        uuid := auth.uid();
  v_is_dev      boolean;
  v_code        text;
  v_id          uuid;
  v_created_at  timestamptz;
  v_label       text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select p.is_developer into v_is_dev
  from public.profiles p
  where p.id = v_user;

  if v_is_dev is not true then
    raise exception 'Developer access required' using errcode = 'insufficient_privilege';
  end if;

  if p_tier not in ('3_months','6_months','1_year','lifetime','developer') then
    raise exception 'Invalid tier: %', p_tier using errcode = 'invalid_parameter_value';
  end if;

  -- Normalise empty-string labels to NULL so the column reads cleanly.
  v_label := nullif(btrim(coalesce(p_label, '')), '');

  v_code := public.generate_promo_code_string();

  insert into public.promo_codes as pc (code, tier, created_by, label)
  values (v_code, p_tier, v_user, v_label)
  returning pc.id, pc.created_at into v_id, v_created_at;

  return query select v_id, v_code, p_tier, v_created_at, v_label;
end;
$function$;
