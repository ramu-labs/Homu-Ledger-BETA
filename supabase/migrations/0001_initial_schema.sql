-- FamilyLedger v1 — initial schema
-- Decisions locked in with product:
--   * Manual refresh (no realtime subscriptions required)
--   * Keep transactions if a user leaves the household
--   * Allow opening balance seed (stored on household row)
--   * Recurring = reference list only (no auto-posting)

set check_function_bodies = off;

-- =========================================================================
-- 1. HOUSEHOLDS
-- =========================================================================
create table public.households (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  invite_code     text not null unique,
  opening_balance numeric(14,2) not null default 0,
  created_at      timestamptz not null default now()
);

create index households_invite_code_idx on public.households (invite_code);

-- Generate a 6-character alphanumeric invite code (uppercase, no ambiguous chars)
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I
  code     text;
  attempts int := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = code);
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Could not generate unique invite code';
    end if;
  end loop;
  return code;
end;
$$;

-- =========================================================================
-- 2. PROFILES (extends auth.users)
-- =========================================================================
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  name          text not null,
  initials      text not null,
  avatar_color  text not null default '#3b82f6',
  household_id  uuid references public.households (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index profiles_household_id_idx on public.profiles (household_id);

-- Auto-create a profile row whenever a new auth.user is created.
-- name/initials are derived from signup metadata or email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
  derived_initials text;
  palette constant text[] := array['#3b82f6','#ec4899','#10b981','#f59e0b','#8b5cf6','#ef4444'];
begin
  meta_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  derived_initials := upper(substr(regexp_replace(meta_name, '[^A-Za-z]', '', 'g'), 1, 1));
  if derived_initials = '' then derived_initials := 'U'; end if;

  insert into public.profiles (id, email, name, initials, avatar_color)
  values (
    new.id,
    new.email,
    meta_name,
    derived_initials,
    palette[1 + floor(random() * array_length(palette, 1))::int]
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 3. CATEGORIES
-- =========================================================================
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null,
  symbol        text not null,
  color         text not null,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index categories_household_id_idx on public.categories (household_id);

-- Seed the 9 default categories whenever a new household is inserted.
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (household_id, name, symbol, color, is_default) values
    (new.id, 'Food & Drink',  '🍔', '#f97316', true),
    (new.id, 'Transport',     '🚗', '#3b82f6', true),
    (new.id, 'Housing',       '🏠', '#8b5cf6', true),
    (new.id, 'Health',        '💊', '#ef4444', true),
    (new.id, 'Shopping',      '🛍️', '#ec4899', true),
    (new.id, 'Entertainment', '🎬', '#eab308', true),
    (new.id, 'Education',     '📚', '#14b8a6', true),
    (new.id, 'Salary',        '💼', '#22c55e', true),
    (new.id, 'Other',         '📋', '#6b7280', true);
  return new;
end;
$$;

create trigger on_household_created_seed_categories
  after insert on public.households
  for each row execute function public.seed_default_categories();

-- =========================================================================
-- 4. TRANSACTIONS
-- =========================================================================
create type public.transaction_type as enum ('income', 'expense');

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null, -- keep row if user leaves
  type          public.transaction_type not null,
  amount        numeric(14,2) not null check (amount >= 0),
  name          text not null,
  note          text,
  category_id   uuid references public.categories (id) on delete set null,
  date          date not null default current_date,
  created_at    timestamptz not null default now()
);

create index transactions_household_date_idx
  on public.transactions (household_id, date desc, created_at desc);
create index transactions_category_idx on public.transactions (category_id);

-- =========================================================================
-- 5. RECURRING ITEMS (reference list only, no auto-post)
-- =========================================================================
create type public.recurring_frequency as enum ('weekly', 'monthly', 'yearly');

create table public.recurring_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  type          public.transaction_type not null,
  amount        numeric(14,2) not null check (amount >= 0),
  name          text not null,
  category_id   uuid references public.categories (id) on delete set null,
  frequency     public.recurring_frequency not null,
  next_due_date date,
  created_at    timestamptz not null default now()
);

create index recurring_household_idx on public.recurring_items (household_id);

-- =========================================================================
-- 6. HELPER: current user's household
-- =========================================================================
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- =========================================================================
-- 7. ROW LEVEL SECURITY
-- =========================================================================
alter table public.households      enable row level security;
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.transactions    enable row level security;
alter table public.recurring_items enable row level security;

-- PROFILES -----------------------------------------------------------------
-- Users can read their own profile and any profile in the same household
create policy "profiles: self or same household can read"
  on public.profiles for select
  using (
    id = auth.uid()
    or (household_id is not null and household_id = public.current_household_id())
  );

-- Users can update their own profile (name, initials, avatar, household_id for join/leave)
create policy "profiles: self can update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- HOUSEHOLDS ---------------------------------------------------------------
-- Bootstrap policy for the initial schema. Migration 0002 adds owner_id and
-- immediately tightens this to member/owner-only reads; invite-code lookup is
-- handled by a SECURITY DEFINER RPC in migration 0008.
create policy "households: authenticated can read"
  on public.households for select
  to authenticated
  using (true);

-- Any authenticated user may create a household (they become the first member
-- by setting their own profile.household_id in the same transaction from the app).
create policy "households: authenticated can insert"
  on public.households for insert
  to authenticated
  with check (true);

-- Only members can update the household (e.g. rename, change opening balance)
create policy "households: members can update"
  on public.households for update
  using (id = public.current_household_id())
  with check (id = public.current_household_id());

-- CATEGORIES ---------------------------------------------------------------
create policy "categories: members can read"
  on public.categories for select
  using (household_id = public.current_household_id());

create policy "categories: members can insert"
  on public.categories for insert
  with check (household_id = public.current_household_id());

create policy "categories: members can update"
  on public.categories for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "categories: members can delete non-default"
  on public.categories for delete
  using (
    household_id = public.current_household_id()
    and is_default = false
  );

-- TRANSACTIONS -------------------------------------------------------------
create policy "transactions: members can read"
  on public.transactions for select
  using (household_id = public.current_household_id());

create policy "transactions: members can insert"
  on public.transactions for insert
  with check (
    household_id = public.current_household_id()
    and created_by = auth.uid()
  );

create policy "transactions: members can update"
  on public.transactions for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "transactions: members can delete"
  on public.transactions for delete
  using (household_id = public.current_household_id());

-- RECURRING ITEMS ----------------------------------------------------------
create policy "recurring: members can read"
  on public.recurring_items for select
  using (household_id = public.current_household_id());

create policy "recurring: members can insert"
  on public.recurring_items for insert
  with check (
    household_id = public.current_household_id()
    and created_by = auth.uid()
  );

create policy "recurring: members can update"
  on public.recurring_items for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "recurring: members can delete"
  on public.recurring_items for delete
  using (household_id = public.current_household_id());
