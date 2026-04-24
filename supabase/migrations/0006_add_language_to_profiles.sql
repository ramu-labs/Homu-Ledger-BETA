-- Add language preference to profiles.
-- Per-user setting; supported values: 'en' (English), 'id' (Bahasa Indonesia).
alter table public.profiles
  add column if not exists language text not null default 'en'
  check (language in ('en', 'id'));
