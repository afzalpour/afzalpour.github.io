-- Stock Hunter 4.1.6 Research Lab
-- Hunt Journey + event backtest + missed-opportunity audit + bounded retention.
-- Frozen Hunt scoring is not modified by this contract.

create table if not exists public.stock_hunter_hunt_journey_v416(
  channel text not null check(channel in ('ACTION_NOW','RADAR')),
  trade_date date not null,symbol_id text not null,symbol text not null,company_name text,
  asset_type text,market text,hunt_mode text not null check(hunt_mode in ('reversal','acceleration')),
  hunt_state text not null,detected_at timestamptz not null,detected_price numeric not null,
  detected_day_change numeric,hunt_score numeric,today_opportunity numeric,evidence_count integer,
  dynamic_evidence_count integer,reference_yesterday_price numeric,crossed_zero_at timestamptz,
  crossed_plus1_at timestamptz,crossed_plus2_at timestamptz,crossed_plus3_at timestamptz,
  time_to_zero_min numeric,time_to_plus1_min numeric,time_to_plus2_min numeric,time_to_plus3_min numeric,
  same_day_max_change_pct numeric,same_day_close_change_pct numeric,same_day_mfe_pct numeric,
  same_day_mae_pct numeric,same_day_buy_queue_any boolean,d1_session_date date,d1_close_change_pct numeric,
  d1_return_from_alert_pct numeric,d1_mfe_pct numeric,d1_mae_pct numeric,d1_positive_close boolean,
  d1_hit_plus1 boolean,d1_hit_plus2 boolean,d1_hit_plus3 boolean,carry_status text,
  carry_peak_price_15m numeric,carry_trough_price_15m numeric,carry_mfe_from_detect_15m numeric,
  carry_mae_from_detect_15m numeric,carry_mfe_from_cross_15m numeric,carry_mae_from_cross_15m numeric,
  result_label text,updated_at timestamptz not null default now(),
  primary key(channel,trade_date,symbol_id)
);
create index if not exists stock_hunter_hunt_journey_v416_date_idx on public.stock_hunter_hunt_journey_v416(trade_date desc,channel,hunt_mode);
create index if not exists stock_hunter_hunt_journey_v416_symbol_idx on public.stock_hunter_hunt_journey_v416(symbol,trade_date desc);

alter table public.stock_hunter_hunt_journey_v416
  add column if not exists order_pressure numeric,
  add column if not exists impulse numeric,
  add column if not exists feasibility numeric,
  add column if not exists flow_volume numeric,
  add column if not exists market_context numeric,
  add column if not exists continuation12 numeric,
  add column if not exists risk_score numeric,
  add column if not exists cancellation_ratio numeric,
  add column if not exists gate_reason text;


create table if not exists public.stock_hunter_backtest_daily_v416(
  trade_date date not null,channel text not null,hunt_mode text not null,hunt_state text not null,
  signal_count integer not null default 0,observed_count integer not null default 0,
  crossed_zero_count integer not null default 0,hit_plus1_count integer not null default 0,
  hit_plus2_count integer not null default 0,hit_plus3_count integer not null default 0,
  positive_close_count integer not null default 0,buy_queue_count integer not null default 0,
  crossed_zero_rate numeric,hit_plus1_rate numeric,hit_plus2_rate numeric,hit_plus3_rate numeric,
  positive_close_rate numeric,buy_queue_rate numeric,avg_hunt_score numeric,avg_mfe_pct numeric,
  median_mfe_pct numeric,avg_mae_pct numeric,median_mae_pct numeric,avg_time_to_zero_min numeric,
  avg_time_to_plus1_min numeric,avg_time_to_plus2_min numeric,d1_observed_count integer not null default 0,
  d1_positive_close_rate numeric,d1_hit_plus1_rate numeric,d1_hit_plus2_rate numeric,d1_hit_plus3_rate numeric,
  precision_count integer not null default 0,precision_rate numeric,
  median_time_to_zero_min numeric,median_time_to_plus1_min numeric,median_time_to_plus2_min numeric,
  updated_at timestamptz not null default now(),
  primary key(trade_date,channel,hunt_mode,hunt_state)
);
create index if not exists stock_hunter_backtest_daily_v416_date_idx on public.stock_hunter_backtest_daily_v416(trade_date desc,channel,hunt_mode);

