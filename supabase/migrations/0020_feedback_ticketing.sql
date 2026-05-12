-- 0020_feedback_ticketing.sql
--
-- Simple in-app feedback / ticketing system. Users (any authenticated user)
-- submit feedback via Settings → Help & Feedback. Developers (profiles.is_developer = true)
-- see a global queue at Settings → Feedback Tickets with status controls
-- (open → in_progress → closed) and an optional reply.
--
-- Attachments: multiple screenshots + at most one video (the form caps size
-- client-side at 50 MB). Storage paths are kept in a text[] column;
-- a dedicated bucket `feedback-attachments` holds the blobs with RLS that
-- restricts read to the submitter or any developer.

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,
  household_id  uuid references public.households (id) on delete set null,
  subject       text not null,
  body          text not null,
  category      text not null default 'other'
                  check (category in ('bug', 'feature', 'question', 'other')),
  status        text not null default 'open'
                  check (status in ('open', 'in_progress', 'closed')),
  attachments   text[] not null default '{}',
  reply         text,
  replied_at    timestamptz,
  replied_by    uuid references public.profiles (id) on delete set null
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status);
create index if not exists feedback_created_by_idx on public.feedback (created_by);

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.feedback enable row level security;

-- Helper: caller is a developer
create or replace function public.is_developer_caller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_developer from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_developer_caller() to authenticated;

drop policy if exists "feedback: caller can insert own" on public.feedback;
create policy "feedback: caller can insert own"
  on public.feedback for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "feedback: caller can read own or dev reads all" on public.feedback;
create policy "feedback: caller can read own or dev reads all"
  on public.feedback for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_developer_caller()
  );

drop policy if exists "feedback: dev can update" on public.feedback;
create policy "feedback: dev can update"
  on public.feedback for update
  to authenticated
  using (public.is_developer_caller())
  with check (public.is_developer_caller());

drop policy if exists "feedback: dev can delete" on public.feedback;
create policy "feedback: dev can delete"
  on public.feedback for delete
  to authenticated
  using (public.is_developer_caller());

-- ── Storage bucket for attachments ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('feedback-attachments', 'feedback-attachments', false)
on conflict (id) do update set public = excluded.public;

-- Helper: does the caller own (or is a developer for) this object path?
-- Object path convention: <user_id>/<random>.<ext>
create or replace function public.can_access_feedback_attachment(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  -- First path segment is the owner uuid
  v_owner := nullif(split_part(p_path, '/', 1), '')::uuid;
  if v_owner is null then return false; end if;
  return v_owner = auth.uid() or public.is_developer_caller();
exception when others then
  return false;
end;
$$;

grant execute on function public.can_access_feedback_attachment(text) to authenticated;

drop policy if exists "feedback_attachments: caller can upload own" on storage.objects;
create policy "feedback_attachments: caller can upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'feedback-attachments'
    and public.can_access_feedback_attachment(name)
  );

drop policy if exists "feedback_attachments: caller or dev can read" on storage.objects;
create policy "feedback_attachments: caller or dev can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'feedback-attachments'
    and public.can_access_feedback_attachment(name)
  );

drop policy if exists "feedback_attachments: caller can delete own" on storage.objects;
create policy "feedback_attachments: caller can delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'feedback-attachments'
    and public.can_access_feedback_attachment(name)
  );
