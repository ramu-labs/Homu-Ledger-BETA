-- Event tracking infrastructure (RAM-19).
--
-- A generic append-only `events` table for UI funnel / drop-off analysis.
-- Events are written client-side by lib/events.ts; collection is gated on
-- analytics consent (RAM-20) — until that ships the client logger is a
-- no-op, so this table simply stays empty. No PII: instrumentation only
-- writes funnel-step names and small non-identifying props.
--
-- This migration also extends analytics_overview() (from 0031) to include
-- an events snapshot so the dev dashboard can render the Friction Points
-- section.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  -- Funnel-step name, e.g. 'transaction_started'. Low-cardinality.
  name text not null,
  -- Small, non-identifying metadata only (e.g. {"queued": true}).
  props jsonb not null default '{}'::jsonb,
  -- Defaulted from the session so the client never sends it; RLS pins it.
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  -- When the event happened on the client. Differs from created_at for
  -- events that were buffered offline and flushed later.
  client_ts timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists events_name_idx on public.events (name);
create index if not exists events_created_at_idx on public.events (created_at);

alter table public.events enable row level security;

-- Authenticated users may only insert events attributed to themselves.
drop policy if exists "events: insert own" on public.events;
create policy "events: insert own"
  on public.events for insert
  to authenticated
  with check (user_id = auth.uid());

-- Only developers can read events — this is analytics, not user-facing.
-- No update/delete policies: events are immutable. RAM-20 will add a
-- consent-revocation delete path.
drop policy if exists "events: dev can read" on public.events;
create policy "events: dev can read"
  on public.events for select
  to authenticated
  using (public.is_developer_caller());

-- ── Extend analytics_overview() with an events snapshot ────────────────
-- Full redefinition (create or replace); identical to 0031 plus the new
-- 'events' key. computeAnalytics() derives the friction funnels from it.

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
      ),
      'events', (
        select coalesce(json_agg(json_build_object(
          'name', e.name,
          'user_id', e.user_id,
          'created_at', e.created_at
        )), '[]'::json)
        from public.events e
      )
    )
    else null
  end;
$$;

revoke all on function public.analytics_overview() from public, anon;
grant execute on function public.analytics_overview() to authenticated;