create table if not exists public.stock_hunter_missed_opportunities_v416(
  trade_date date not null,symbol_id text not null,symbol text not null,company_name text,asset_type text,market text,
  low_at timestamptz not null,low_price numeric not null,low_change_pct numeric not null,crossed_zero_at timestamptz,
  crossed_plus1_at timestamptz,crossed_plus2_at timestamptz,crossed_plus3_at timestamptz,
  peak_at timestamptz not null,peak_price numeric not null,peak_change_pct numeric not null,rebound_points numeric not null,
  best_shadow_at timestamptz,best_shadow_state text,best_hunt_score numeric,best_today_opportunity numeric,
  best_risk_score numeric,best_evidence_count integer,best_dynamic_evidence_count integer,best_gate_reason text,
  late_event_at timestamptz,miss_reason_code text not null,miss_reason_text text not null,
  severity text not null check(severity in ('HIGH','MEDIUM')),updated_at timestamptz not null default now(),
  primary key(trade_date,symbol_id)
);
create index if not exists stock_hunter_missed_opportunities_v416_date_idx on public.stock_hunter_missed_opportunities_v416(trade_date desc,severity,peak_change_pct desc);
create index if not exists stock_hunter_missed_opportunities_v416_symbol_idx on public.stock_hunter_missed_opportunities_v416(symbol,trade_date desc);

create table if not exists public.stock_hunter_market_replay_v416(
  trade_date date not null,symbol_id text not null,symbol text not null,bucket_at timestamptz not null,
  open_price numeric,high_price numeric,low_price numeric,close_price numeric,yesterday_price numeric,
  open_change_pct numeric,high_change_pct numeric,low_change_pct numeric,close_change_pct numeric,
  max_buy_queue numeric,max_sell_queue numeric,last_volume numeric,sample_count integer not null default 0,
  bucket_seconds integer not null default 30,updated_at timestamptz not null default now(),primary key(trade_date,symbol_id,bucket_at)
);
create index if not exists stock_hunter_market_replay_v416_date_idx on public.stock_hunter_market_replay_v416(trade_date desc,bucket_at,symbol_id);
create index if not exists stock_hunter_market_replay_v416_symbol_idx on public.stock_hunter_market_replay_v416(symbol,trade_date desc,bucket_at);
alter table public.stock_hunter_market_replay_v416 enable row level security;
drop policy if exists "stock hunter replay public read" on public.stock_hunter_market_replay_v416;
create policy "stock hunter replay public read" on public.stock_hunter_market_replay_v416 for select to anon,authenticated using(true);
revoke all on public.stock_hunter_market_replay_v416 from anon,authenticated;
grant select on public.stock_hunter_market_replay_v416 to anon,authenticated;

create or replace view public.stock_hunter_market_replay_symbols_v416
with (security_invoker=true) as
select trade_date,symbol_id,max(symbol) symbol,count(*)::integer bucket_count,min(bucket_seconds)::integer resolution_seconds
from public.stock_hunter_market_replay_v416
group by trade_date,symbol_id;
grant select on public.stock_hunter_market_replay_symbols_v416 to anon,authenticated;

create table if not exists public.stock_hunter_reliability_v416(
  observed_at timestamptz primary key,trade_date date not null,market_session boolean not null default false,
  feed_status text,feed_source text,feed_symbols integer,agent_version text,feed_last_at timestamptz,feed_age_seconds integer,
  capture_last_success_at timestamptz,capture_age_seconds integer,capture_event_count integer,capture_has_error boolean,
  tape_last_capture_at timestamptz,tape_capture_count integer,effectiveness_last_refresh_at timestamptz,effectiveness_refresh_count integer,
  journey_count_today integer,backtest_group_count_today integer,carry_active_count integer,missed_count_today integer,
  overall_state text check(overall_state in ('سالم','نیازمند توجه','خارج از ساعت بازار'))
);

