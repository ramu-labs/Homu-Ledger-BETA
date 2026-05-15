-- v1.30.0 — Signed-in Devices feature.
--
-- Three SECURITY DEFINER RPCs that let a signed-in user manage their
-- own auth.sessions rows without exposing the auth schema directly:
--
--   list_user_sessions()      → rows for THIS user, with is_current
--                               (from auth.jwt() session_id) and
--                               is_signed_out (no live refresh tokens)
--   sign_out_session(id)      → revoke the session's refresh tokens.
--                               Next time that device tries to refresh
--                               its access token it gets bounced. Row
--                               stays so the user can see what was
--                               kicked, then choose to delete it.
--   delete_user_session(id)   → remove the auth.sessions row entirely.
--                               Cascades to auth.refresh_tokens. After
--                               this the device is gone from the list.
--
-- Every RPC re-checks `auth.uid() = sessions.user_id` so a user can't
-- touch someone else's sessions even with a hand-crafted session_id.

create or replace function public.list_user_sessions()
returns table(
  id            uuid,
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
    s.user_agent,
    host(s.ip)::text as ip,
    s.created_at,
    s.refreshed_at,
    (s.id = v_current_session) as is_current,
    -- Signed-out = every refresh token for the session is revoked (or
    -- there are none). NULL counts as "yes signed out" because a session
    -- with no refresh tokens can't ever come back without re-login.
    not exists (
      select 1 from auth.refresh_tokens rt
      where rt.session_id = s.id and coalesce(rt.revoked, false) = false
    ) as is_signed_out
  from auth.sessions s
  where s.user_id = v_user
  order by
    -- Always pin the current device on top; then most-recently-active
    -- first so the user sees their last few sessions before stale ones.
    (s.id = v_current_session) desc,
    s.refreshed_at desc nulls last,
    s.created_at desc;
end;
$function$;

create or replace function public.sign_out_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Ownership check: the session has to belong to the calling user.
  -- Returns the same error message regardless of whether the row is
  -- missing or belongs to someone else (don't leak existence).
  if not exists (
    select 1 from auth.sessions where id = p_session_id and user_id = v_user
  ) then
    raise exception 'Session not found' using errcode = 'no_data_found';
  end if;

  -- Revoke (don't delete) so the row remains for accounting until the
  -- user explicitly hits Delete. Next refresh attempt fails → bounce.
  update auth.refresh_tokens
     set revoked = true,
         updated_at = now()
   where session_id = p_session_id
     and coalesce(revoked, false) = false;
end;
$function$;

create or replace function public.delete_user_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from auth.sessions where id = p_session_id and user_id = v_user
  ) then
    raise exception 'Session not found' using errcode = 'no_data_found';
  end if;

  -- FK on auth.refresh_tokens(session_id) → auth.sessions(id) is
  -- ON DELETE CASCADE in the stock Supabase schema, so this also
  -- removes any lingering tokens for the session.
  delete from auth.sessions where id = p_session_id and user_id = v_user;
end;
$function$;
