-- One custom routine per user (days + exercises as JSON). Seeded from the app
-- default on first access; edited in later phases.
create table if not exists public.user_routines (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  version    int    not null default 1,
  routine    jsonb  not null,
  updated_at bigint not null
);

alter table public.user_routines enable row level security;

revoke all on public.user_routines from anon;
grant select, insert, update, delete on public.user_routines to authenticated;

drop policy if exists "user_routines_select_own" on public.user_routines;
create policy "user_routines_select_own" on public.user_routines
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "user_routines_insert_own" on public.user_routines;
create policy "user_routines_insert_own" on public.user_routines
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "user_routines_update_own" on public.user_routines;
create policy "user_routines_update_own" on public.user_routines
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_routines_delete_own" on public.user_routines;
create policy "user_routines_delete_own" on public.user_routines
  for delete to authenticated using ((select auth.uid()) = user_id);
