-- 0019_recurring_item_id_on_transactions.sql
--
-- Auto-materialize recurring items into the transactions log on their due date.
--
-- 1. Adds `recurring_item_id` FK column to transactions so we can distinguish
--    auto-materialized rows from manually-entered ones (the UI shows a small
--    "Recurring" tag on these rows). ON DELETE SET NULL — deleting a recurring
--    item should not wipe its historical transactions.
--
-- 2. Adds a SECURITY DEFINER RPC `materialize_due_recurring_items()` that the
--    server calls on Transactions page load. It walks every recurring item in
--    the caller's household whose next_due_date <= current_date, inserts a
--    transaction (using the recurring item's category, wallet, amount, name,
--    type, and created_by), then advances next_due_date by the frequency
--    interval. The advance loops, so back-filling missed periods works
--    automatically (e.g. monthly item not opened for 3 months → 3 rows).
--    Stops advancing once next_due_date passes repeat_until (when set), at
--    which point next_due_date is set to NULL and the item is "done".
--
-- The function is idempotent: re-running it on the same day with no new due
-- items inserts nothing.

-- ── 1. recurring_item_id column on transactions ──────────────────────────
alter table public.transactions
  add column if not exists recurring_item_id uuid
    references public.recurring_items (id) on delete set null;

create index if not exists transactions_recurring_item_idx
  on public.transactions (recurring_item_id);

-- ── 2. The materializer RPC ──────────────────────────────────────────────
create or replace function public.materialize_due_recurring_items()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_count        integer := 0;
  r              record;
  v_next         date;
begin
  -- Resolve the caller's household via existing helper.
  v_household_id := public.current_household_id();
  if v_household_id is null then return 0; end if;

  for r in
    select id, type, amount, name, category_id, wallet_id, frequency,
           next_due_date, repeat_until, created_by
      from public.recurring_items
      where household_id = v_household_id
        and next_due_date is not null
        and next_due_date <= current_date
  loop
    v_next := r.next_due_date;

    -- Loop in case the user opened the app days/weeks after the due date.
    while v_next is not null and v_next <= current_date
          and (r.repeat_until is null or v_next <= r.repeat_until)
    loop
      insert into public.transactions
        (household_id, created_by, type, amount, name,
         category_id, wallet_id, date, recurring_item_id)
      values
        (v_household_id, r.created_by, r.type, r.amount, r.name,
         r.category_id, r.wallet_id, v_next, r.id);

      v_count := v_count + 1;

      -- Advance.
      if r.frequency = 'weekly' then
        v_next := v_next + interval '7 days';
      elsif r.frequency = 'monthly' then
        v_next := (v_next + interval '1 month')::date;
      elsif r.frequency = 'yearly' then
        v_next := (v_next + interval '1 year')::date;
      else
        v_next := null;
      end if;
    end loop;

    -- Persist the advanced (or null) next_due_date.
    if r.repeat_until is not null and v_next is not null and v_next > r.repeat_until then
      v_next := null;
    end if;

    update public.recurring_items
      set next_due_date = v_next
      where id = r.id;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.materialize_due_recurring_items() to authenticated;
