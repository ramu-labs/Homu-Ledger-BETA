-- Switch default category icons from emoji to Lucide icon ids (lu:<name>).
-- Update the seed function (for new households) and backfill existing
-- default categories that still have the original emoji.

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (household_id, name, symbol, color, is_default) values
    (new.id, 'Food & Drink',  'lu:utensils-crossed', '#f97316', true),
    (new.id, 'Transport',     'lu:car',              '#3b82f6', true),
    (new.id, 'Housing',       'lu:home',             '#8b5cf6', true),
    (new.id, 'Health',        'lu:pill',             '#ef4444', true),
    (new.id, 'Shopping',      'lu:shopping-cart',    '#ec4899', true),
    (new.id, 'Entertainment', 'lu:film',             '#eab308', true),
    (new.id, 'Education',     'lu:book-open',        '#14b8a6', true),
    (new.id, 'Salary',        'lu:briefcase',        '#22c55e', true),
    (new.id, 'Other',         'lu:receipt',          '#6b7280', true);
  return new;
end;
$$;

-- Backfill existing default categories, but only where the symbol still
-- matches the original emoji — so user-customised symbols are untouched.
update public.categories set symbol = 'lu:utensils-crossed' where is_default and name = 'Food & Drink'  and symbol = '🍔';
update public.categories set symbol = 'lu:car'              where is_default and name = 'Transport'     and symbol = '🚗';
update public.categories set symbol = 'lu:home'             where is_default and name = 'Housing'       and symbol = '🏠';
update public.categories set symbol = 'lu:pill'             where is_default and name = 'Health'        and symbol = '💊';
update public.categories set symbol = 'lu:shopping-cart'    where is_default and name = 'Shopping'      and symbol = '🛍️';
update public.categories set symbol = 'lu:film'             where is_default and name = 'Entertainment' and symbol = '🎬';
update public.categories set symbol = 'lu:book-open'        where is_default and name = 'Education'     and symbol = '📚';
update public.categories set symbol = 'lu:briefcase'        where is_default and name = 'Salary'        and symbol = '💼';
update public.categories set symbol = 'lu:receipt'          where is_default and name = 'Other'         and symbol = '📋';
