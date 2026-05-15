-- v1.31.0 — Nickname column for auth.sessions rows.
--
-- We can't ALTER auth.sessions (Supabase-managed), so we side-car the
-- nickname in public.device_nicknames keyed by session id with an FK
-- cascade so the nickname disappears the instant the session does.

create table if not exists public.device_nicknames (
  session_id uuid primary key
    references auth.sessions(id) on delete cascade,
  user_id    uuid not null
    references auth.users(id) on delete cascade,
  nickname   text not null
    check (length(btrim(nickname)) > 0 and length(nickname) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_nicknames_user_idx
  on public.device_nicknames (user_id);

alter table public.device_nicknames enable row level security;

-- A user can read / write nicknames only for their own sessions.
-- The actual ownership check (session belongs to caller) is done in
-- the rename_device_session RPC, but we still gate read+write on
-- user_id so an exposed direct query doesn't leak other people's
-- nicknames.
create policy "device_nicknames: own read"
  on public.device_nicknames for select
  using (user_id = auth.uid());

create policy "device_nicknames: own insert"
  on public.device_nicknames for insert
  with check (user_id = auth.uid());

create policy "device_nicknames: own update"
  on public.device_nicknames for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "device_nicknames: own delete"
  on public.device_nicknames for delete
  using (user_id = auth.uid());

-- Rewrite list_user_sessions to include the (optional) nickname.
-- Returns empty-string when there's no nickname so the client doesn't
-- have to null-check; UI treats falsy as "use parsed UA label".
--
-- DROP first because the return type widens (adds the nickname column)
-- and Postgres CREATE OR REPLACE can't change return signatures.
drop function if exists public.list_user_sessions();

create function public.list_user_sessions()
returns table(
  id            uuid,
  nickname      text,
  user_agent    text,
  ip            text,
  created_at    timestamptz,
  refreshed_at  timestamp,
  is_current    boolean,
  is_signed_out boolean
)
language plpgsql
security definer
set search_path = public, auth
stable
as $function$
declare
  v_user            uuid := auth.uid();
  v_current_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    s.id,
    coalesce(dn.nickname, '')::text as nickname,
    s.user_agent,
    host(s.ip)::text as ip,
    s.created_at,
    s.refreshed_at,
    (s.id = v_current_session) as is_current,
    not exists (
      select 1 from auth.refresh_tokens rt
      where rt.session_id = s.id and coalesce(rt.revoked, false) = false
    ) as is_signed_out
  from auth.sessions s
  left join public.device_nicknames dn on dn.session_id = s.id
  where s.user_id = v_user
  order by
    (s.id = v_current_session) desc,
    s.refreshed_at desc nulls last,
    s.created_at desc;
end;
$function$;

-- Set / update / clear a session's nickname. Empty-string nickname
-- DELETEs the row (clears the nickname back to the parsed label).
create or replace function public.rename_device_session(
  p_session_id uuid,
  p_nickname   text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user    uuid := auth.uid();
  v_trimmed text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Ownership check first — same identical error for not-found vs
  -- not-yours so a hostile session_id can't be probed.
  if not exists (
    select 1 from auth.sessions where id = p_session_id and user_id = v_user
  ) then
    raise exception 'Session not found' using errcode = 'no_data_found';
  end if;

  v_trimmed := nullif(btrim(coalesce(p_nickname, '')), '');

  if v_trimmed is null then
    -- Clearing the nickname.
    delete from public.device_nicknames where session_id = p_session_id;
    return;
  end if;

  if length(v_trimmed) > 50 then
    raise exception 'Nickname too long' using errcode = 'string_data_right_truncation';
  end if;

  insert into public.device_nicknames (session_id, user_id, nickname, updated_at)
  values (p_session_id, v_user, v_trimmed, now())
  on conflict (session_id) do update
    set nickname   = excluded.nickname,
        updated_at = now();
end;
$function$;
