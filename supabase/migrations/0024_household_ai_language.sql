-- v1.27.0 — per-household AI language preference.
--
-- Default `auto` lets Gemini guess from the description itself, which
-- works most of the time but trips on Indonesian phrases that look
-- English-ish ("Babi Cincang" → "Baby Needs" instead of Groceries).
-- Setting this to 'id' makes the prompt include "The description is in
-- Bahasa Indonesia." so the model interprets the input correctly.
--
-- Stored on households, not profiles, because a household is the
-- correct scope: one household = one shared cache + one consistent
-- categorisation language.

alter table public.households
  add column if not exists ai_language text not null default 'auto'
    check (ai_language in ('auto', 'en', 'id'));

-- Tiny helper RPC so the AI admin page can pull live RPM/RPD/TPM
-- against Google's free-tier limits in a single round-trip rather than
-- three separate count() queries. Developer-only via the SELECT RLS
-- already in place on api_usage_logs (this just sums what the caller
-- can already see).
create or replace function public.api_usage_recent_window()
returns table(
  rpm_now      integer,
  rpd_now      integer,
  tpm_now      integer,
  rpm_errors   integer
)
language sql
security definer
set search_path = public
stable
as $function$
  with recent_minute as (
    select * from public.api_usage_logs
    where created_at > now() - interval '1 minute'
      and cache_status in ('miss','error')
  ),
  recent_day as (
    select * from public.api_usage_logs
    where created_at > now() - interval '1 day'
      and cache_status in ('miss','error')
  )
  select
    (select count(*)::int from recent_minute) as rpm_now,
    (select count(*)::int from recent_day)    as rpd_now,
    (select coalesce(sum(input_tokens), 0)::int from recent_minute) as tpm_now,
    (select count(*)::int from recent_minute where cache_status = 'error') as rpm_errors;
$function$;
