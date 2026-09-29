-- One row per logged session (ISO week + weekday) per user.
create table if not exists public.workout_logs (
  user_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  id         text   not null,
  week_key   text   not null check (week_key ~ '^\d{4}-W\d{2}$'),
  day        text   not null check (day in ('lunes', 'martes', 'miercoles', 'jueves', 'viernes')),
  exercises  jsonb  not null default '{}'::jsonb,
  updated_at bigint not null,
  primary key (user_id, id),
  check (id = week_key || ':' || day)
);

create index if not exists workout_logs_user_week_idx on public.workout_logs (user_id, week_key);

-- Row-level security is what keeps each user's statistics apart: the
-- publishable key shipped to the browser can only reach the caller's own rows.
alter table public.workout_logs enable row level security;

revoke all on public.workout_logs from anon;
grant select, insert, update, delete on public.workout_logs to authenticated;

drop policy if exists "workout_logs_select_own" on public.workout_logs;
create policy "workout_logs_select_own" on public.workout_logs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "workout_logs_insert_own" on public.workout_logs;
create policy "workout_logs_insert_own" on public.workout_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "workout_logs_update_own" on public.workout_logs;
create policy "workout_logs_update_own" on public.workout_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "workout_logs_delete_own" on public.workout_logs;
create policy "workout_logs_delete_own" on public.workout_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
