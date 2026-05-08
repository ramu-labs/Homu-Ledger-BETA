alter table public.households
  add column owner_id uuid references public.profiles(id) on delete set null;

drop policy if exists "households: authenticated can read" on public.households;
drop policy if exists "households: members or owner can read" on public.households;

create policy "households: members or owner can read"
  on public.households for select
  to authenticated
  using (
    id = public.current_household_id()
    or owner_id = auth.uid()
  );
