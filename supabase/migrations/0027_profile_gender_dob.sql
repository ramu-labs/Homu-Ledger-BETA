-- v1.32.0 — collect gender + birth_date at sign-up.
--
-- Both nullable so existing accounts keep working without backfill.
-- The signup action will write them on first save; users created via
-- Google / via the older email flow simply leave them NULL.
--
-- Gender is a small fixed set so we can rely on it in reports / nudges
-- later without freeform-string normalisation pain. "prefer_not_to_say"
-- is explicit (not represented by NULL) so we can tell "user opted not
-- to share" from "user predates this column".

alter table public.profiles
  add column if not exists gender text
    check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));

alter table public.profiles
  add column if not exists birth_date date;
