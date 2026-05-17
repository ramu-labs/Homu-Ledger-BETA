-- Developer analytics dashboard (RAM-18).
--
-- A single SECURITY DEFINER function that returns a JSON snapshot of the
-- raw rows the analytics dashboard needs. All metric computation happens
-- in the page server component / lib/analytics.ts — this mirrors the AI
-- dev panel, which fetches rows and buckets them in JS.
--
-- Why SECURITY DEFINER: RLS scopes transactions/profiles/etc. to the
-- caller's own household, so a plain SELECT would only ever see the
-- developer's own ledger. The is_developer_caller() guard (added in
-- 0020) keeps this dev-only — non-developers get NULL back.
--
-- Aggregate, low-cardinality columns only. Transaction names, notes, and
-- photo URLs are never returned — only booleans derived from them.

create or replace function public.analytics_overview()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_developer_caller() then json_build_object(
      'generated_at', now(),
      'profiles', (
        select coalesce(json_agg(json_build_object(
          'id', p.id,
          'name', p.name,
          'created_at', p.created_at
        )), '[]'::json)
        from public.profiles p
      ),
      'transactions', (
        select coalesce(json_agg(json_build_object(
          'created_by', t.created_by,
          'created_at', t.created_at,
          'household_id', t.household_id,
          'category_id', t.category_id,
          'amount', t.amount,
          'type', t.type,
          'has_note', (t.note is not null and length(btrim(t.note)) > 0),
          'has_photo', (t.photo_url is not null),
          'is_transfer', (t.transfer_pair_id is not null)
        )), '[]'::json)
        from public.transactions t
      ),
      'categories', (
        select coalesce(json_agg(json_build_object(
          'id', c.id,
          'household_id', c.household_id,
          'name', c.name,
          'is_default', c.is_default
        )), '[]'::json)
        from public.categories c
      ),
      'wallets', (
        select coalesce(json_agg(json_build_object(
          'household_id', w.household_id
        )), '[]'::json)
        from public.wallets w
      ),
      'recurring_items', (
        select coalesce(json_agg(json_build_object(
          'created_by', r.created_by,
          'household_id', r.household_id
        )), '[]'::json)
        from public.recurring_items r
      ),
      'household_members', (
        select coalesce(json_agg(json_build_object(
          'profile_id', m.profile_id,
          'household_id', m.household_id
        )), '[]'::json)
        from public.household_members m
      ),
      'households', (
        select coalesce(json_agg(json_build_object(
          'id', h.id,
          'currency', h.currency
        )), '[]'::json)
        from public.households h
      ),
      'category_hints', (
        select coalesce(json_agg(json_build_object(
          'source', ch.source
        )), '[]'::json)
        from public.category_hints ch
      )
    )
    else null
  end;
$$;

revoke all on function public.analytics_overview() from public, anon;
grant execute on function public.analytics_overview() to authenticated;
