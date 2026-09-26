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

create table if not exists public.stock_hunter_research_retention_v416(
  dataset text primary key,retention_days integer not null check(retention_days>0),tier text not null,
  purpose text not null,updated_at timestamptz not null default now()
);
insert into public.stock_hunter_research_retention_v416(dataset,retention_days,tier,purpose) values
 ('RAW_MARKET_TAPE',14,'RAW','بازپخش کوتاه‌مدت، ساخت Journey و ممیزی فرصت‌های از دست‌رفته'),
 ('SHADOW_SAMPLES',30,'RAW','تحلیل علت شکار/عدم شکار و کنترل کیفیت کوتاه‌مدت'),
 ('OUTCOME_OBSERVATIONS',30,'RAW','ورودی موقت برای محاسبه خروجی‌های خلاصه‌شده'),
 ('HUNT_EVENTS',180,'COMPACT','رخدادهای رسمی شکار برای تحلیل جزئی'),
 ('HUNT_EFFECTIVENESS',180,'COMPACT','MFE/MAE و نتیجه همان‌روز/روز بعد'),
 ('HUNT_CARRY',180,'COMPACT','پیگیری ۱۵ دقیقه‌ای عبور موفق'),
 ('HUNT_JOURNEY',180,'COMPACT','خط زمانی فشرده هر شکار'),
 ('MISSED_OPPORTUNITIES',180,'COMPACT','ممیزی فرصت‌های از دست‌رفته و علت آن'),
 ('BACKTEST_DAILY',1095,'SUMMARY','خلاصه روزانه سبک برای بک‌تست بلندمدت')
on conflict(dataset) do update set retention_days=excluded.retention_days,tier=excluded.tier,purpose=excluded.purpose,updated_at=now();

alter table public.stock_hunter_hunt_journey_v416 enable row level security;
alter table public.stock_hunter_backtest_daily_v416 enable row level security;
alter table public.stock_hunter_missed_opportunities_v416 enable row level security;
alter table public.stock_hunter_research_retention_v416 enable row level security;
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
-- They are EXECUTE-revoked from PUBLIC/anon/authenticated and are invoked only by pg_cron/admin.
--
-- Retention contract:
-- RAW tape 14d; Shadow/outcome raw 30d; detailed compact event/effectiveness/carry/journey/missed 180d;
-- daily aggregate backtest 1095d. Refresh cron runs every 5m during market hours;
-- missed-opportunity audit runs after close with a safety rerun; cleanup runs daily.