create table if not exists public.stock_hunter_research_retention_v416(
  dataset text primary key,retention_days integer not null check(retention_days>0),tier text not null,
  purpose text not null,updated_at timestamptz not null default now()
);
insert into public.stock_hunter_research_retention_v416(dataset,retention_days,tier,purpose) values
 ('RAW_MARKET_TAPE',14,'RAW','داده خام کوتاه‌مدت برای ساخت سفر شکار و ممیزی فرصت‌های از دست‌رفته'),
 ('SHADOW_SAMPLES',30,'RAW','نمونه‌های پایش برای تحلیل علت شکار یا عدم شکار؛ نمونه‌های قرنطینه کیفی نگه داشته می‌شوند'),
 ('OUTCOME_OBSERVATIONS',30,'RAW','ورودی موقت برای محاسبه خروجی‌های خلاصه‌شده'),
 ('HUNT_EVENTS',180,'COMPACT','رخدادهای رسمی شکار برای تحلیل جزئی'),
 ('HUNT_EFFECTIVENESS',180,'COMPACT','بیشترین پیشروی و افت و نتیجه همان‌روز و روز کاری بعد'),
 ('HUNT_CARRY',180,'COMPACT','پیگیری ۱۵ دقیقه‌ای عبور موفق'),
 ('HUNT_JOURNEY',180,'COMPACT','خط زمانی فشرده سفر شکار همراه با مؤلفه‌های توضیح‌پذیری'),
 ('MISSED_OPPORTUNITIES',180,'COMPACT','ممیزی فرصت‌های از دست‌رفته و علت آن'),
 ('BACKTEST_DAILY',1095,'SUMMARY','خلاصه روزانه سبک برای آزمون تاریخی بلندمدت'),
 ('BACKTEST_SLICES',1095,'SUMMARY','خلاصه سبک آزمون تاریخی به تفکیک ساعت، بازار، نقدشوندگی و رژیم'),
 ('MARKET_REPLAY_30SEC',30,'COMPACT','بازپخش فشرده سی‌ثانیه‌ای فقط برای نمادهای مرتبط با شکار'),
 ('RELIABILITY_SNAPSHOTS',30,'SUMMARY','نماهای سبک پایداری داده بازار، ثبت شکار و پژوهش')
on conflict(dataset) do update set retention_days=excluded.retention_days,tier=excluded.tier,purpose=excluded.purpose,updated_at=now();

alter table public.stock_hunter_hunt_journey_v416 enable row level security;
alter table public.stock_hunter_backtest_daily_v416 enable row level security;
alter table public.stock_hunter_missed_opportunities_v416 enable row level security;
alter table public.stock_hunter_research_retention_v416 enable row level security;
alter table public.stock_hunter_reliability_v416 enable row level security;
drop policy if exists "stock hunter reliability public read" on public.stock_hunter_reliability_v416;
create policy "stock hunter reliability public read" on public.stock_hunter_reliability_v416 for select to anon,authenticated using(true);
revoke all on public.stock_hunter_reliability_v416 from anon,authenticated;
grant select on public.stock_hunter_reliability_v416 to anon,authenticated;
drop policy if exists "stock hunter journey public read" on public.stock_hunter_hunt_journey_v416;
create policy "stock hunter journey public read" on public.stock_hunter_hunt_journey_v416 for select to anon,authenticated using(true);
drop policy if exists "stock hunter backtest public read" on public.stock_hunter_backtest_daily_v416;
create policy "stock hunter backtest public read" on public.stock_hunter_backtest_daily_v416 for select to anon,authenticated using(true);
drop policy if exists "stock hunter missed public read" on public.stock_hunter_missed_opportunities_v416;
create policy "stock hunter missed public read" on public.stock_hunter_missed_opportunities_v416 for select to anon,authenticated using(true);
drop policy if exists "stock hunter retention public read" on public.stock_hunter_research_retention_v416;
create policy "stock hunter retention public read" on public.stock_hunter_research_retention_v416 for select to anon,authenticated using(true);
revoke all on public.stock_hunter_hunt_journey_v416,public.stock_hunter_backtest_daily_v416,public.stock_hunter_missed_opportunities_v416,public.stock_hunter_research_retention_v416 from anon,authenticated;
grant select on public.stock_hunter_hunt_journey_v416,public.stock_hunter_backtest_daily_v416,public.stock_hunter_missed_opportunities_v416,public.stock_hunter_research_retention_v416 to anon,authenticated;

-- The deployed private refresh functions intentionally live outside the exposed API schema:
-- private.refresh_stock_hunter_hunt_journey_v416(integer)
-- private.refresh_stock_hunter_backtest_daily_v416(integer)
-- private.refresh_stock_hunter_missed_opportunities_v416(date)
-- private.refresh_stock_hunter_research_v416()
-- private.cleanup_stock_hunter_research_v416()
-- private.refresh_stock_hunter_market_replay_v416(date)
-- private.cleanup_stock_hunter_market_replay_v416()
-- private.capture_stock_hunter_reliability_v416()
-- They are EXECUTE-revoked from PUBLIC/anon/authenticated and are invoked only by pg_cron/admin.
--
-- Retention contract:
-- Raw market tape 14d; ordinary shadow/outcome 30d; compact thirty-second replay 30d;
-- detailed event/effectiveness/carry/journey/missed 180d; daily backtest summary 1095d.
-- Immutable quality-quarantine samples are preserved. Refresh cron runs every 5m during market hours;
-- missed-opportunity audit runs after close with a safety rerun; cleanup runs daily.


