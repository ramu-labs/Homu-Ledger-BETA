-- 0021_feedback_followups.sql
--
-- Follow-ups to 0020_feedback_ticketing.sql:
--   1. RLS perf: replace per-row auth.uid() with (select auth.uid())
--   2. Security: revoke public/anon EXECUTE on helper SECURITY DEFINER functions
--   3. Perf: add covering indexes for the two unindexed foreign keys
--   4. Realtime: add `feedback` table to supabase_realtime publication so the
--      dev queue can subscribe to INSERT events for the pop-up notification
--      and users can subscribe to UPDATE events for dev replies on their own
--      tickets.

-- 1. RLS init-plan fixes ────────────────────────────────────────────────────
alter policy "feedback: caller can insert own" on public.feedback
  with check (created_by = (select auth.uid()));

alter policy "feedback: caller can read own or dev reads all" on public.feedback
  using (
    created_by = (select auth.uid())
    or public.is_developer_caller()
  );

-- 2. Lock down helper SECURITY DEFINER functions ────────────────────────────
-- These are only meant to be called from inside RLS policies, never via RPC.
revoke execute on function public.is_developer_caller()                from public, anon;
revoke execute on function public.can_access_feedback_attachment(text) from public, anon;

-- 3. Cover the two unindexed foreign keys ──────────────────────────────────
create index if not exists feedback_household_id_idx on public.feedback (household_id);
create index if not exists feedback_replied_by_idx   on public.feedback (replied_by);

-- 4. Enable Realtime on the feedback table ─────────────────────────────────
-- Idempotent: only add if not already in the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback'
  ) then
    alter publication supabase_realtime add table public.feedback;
  end if;
end $$;
