-- 0018_categories_type_and_delete_policy.sql
--
-- Three things in one migration:
--   1. Allow members to delete any category in their household (not just
--      non-default ones). Previously the RLS policy blocked deletion of
--      is_default rows, which is why deleting a default category appeared
--      to succeed in the UI (server action returned no error) but the row
--      never actually went, so it reappeared on the next page load.
--   2. Add a `type` enum column to public.categories so each category is
--      either 'expense' or 'income'. Existing rows default to 'expense'.
--      The 'Salary' default that was previously seeded as an expense is
--      reclassified to 'income' (it was misplaced).
--   3. Seed three default income categories (Salary, Bonus, Reimburse) for
--      every existing household, idempotently. The seed_default_categories
--      trigger function is updated to seed both expense and income defaults
--      for newly created households going forward.
--
-- Transactions and recurring_items already have `category_id … on delete
-- set null`, so deleting a category automatically clears it from those
-- rows. The UI displays NULL category as "Uncategorized".

-- ── 1. Drop and re-create the delete policy ───────────────────────────────
drop policy if exists "categories: members can delete non-default" on public.categories;

create policy "categories: members can delete"
  on public.categories for delete
  using (household_id = public.current_household_id());

-- ── 2. Add type column ────────────────────────────────────────────────────
-- Reuse the existing transaction_type enum ('income' | 'expense').
alter table public.categories
  add column if not exists type public.transaction_type not null default 'expense';

-- Move the previously-misplaced 'Salary' default category to income.
update public.categories
  set type = 'income'
  where is_default = true and name = 'Salary';

-- ── 3. Seed the two new income defaults for every existing household ──────
-- Idempotent: only inserts where (household_id, name) doesn't already exist.
insert into public.categories (household_id, name, symbol, color, is_default, type)
select h.id, defaults.name, defaults.symbol, defaults.color, true, 'income'::public.transaction_type
  from public.households h
  cross join (values
    ('Bonus',     '🎁', '#eab308'),
    ('Reimburse', '💰', '#22c55e')
  ) as defaults(name, symbol, color)
  where not exists (
    select 1 from public.categories c
      where c.household_id = h.id and c.name = defaults.name
  );

-- ── 4. Update the trigger to seed income defaults for new households ──────
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Expense defaults
  insert into public.categories (household_id, name, symbol, color, is_default, type) values
    (new.id, 'Food & Drink',  '🍔', '#f97316', true, 'expense'),
    (new.id, 'Transport',     '🚗', '#3b82f6', true, 'expense'),
    (new.id, 'Housing',       '🏠', '#8b5cf6', true, 'expense'),
    (new.id, 'Health',        '💊', '#ef4444', true, 'expense'),
    (new.id, 'Shopping',      '🛍️', '#ec4899', true, 'expense'),
    (new.id, 'Entertainment', '🎬', '#eab308', true, 'expense'),
    (new.id, 'Education',     '📚', '#14b8a6', true, 'expense'),
    (new.id, 'Other',         '📋', '#6b7280', true, 'expense'),
  -- Income defaults
    (new.id, 'Salary',    '💼', '#22c55e', true, 'income'),
    (new.id, 'Bonus',     '🎁', '#eab308', true, 'income'),
    (new.id, 'Reimburse', '💰', '#22c55e', true, 'income');
  return new;
end;
$$;