-- Completion layer: breakdowns for the Backtest Lab.
create table if not exists public.stock_hunter_backtest_slices_v416(
  trade_date date not null,
  slice_type text not null check(slice_type in ('ساعت','بازار','نقدشوندگی','رژیم')),
  slice_value text not null,
  channel text not null check(channel in ('ACTION_NOW','RADAR')),
  hunt_mode text not null check(hunt_mode in ('reversal','acceleration')),
  hunt_state text not null,
  signal_count integer not null default 0,observed_count integer not null default 0,
  precision_count integer not null default 0,precision_rate numeric,
  crossed_zero_count integer not null default 0,crossed_zero_rate numeric,
  hit_plus1_count integer not null default 0,hit_plus1_rate numeric,
  hit_plus2_count integer not null default 0,hit_plus2_rate numeric,
  hit_plus3_count integer not null default 0,hit_plus3_rate numeric,
  median_mfe_pct numeric,median_mae_pct numeric,median_time_to_zero_min numeric,
  median_time_to_plus1_min numeric,avg_hunt_score numeric,updated_at timestamptz not null default now(),
  primary key(trade_date,slice_type,slice_value,channel,hunt_mode,hunt_state)
);
create index if not exists stock_hunter_backtest_slices_v416_date_idx
  on public.stock_hunter_backtest_slices_v416(trade_date desc,slice_type,hunt_mode);
alter table public.stock_hunter_backtest_slices_v416 enable row level security;
drop policy if exists "stock hunter backtest slices public read" on public.stock_hunter_backtest_slices_v416;
create policy "stock hunter backtest slices public read" on public.stock_hunter_backtest_slices_v416
  for select to anon,authenticated using(true);
revoke all on public.stock_hunter_backtest_slices_v416 from anon,authenticated;
grant select on public.stock_hunter_backtest_slices_v416 to anon,authenticated;

-- No-code Strategy Builder persistence. Strategies are private per authenticated user.
create table if not exists public.stock_hunter_user_strategies_v417(
  strategy_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 80),
  match_mode text not null default 'ALL' check(match_mode in ('ALL','ANY')),
  rules jsonb not null default '[]'::jsonb check(jsonb_typeof(rules)='array'),
  alert_enabled boolean not null default false,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists stock_hunter_user_strategies_v417_user_name_idx
  on public.stock_hunter_user_strategies_v417(user_id,lower(name));
create index if not exists stock_hunter_user_strategies_v417_user_updated_idx
  on public.stock_hunter_user_strategies_v417(user_id,updated_at desc);
alter table public.stock_hunter_user_strategies_v417 enable row level security;
revoke all on public.stock_hunter_user_strategies_v417 from anon,authenticated;
grant select,insert,update,delete on public.stock_hunter_user_strategies_v417 to authenticated;
drop policy if exists "stock hunter user strategies select own" on public.stock_hunter_user_strategies_v417;
drop policy if exists "stock hunter user strategies insert own" on public.stock_hunter_user_strategies_v417;
drop policy if exists "stock hunter user strategies update own" on public.stock_hunter_user_strategies_v417;
drop policy if exists "stock hunter user strategies delete own" on public.stock_hunter_user_strategies_v417;
create policy "stock hunter user strategies select own" on public.stock_hunter_user_strategies_v417
  for select to authenticated using((select auth.uid()) is not null and (select auth.uid())=user_id);
create policy "stock hunter user strategies insert own" on public.stock_hunter_user_strategies_v417
  for insert to authenticated with check((select auth.uid()) is not null and (select auth.uid())=user_id);
create policy "stock hunter user strategies update own" on public.stock_hunter_user_strategies_v417
  for update to authenticated using((select auth.uid()) is not null and (select auth.uid())=user_id)
  with check((select auth.uid()) is not null and (select auth.uid())=user_id);
create policy "stock hunter user strategies delete own" on public.stock_hunter_user_strategies_v417
  for delete to authenticated using((select auth.uid()) is not null and (select auth.uid())=user_id);

-- Live private refresh functions additionally maintain:
-- private.refresh_stock_hunter_backtest_slices_v416(integer)
-- Replay aggregation uses 30-second buckets. Tracked-symbol tape capture is scheduled every 30 seconds,
-- while compact replay refresh is scheduled every two minutes during market hours.


-- strategy_match_mode_any_v417: deployed 2026-09-26
-- Cloud strategies accept ALL (و) or ANY (یا); this changes only user-defined research strategies.
