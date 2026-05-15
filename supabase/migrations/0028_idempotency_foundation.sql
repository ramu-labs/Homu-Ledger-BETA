-- v1.35.0 — Pragmatic offline, Phase 2 of 3: idempotency foundation.
--
-- Adds the columns + constraints that the offline write-queue (Phase 3 /
-- v1.36.0) will rely on:
--
--   client_op_id UUID — generated on the device when the user taps "save".
--     Same id sent on every retry until the server confirms. A partial
--     unique index per household makes a second insert with the same id a
--     no-op (we catch the 23505 in the server action and return the
--     existing row, so the queue can be aggressively at-least-once).
--
--   updated_at TIMESTAMPTZ — autoset by trigger on every UPDATE. Phase 3
--     uses this for last-write-wins conflict detection (client sends the
--     updated_at it saw at queue time; server rejects with 409 if the row
--     has moved on, and the client refreshes + shows a toast).
--
-- This migration is purely additive — nullable columns, partial index,
-- trigger that only fires on UPDATE. No row rewrite, no behavior change
-- for existing clients. v1.34.0 keeps working unchanged.

-- ── Trigger function (idempotent) ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── transactions ──────────────────────────────────────────────────────
alter table public.transactions
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists client_op_id uuid;

-- Partial unique index — only constrains rows the client tagged. Pre-2025
-- rows (and any server-side inserts that don't set the column) remain
-- unrestricted. Scoped to household_id so the same client_op_id is reusable
-- across households if a user belongs to multiple.
create unique index if not exists transactions_household_client_op_uniq
  on public.transactions (household_id, client_op_id)
  where client_op_id is not null;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ── wallets ───────────────────────────────────────────────────────────
alter table public.wallets
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists client_op_id uuid;

create unique index if not exists wallets_household_client_op_uniq
  on public.wallets (household_id, client_op_id)
  where client_op_id is not null;

drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

-- ── categories ────────────────────────────────────────────────────────
alter table public.categories
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists client_op_id uuid;

create unique index if not exists categories_household_client_op_uniq
  on public.categories (household_id, client_op_id)
  where client_op_id is not null;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();
