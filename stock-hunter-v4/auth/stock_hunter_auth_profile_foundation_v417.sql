-- Stock Hunter 4.1.7 Auth/Profile Foundation
-- Canonical SQL matching live Supabase migrations applied 2026-09-19:
--   stock_hunter_auth_profile_foundation_v417
--   stock_hunter_auth_foundation_hardening_v417
--
-- This is a repository attestation/source copy. Check Supabase migration history
-- before replaying it in any environment.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists public.stock_hunter_user_roles_v417 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('owner_admin','admin','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_hunter_profiles_v417 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  account_status text not null default 'active' check (account_status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.stock_hunter_user_preferences_v417 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  page_size integer not null default 25 check (page_size in (15,25,50,100)),
  visible_columns jsonb not null default '[]'::jsonb,
  hunt_filter text,
  decision_filter text,
  notification_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_hunter_watchlists_v417 (
  watchlist_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, user_id)
);

create index if not exists stock_hunter_watchlists_v417_user_idx
  on public.stock_hunter_watchlists_v417(user_id);

create table if not exists public.stock_hunter_watchlist_items_v417 (
  watchlist_item_id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ins_code text not null,
  symbol text,
  created_at timestamptz not null default now(),
  unique (watchlist_id, ins_code),
  foreign key (watchlist_id, user_id)
    references public.stock_hunter_watchlists_v417(watchlist_id, user_id)
    on delete cascade
);

create index if not exists stock_hunter_watchlist_items_v417_user_idx
  on public.stock_hunter_watchlist_items_v417(user_id);
create index if not exists stock_hunter_watchlist_items_v417_watchlist_user_idx
  on public.stock_hunter_watchlist_items_v417(watchlist_id, user_id);

alter table public.stock_hunter_user_roles_v417 enable row level security;
alter table public.stock_hunter_profiles_v417 enable row level security;
alter table public.stock_hunter_user_preferences_v417 enable row level security;
alter table public.stock_hunter_watchlists_v417 enable row level security;
alter table public.stock_hunter_watchlist_items_v417 enable row level security;

revoke all on public.stock_hunter_user_roles_v417 from anon, authenticated;
revoke all on public.stock_hunter_profiles_v417 from anon, authenticated;
revoke all on public.stock_hunter_user_preferences_v417 from anon, authenticated;
revoke all on public.stock_hunter_watchlists_v417 from anon, authenticated;
revoke all on public.stock_hunter_watchlist_items_v417 from anon, authenticated;

grant select on public.stock_hunter_user_roles_v417 to authenticated;
grant select on public.stock_hunter_profiles_v417 to authenticated;
grant update (display_name, avatar_url, last_seen_at) on public.stock_hunter_profiles_v417 to authenticated;
grant select on public.stock_hunter_user_preferences_v417 to authenticated;
grant update (theme, page_size, visible_columns, hunt_filter, decision_filter, notification_settings)
  on public.stock_hunter_user_preferences_v417 to authenticated;
grant select, insert, update, delete on public.stock_hunter_watchlists_v417 to authenticated;
grant select, insert, update, delete on public.stock_hunter_watchlist_items_v417 to authenticated;

grant all on public.stock_hunter_user_roles_v417 to service_role;
grant all on public.stock_hunter_profiles_v417 to service_role;
grant all on public.stock_hunter_user_preferences_v417 to service_role;
grant all on public.stock_hunter_watchlists_v417 to service_role;
grant all on public.stock_hunter_watchlist_items_v417 to service_role;

create policy stock_hunter_roles_own_select_v417
on public.stock_hunter_user_roles_v417 for select to authenticated
using ((select auth.uid()) = user_id);

create policy stock_hunter_profiles_own_select_v417
on public.stock_hunter_profiles_v417 for select to authenticated
using ((select auth.uid()) = user_id);
create policy stock_hunter_profiles_own_update_v417
on public.stock_hunter_profiles_v417 for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy stock_hunter_preferences_own_select_v417
on public.stock_hunter_user_preferences_v417 for select to authenticated
using ((select auth.uid()) = user_id);
create policy stock_hunter_preferences_own_update_v417
on public.stock_hunter_user_preferences_v417 for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy stock_hunter_watchlists_own_select_v417
on public.stock_hunter_watchlists_v417 for select to authenticated
using ((select auth.uid()) = user_id);
create policy stock_hunter_watchlists_own_insert_v417
on public.stock_hunter_watchlists_v417 for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy stock_hunter_watchlists_own_update_v417
on public.stock_hunter_watchlists_v417 for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy stock_hunter_watchlists_own_delete_v417
on public.stock_hunter_watchlists_v417 for delete to authenticated
using ((select auth.uid()) = user_id);

create policy stock_hunter_watchlist_items_own_select_v417
on public.stock_hunter_watchlist_items_v417 for select to authenticated
using ((select auth.uid()) = user_id);
create policy stock_hunter_watchlist_items_own_insert_v417
on public.stock_hunter_watchlist_items_v417 for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy stock_hunter_watchlist_items_own_update_v417
on public.stock_hunter_watchlist_items_v417 for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy stock_hunter_watchlist_items_own_delete_v417
on public.stock_hunter_watchlist_items_v417 for delete to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.stock_hunter_provision_user_v417()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into public.stock_hunter_user_roles_v417(user_id, role)
  values (new.id, 'user') on conflict (user_id) do nothing;

  insert into public.stock_hunter_profiles_v417(user_id, display_name)
  values (new.id, nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name','')), ''))
  on conflict (user_id) do nothing;

  insert into public.stock_hunter_user_preferences_v417(user_id)
  values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.stock_hunter_provision_user_v417() from public, anon, authenticated;

drop trigger if exists stock_hunter_provision_user_v417 on auth.users;
create trigger stock_hunter_provision_user_v417
after insert on auth.users
for each row execute function private.stock_hunter_provision_user_v417();

-- Hardening migration:
-- A public SECURITY DEFINER auth-context RPC was deliberately removed after
-- Supabase Security Advisor flagged it. Browser clients read their own role/profile
-- directly through RLS instead.
drop function if exists public.stock_hunter_auth_context_v417();
