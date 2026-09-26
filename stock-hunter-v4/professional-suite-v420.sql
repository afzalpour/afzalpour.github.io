-- Stock Hunter Professional Suite v4.2.0
-- User-owned professional features. Frozen Hunt 4.1.6 is not modified.
-- Runtime secrets (VAPID private key / cron token) are intentionally NOT stored in this file.

create table if not exists public.stock_hunter_smart_watchlists_v420 (
  smart_watchlist_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  rule_json jsonb not null default '{}'::jsonb check (jsonb_typeof(rule_json)='object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);
alter table public.stock_hunter_smart_watchlists_v420 enable row level security;
grant select,insert,update,delete on public.stock_hunter_smart_watchlists_v420 to authenticated;
create policy "smart_watchlists_select_own_v420" on public.stock_hunter_smart_watchlists_v420 for select to authenticated using ((select auth.uid())=user_id);
create policy "smart_watchlists_insert_own_v420" on public.stock_hunter_smart_watchlists_v420 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "smart_watchlists_update_own_v420" on public.stock_hunter_smart_watchlists_v420 for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "smart_watchlists_delete_own_v420" on public.stock_hunter_smart_watchlists_v420 for delete to authenticated using ((select auth.uid())=user_id);
create index if not exists stock_hunter_smart_watchlists_user_v420 on public.stock_hunter_smart_watchlists_v420(user_id,updated_at desc);

create table if not exists public.stock_hunter_decision_journal_v420 (
  decision_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_date date not null,
  symbol_id text not null,
  symbol text not null,
  context text not null default 'LIVE' check (context in ('LIVE','REPLAY')),
  decision text not null check (decision in ('OBSERVED','ENTERED','SKIPPED')),
  reason text,
  note text,
  hunt_state text,
  hunt_score numeric,
  entry_price numeric,
  exit_price numeric,
  outcome_pct numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stock_hunter_decision_journal_v420 enable row level security;
grant select,insert,update,delete on public.stock_hunter_decision_journal_v420 to authenticated;
create policy "decision_journal_select_own_v420" on public.stock_hunter_decision_journal_v420 for select to authenticated using ((select auth.uid())=user_id);
create policy "decision_journal_insert_own_v420" on public.stock_hunter_decision_journal_v420 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "decision_journal_update_own_v420" on public.stock_hunter_decision_journal_v420 for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "decision_journal_delete_own_v420" on public.stock_hunter_decision_journal_v420 for delete to authenticated using ((select auth.uid())=user_id);
create index if not exists stock_hunter_decision_journal_user_date_v420 on public.stock_hunter_decision_journal_v420(user_id,trade_date desc,created_at desc);

create table if not exists public.stock_hunter_workspace_v420 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null default '{}'::jsonb check (jsonb_typeof(layout)='object'),
  updated_at timestamptz not null default now()
);
alter table public.stock_hunter_workspace_v420 enable row level security;
grant select,insert,update,delete on public.stock_hunter_workspace_v420 to authenticated;
create policy "workspace_select_own_v420" on public.stock_hunter_workspace_v420 for select to authenticated using ((select auth.uid())=user_id);
create policy "workspace_insert_own_v420" on public.stock_hunter_workspace_v420 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "workspace_update_own_v420" on public.stock_hunter_workspace_v420 for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "workspace_delete_own_v420" on public.stock_hunter_workspace_v420 for delete to authenticated using ((select auth.uid())=user_id);

create table if not exists public.stock_hunter_push_public_v420 (
  id smallint primary key check (id=1),
  vapid_public_key text not null,
  updated_at timestamptz not null default now()
);
alter table public.stock_hunter_push_public_v420 enable row level security;
grant select on public.stock_hunter_push_public_v420 to anon,authenticated;
create policy "push_public_read_v420" on public.stock_hunter_push_public_v420 for select to anon,authenticated using (true);

create table if not exists public.stock_hunter_push_private_v420 (
  id smallint primary key check (id=1),
  vapid_private_key text not null,
  cron_token_sha256 text not null,
  subject text not null,
  last_dispatch_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.stock_hunter_push_private_v420 enable row level security;
revoke all on public.stock_hunter_push_private_v420 from anon,authenticated;
grant select,update on public.stock_hunter_push_private_v420 to service_role;

create table if not exists public.stock_hunter_push_subscriptions_v420 (
  subscription_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  levels jsonb not null default '["early","special","success"]'::jsonb check (jsonb_typeof(levels)='array'),
  enabled boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text,
  unique(user_id,endpoint)
);
alter table public.stock_hunter_push_subscriptions_v420 enable row level security;
grant select,insert,update,delete on public.stock_hunter_push_subscriptions_v420 to authenticated;
create policy "push_subscriptions_select_own_v420" on public.stock_hunter_push_subscriptions_v420 for select to authenticated using ((select auth.uid())=user_id);
create policy "push_subscriptions_insert_own_v420" on public.stock_hunter_push_subscriptions_v420 for insert to authenticated with check ((select auth.uid())=user_id);
create policy "push_subscriptions_update_own_v420" on public.stock_hunter_push_subscriptions_v420 for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "push_subscriptions_delete_own_v420" on public.stock_hunter_push_subscriptions_v420 for delete to authenticated using ((select auth.uid())=user_id);
create index if not exists stock_hunter_push_subscriptions_enabled_v420 on public.stock_hunter_push_subscriptions_v420(enabled,user_id);

create table if not exists public.stock_hunter_push_delivery_v420 (
  delivery_id bigint generated by default as identity primary key,
  subscription_id uuid not null references public.stock_hunter_push_subscriptions_v420(subscription_id) on delete cascade,
  event_key text not null,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','GONE')),
  error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(subscription_id,event_key)
);
alter table public.stock_hunter_push_delivery_v420 enable row level security;
revoke all on public.stock_hunter_push_delivery_v420 from anon,authenticated;
grant select,insert,update,delete on public.stock_hunter_push_delivery_v420 to service_role;
create index if not exists stock_hunter_push_delivery_created_v420 on public.stock_hunter_push_delivery_v420(created_at desc);

-- Operational setup after migration:
-- 1) insert public VAPID key into stock_hunter_push_public_v420.
-- 2) insert private VAPID key + SHA-256 of the cron token into stock_hunter_push_private_v420 using an admin-only channel.
-- 3) store the raw cron token in Supabase Vault.
-- 4) schedule stock-hunter-cloud-push-v420 once per minute with pg_cron + pg_net and pass the Vault token as x-stock-hunter-cron.
