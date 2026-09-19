-- Canonical source for live Supabase migrations:
-- stock_hunter_auth_profile_foundation_v417
-- stock_hunter_auth_foundation_hardening_v417
--
-- The live database migration was applied before this file was committed.
-- Re-run through Supabase migration tooling only after checking migration history.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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

create index if not exists stock_hunter_watchlists_v417_user_idx on public.stock_hunter_watchlists_v417(user_id);
create index if not exists stock_hunter_watchlist_items_v417_user_idx on public.stock_hunter_watchlist_items_v417(user_id);
create index if not exists stock_hunter_watchlist_items_v417_watchlist_user_idx on public.stock_hunter_watchlist_items_v417(watchlist_id,user_id);

alter table public.stock_hunter_user_roles_v417 enable row level security;
alter table public.stock_hunter_profiles_v417 enable row level security;
alter table public.stock_hunter_user_preferences_v417 enable row level security;
alter table public.stock_hunter_watchlists_v417 enable row level security;
alter table public.stock_hunter_watchlist_items_v417 enable row level security;

-- See migration history for explicit grants, RLS policies and the auth.users provisioning trigger.
-- No public SECURITY DEFINER RPC is part of the final foundation.
