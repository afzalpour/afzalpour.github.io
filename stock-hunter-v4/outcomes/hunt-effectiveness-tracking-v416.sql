-- Stock Hunter Frozen Hunt 4.1.6 prospective effectiveness tracking
-- Live deployment: 2026-09-25
-- Prospective start date: 2026-09-26
-- This file does NOT alter Frozen Hunt formulas, thresholds or alert states.

begin;

create table if not exists public.stock_hunter_hunt_effectiveness_control_v416 (
  singleton boolean primary key default true check (singleton),
  prospective_start_date date not null,
  tape_retention_days integer not null default 30 check (tape_retention_days between 7 and 365),
  last_tape_capture_at timestamptz,
  last_tape_capture_count integer not null default 0,
  last_refresh_at timestamptz,
  last_refresh_count integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);
insert into public.stock_hunter_hunt_effectiveness_control_v416(singleton,prospective_start_date)
values (true,date '2026-09-26')
on conflict(singleton) do nothing;
alter table public.stock_hunter_hunt_effectiveness_control_v416 enable row level security;
revoke all on table public.stock_hunter_hunt_effectiveness_control_v416 from anon, authenticated;

create table if not exists public.stock_hunter_hunt_market_tape_v416 (
  observation_id bigint generated always as identity primary key,
  observation_date date not null,
  observed_at timestamptz not null,
  source_updated_at timestamptz not null,
  symbol_id text not null,
  symbol text not null,
  asset_type text,
  market text,
  last_price numeric not null,
  closing_price numeric,
  yesterday_price numeric,
  low_price numeric,
  high_price numeric,
  min_allowed numeric,
  max_allowed numeric,
  best_bid numeric,
  best_ask numeric,
  buy_queue numeric,
  sell_queue numeric,
  volume numeric,
  created_at timestamptz not null default now(),
  unique(symbol_id,source_updated_at)
);
create index if not exists stock_hunter_hunt_market_tape_v416_date_symbol_idx
  on public.stock_hunter_hunt_market_tape_v416(observation_date,symbol_id,observed_at);
create index if not exists stock_hunter_hunt_market_tape_v416_symbol_date_idx
  on public.stock_hunter_hunt_market_tape_v416(symbol_id,observation_date,observed_at);
alter table public.stock_hunter_hunt_market_tape_v416 enable row level security;
revoke all on table public.stock_hunter_hunt_market_tape_v416 from anon, authenticated;

create table if not exists public.stock_hunter_hunt_effectiveness_v416 (
  channel text not null check (channel in ('ACTION_NOW','RADAR')),
  trade_date date not null,
  symbol_id text not null,
  symbol text not null,
  company_name text,
  asset_type text,
  market text,
  alert_source_id bigint not null,
  hunt_mode text not null check (hunt_mode in ('reversal','acceleration')),
  hunt_state text not null,
  alert_at timestamptz not null,
  alert_price numeric not null,
  alert_day_change numeric,
  hunt_score numeric,
  today_opportunity numeric,
  reference_yesterday_price numeric,
  target_price numeric,
  same_day_observed boolean not null default false,
  same_day_max_change_pct numeric,
  same_day_close_change_pct numeric,
  same_day_mfe_from_alert_pct numeric,
  same_day_mae_from_alert_pct numeric,
  same_day_crossed_zero boolean,
  same_day_hit_plus1 boolean,
  same_day_hit_plus2 boolean,
  same_day_hit_plus3 boolean,
  same_day_mode_target_reached boolean,
  same_day_mode_target_closed boolean,
  same_day_buy_queue_any boolean,
  same_day_buy_queue_close boolean,
  same_day_buy_queue_snapshot_pct numeric,
  same_day_first_buy_queue_at timestamptz,
  d1_session_date date,
  d1_observed boolean not null default false,
  d1_max_change_pct numeric,
  d1_close_change_pct numeric,
  d1_return_from_alert_pct numeric,
  d1_mfe_from_alert_pct numeric,
  d1_mae_from_alert_pct numeric,
  d1_positive_close boolean,
  d1_hit_plus1 boolean,
  d1_hit_plus2 boolean,
  d1_hit_plus3 boolean,
  d1_buy_queue_any boolean,
  d1_buy_queue_close boolean,
  d1_buy_queue_snapshot_pct numeric,
  d1_first_buy_queue_at timestamptz,
  matured_same_day_at timestamptz,
  matured_d1_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(channel,trade_date,symbol_id)
);
create index if not exists stock_hunter_hunt_effectiveness_v416_date_idx
  on public.stock_hunter_hunt_effectiveness_v416(trade_date,channel,hunt_mode,hunt_state);
create index if not exists stock_hunter_hunt_effectiveness_v416_symbol_idx
  on public.stock_hunter_hunt_effectiveness_v416(symbol_id,trade_date);
alter table public.stock_hunter_hunt_effectiveness_v416 enable row level security;
revoke all on table public.stock_hunter_hunt_effectiveness_v416 from anon, authenticated;

CREATE OR REPLACE FUNCTION private.capture_stock_hunter_hunt_market_tape_v416()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_now_tehran timestamp := pg_catalog.now() at time zone 'Asia/Tehran';
  v_today date := (pg_catalog.now() at time zone 'Asia/Tehran')::date;
  v_isodow integer := extract(isodow from (pg_catalog.now() at time zone 'Asia/Tehran'))::integer;
  v_start date;
  v_retention integer;
  v_count integer := 0;
begin
  select prospective_start_date,tape_retention_days
    into v_start,v_retention
  from public.stock_hunter_hunt_effectiveness_control_v416
  where singleton=true;

  if v_isodow in (4,5)
     or v_now_tehran::time < time '08:55'
     or v_now_tehran::time > time '13:05'
  then
    return 0;
  end if;

  with tracked as (
    select distinct e.symbol_id
      from public.stock_hunter_hunt_events_v416 e
     where e.trade_date >= v_start
       and e.trade_date >= v_today - 10
    union
    select distinct s.symbol_id
      from public.stock_hunter_shadow_samples_v416 s
      left join public.stock_hunter_shadow_sample_exclusions_v416 x on x.sample_id=s.sample_id
     where x.sample_id is null
       and s.trade_date >= v_start
       and s.trade_date >= v_today - 10
       and s.baseline_state in ('شکار ویژه','هشدار فوری','شکار زودهنگام')
  )
  insert into public.stock_hunter_hunt_market_tape_v416(
    observation_date,observed_at,source_updated_at,symbol_id,symbol,asset_type,market,
    last_price,closing_price,yesterday_price,low_price,high_price,min_allowed,max_allowed,
    best_bid,best_ask,buy_queue,sell_queue,volume
  )
  select
    (g.updated_at at time zone 'Asia/Tehran')::date,
    g.updated_at,g.updated_at,g.id,g.symbol,u.asset_type,u.market,
    g.last_price,g.closing_price,g.yesterday_price,g.low_price,g.high_price,g.min_allowed,g.max_allowed,
    g.best_bid,g.best_ask,g.buy_queue,g.sell_queue,g.volume
  from public.stock_hunter_signals_v4 g
  join tracked t on t.symbol_id=g.id
  left join public.stock_hunter_universe_v4 u on u.ins_code=g.id
  where g.updated_at >= pg_catalog.now() - interval '150 seconds'
    and (g.updated_at at time zone 'Asia/Tehran')::date=v_today
    and coalesce(g.last_price,0)>0
  on conflict(symbol_id,source_updated_at) do nothing;

  get diagnostics v_count = row_count;

  delete from public.stock_hunter_hunt_market_tape_v416
   where observation_date < v_today - v_retention;

  update public.stock_hunter_hunt_effectiveness_control_v416
     set last_tape_capture_at=pg_catalog.now(),
         last_tape_capture_count=v_count,
         last_error=null,
         updated_at=pg_catalog.now()
   where singleton=true;

  return v_count;
exception when others then
  update public.stock_hunter_hunt_effectiveness_control_v416
     set last_error=sqlerrm,updated_at=pg_catalog.now()
   where singleton=true;
  raise;
end;
$function$

revoke all on function private.capture_stock_hunter_hunt_market_tape_v416() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION private.refresh_stock_hunter_hunt_effectiveness_v416()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_start date;
  v_count integer := 0;
begin
  select prospective_start_date into v_start
  from public.stock_hunter_hunt_effectiveness_control_v416
  where singleton=true;

  with action_ranked as (
    select e.*,
           row_number() over(partition by e.trade_date,e.symbol_id order by e.first_seen_at,e.event_id) as rn
      from public.stock_hunter_hunt_events_v416 e
     where e.trade_date >= v_start
       and e.hunt_state in ('شکار ویژه','هشدار فوری')
       and e.hunt_mode in ('reversal','acceleration')
  ),
  radar_ranked as (
    select s.*,
           row_number() over(partition by s.trade_date,s.symbol_id order by s.observed_at,s.sample_id) as rn
      from public.stock_hunter_shadow_samples_v416 s
      left join public.stock_hunter_shadow_sample_exclusions_v416 x on x.sample_id=s.sample_id
     where x.sample_id is null
       and s.trade_date >= v_start
       and s.baseline_state='شکار زودهنگام'
       and s.hunt_mode in ('reversal','acceleration')
  ),
  alerts as (
    select 'ACTION_NOW'::text channel,a.trade_date,a.symbol_id,a.symbol,a.company_name,
           a.event_id alert_source_id,a.hunt_mode,a.hunt_state,
           a.first_seen_at alert_at,a.first_price alert_price,a.day_change alert_day_change,
           a.first_hunt_score hunt_score,a.first_today_opportunity today_opportunity,
           a.reference_yesterday_price,
           case when a.hunt_mode='reversal' then a.reference_yesterday_price
                else a.reference_yesterday_price*1.01 end target_price
      from action_ranked a where a.rn=1 and a.first_price>0
    union all
    select 'RADAR'::text channel,r.trade_date,r.symbol_id,r.symbol,r.company_name,
           r.sample_id alert_source_id,r.hunt_mode,r.baseline_state hunt_state,
           r.observed_at alert_at,r.price alert_price,r.day_change alert_day_change,
           r.baseline_hunt_score hunt_score,r.baseline_today_opportunity today_opportunity,
           r.reference_yesterday_price,
           case when r.hunt_mode='reversal' then r.reference_yesterday_price
                else r.reference_yesterday_price*1.01 end target_price
      from radar_ranked r where r.rn=1 and r.price>0
  ),
  source_obs as (
    select 'ACTION_NOW'::text channel,o.event_id alert_source_id,o.observation_date,
           o.observed_at,o.high_price,o.low_price,o.close_price,o.mfe_day_pct,o.mae_day_pct
      from public.stock_hunter_hunt_outcome_observations_v416 o
    union all
    select 'RADAR'::text channel,o.sample_id alert_source_id,o.observation_date,
           o.observed_at,o.high_price,o.low_price,o.close_price,o.mfe_day_pct,o.mae_day_pct
      from public.stock_hunter_shadow_outcome_observations_v416 o
  ),
  same_obs as (
    select a.channel,a.trade_date,a.symbol_id,a.alert_source_id,
           max(o.high_price) as high_price,
           min(o.low_price) as low_price,
           (array_agg(o.close_price order by o.observed_at desc)
              filter(where o.close_price is not null))[1] as close_price,
           max(o.mfe_day_pct) as mfe_pct,
           min(o.mae_day_pct) as mae_pct,
           max(o.observed_at) as observed_at
      from alerts a
      left join source_obs o
        on o.channel=a.channel
       and o.alert_source_id=a.alert_source_id
       and o.observation_date=a.trade_date
     group by a.channel,a.trade_date,a.symbol_id,a.alert_source_id
  ),
  tape_same as (
    select a.channel,a.trade_date,a.symbol_id,
           max(t.last_price) as max_last_price,
           min(t.last_price) as min_last_price,
           (array_agg(t.last_price order by t.observed_at desc)
              filter(where t.observation_id is not null))[1] as close_last_price,
           max((t.last_price/nullif(t.yesterday_price,0)-1)*100) as max_day_change,
           (array_agg((t.last_price/nullif(t.yesterday_price,0)-1)*100 order by t.observed_at desc)
              filter(where t.observation_id is not null))[1] as close_day_change,
           bool_or(coalesce(t.buy_queue,0)>0)
              filter(where t.observation_id is not null) as buy_queue_any,
           (array_agg(coalesce(t.buy_queue,0)>0 order by t.observed_at desc)
              filter(where t.observation_id is not null))[1] as buy_queue_close,
           100.0*count(t.observation_id) filter(where coalesce(t.buy_queue,0)>0)
              / nullif(count(t.observation_id),0) as buy_queue_snapshot_pct,
           min(t.observed_at) filter(where t.observation_id is not null and coalesce(t.buy_queue,0)>0) as first_buy_queue_at,
           max(t.observed_at) as last_observed_at
      from alerts a
      left join public.stock_hunter_hunt_market_tape_v416 t
        on t.symbol_id=a.symbol_id
       and t.observation_date=a.trade_date
       and t.observed_at>=a.alert_at
     group by a.channel,a.trade_date,a.symbol_id
  ),
  sessions as (
    select distinct observation_date
      from public.stock_hunter_hunt_market_tape_v416
  ),
  d1_dates as (
    select a.channel,a.trade_date,a.symbol_id,min(s.observation_date) as d1_session_date
      from alerts a
      left join sessions s on s.observation_date>a.trade_date
     group by a.channel,a.trade_date,a.symbol_id
  ),
  d1_tape as (
    select a.channel,a.trade_date,a.symbol_id,d.d1_session_date,
           max((t.last_price/nullif(t.yesterday_price,0)-1)*100) as max_day_change,
           min((t.last_price/nullif(t.yesterday_price,0)-1)*100) as min_day_change,
           (array_agg((t.last_price/nullif(t.yesterday_price,0)-1)*100 order by t.observed_at desc)
              filter(where t.observation_id is not null))[1] as close_day_change,
           (array_agg(t.last_price order by t.observed_at desc)
              filter(where t.observation_id is not null))[1] as close_price,
           max((t.last_price/a.alert_price-1)*100) as max_from_alert,
           min((t.last_price/a.alert_price-1)*100) as min_from_alert,
           (array_agg((t.last_price/a.alert_price-1)*100 order by t.observed_at desc)
              filter(where t.observation_id is not null))[1] as close_from_alert,
           bool_or(coalesce(t.buy_queue,0)>0)
              filter(where t.observation_id is not null) as buy_queue_any,
           (array_agg(coalesce(t.buy_queue,0)>0 order by t.observed_at desc)
              filter(where t.observation_id is not null))[1] as buy_queue_close,
           100.0*count(t.observation_id) filter(where coalesce(t.buy_queue,0)>0)
              / nullif(count(t.observation_id),0) as buy_queue_snapshot_pct,
           min(t.observed_at) filter(where t.observation_id is not null and coalesce(t.buy_queue,0)>0) as first_buy_queue_at,
           max(t.observed_at) as last_observed_at,
           count(t.observation_id) as tape_count
      from alerts a
      left join d1_dates d using(channel,trade_date,symbol_id)
      left join public.stock_hunter_hunt_market_tape_v416 t
        on t.symbol_id=a.symbol_id
       and t.observation_date=d.d1_session_date
     group by a.channel,a.trade_date,a.symbol_id,d.d1_session_date,a.alert_price
  ),
  prepared as (
    select a.*,u.asset_type,u.market,
           coalesce(so.high_price,ts.max_last_price) as same_high,
           coalesce(so.low_price,ts.min_last_price) as same_low,
           coalesce(so.close_price,ts.close_last_price) as same_close,
           coalesce(
             so.mfe_pct,
             case when ts.max_last_price is not null then (ts.max_last_price/a.alert_price-1)*100 end
           ) as same_mfe,
           coalesce(
             so.mae_pct,
             case when ts.min_last_price is not null then (ts.min_last_price/a.alert_price-1)*100 end
           ) as same_mae,
           coalesce(
             ts.max_day_change,
             case when so.high_price is not null and a.reference_yesterday_price>0
                  then (so.high_price/a.reference_yesterday_price-1)*100 end
           ) as same_max_change,
           coalesce(
             ts.close_day_change,
             case when so.close_price is not null and a.reference_yesterday_price>0
                  then (so.close_price/a.reference_yesterday_price-1)*100 end
           ) as same_close_change,
           ts.buy_queue_any same_buy_any,
           ts.buy_queue_close same_buy_close,
           ts.buy_queue_snapshot_pct same_buy_pct,
           ts.first_buy_queue_at same_first_buy_at,
           greatest(so.observed_at,ts.last_observed_at) same_last_observed_at,
           d.d1_session_date,
           d.max_day_change d1_max_change,
           d.close_day_change d1_close_change,
           d.close_from_alert d1_return_from_alert,
           d.max_from_alert d1_mfe,
           d.min_from_alert d1_mae,
           d.buy_queue_any d1_buy_any,
           d.buy_queue_close d1_buy_close,
           d.buy_queue_snapshot_pct d1_buy_pct,
           d.first_buy_queue_at d1_first_buy_at,
           d.last_observed_at d1_last_observed_at,
           d.tape_count d1_tape_count
      from alerts a
      left join public.stock_hunter_universe_v4 u on u.ins_code=a.symbol_id
      left join same_obs so using(channel,trade_date,symbol_id,alert_source_id)
      left join tape_same ts using(channel,trade_date,symbol_id)
      left join d1_tape d using(channel,trade_date,symbol_id)
  )
  insert into public.stock_hunter_hunt_effectiveness_v416(
    channel,trade_date,symbol_id,symbol,company_name,asset_type,market,
    alert_source_id,hunt_mode,hunt_state,alert_at,alert_price,alert_day_change,
    hunt_score,today_opportunity,reference_yesterday_price,target_price,
    same_day_observed,same_day_max_change_pct,same_day_close_change_pct,
    same_day_mfe_from_alert_pct,same_day_mae_from_alert_pct,
    same_day_crossed_zero,same_day_hit_plus1,same_day_hit_plus2,same_day_hit_plus3,
    same_day_mode_target_reached,same_day_mode_target_closed,
    same_day_buy_queue_any,same_day_buy_queue_close,same_day_buy_queue_snapshot_pct,same_day_first_buy_queue_at,
    d1_session_date,d1_observed,d1_max_change_pct,d1_close_change_pct,
    d1_return_from_alert_pct,d1_mfe_from_alert_pct,d1_mae_from_alert_pct,
    d1_positive_close,d1_hit_plus1,d1_hit_plus2,d1_hit_plus3,
    d1_buy_queue_any,d1_buy_queue_close,d1_buy_queue_snapshot_pct,d1_first_buy_queue_at,
    matured_same_day_at,matured_d1_at,updated_at
  )
  select
    p.channel,p.trade_date,p.symbol_id,p.symbol,p.company_name,p.asset_type,p.market,
    p.alert_source_id,p.hunt_mode,p.hunt_state,p.alert_at,p.alert_price,p.alert_day_change,
    p.hunt_score,p.today_opportunity,p.reference_yesterday_price,p.target_price,
    (p.same_high is not null or p.same_close is not null),
    p.same_max_change,p.same_close_change,p.same_mfe,p.same_mae,
    case when p.same_max_change is null then null else p.same_max_change>=0 end,
    case when p.same_max_change is null then null else p.same_max_change>=1 end,
    case when p.same_max_change is null then null else p.same_max_change>=2 end,
    case when p.same_max_change is null then null else p.same_max_change>=3 end,
    case when p.same_high is null or p.target_price is null then null else p.same_high>=p.target_price end,
    case when p.same_close is null or p.target_price is null then null else p.same_close>=p.target_price end,
    p.same_buy_any,p.same_buy_close,p.same_buy_pct,p.same_first_buy_at,
    p.d1_session_date,coalesce(p.d1_tape_count,0)>0,
    p.d1_max_change,p.d1_close_change,p.d1_return_from_alert,p.d1_mfe,p.d1_mae,
    case when p.d1_close_change is null then null else p.d1_close_change>0 end,
    case when p.d1_max_change is null then null else p.d1_max_change>=1 end,
    case when p.d1_max_change is null then null else p.d1_max_change>=2 end,
    case when p.d1_max_change is null then null else p.d1_max_change>=3 end,
    p.d1_buy_any,p.d1_buy_close,p.d1_buy_pct,p.d1_first_buy_at,
    case when (p.same_high is not null or p.same_close is not null) then p.same_last_observed_at end,
    case when coalesce(p.d1_tape_count,0)>0 then p.d1_last_observed_at end,
    pg_catalog.now()
  from prepared p
  on conflict(channel,trade_date,symbol_id) do update set
    symbol=excluded.symbol,
    company_name=excluded.company_name,
    asset_type=excluded.asset_type,
    market=excluded.market,
    alert_source_id=excluded.alert_source_id,
    hunt_mode=excluded.hunt_mode,
    hunt_state=excluded.hunt_state,
    alert_at=excluded.alert_at,
    alert_price=excluded.alert_price,
    alert_day_change=excluded.alert_day_change,
    hunt_score=excluded.hunt_score,
    today_opportunity=excluded.today_opportunity,
    reference_yesterday_price=excluded.reference_yesterday_price,
    target_price=excluded.target_price,
    same_day_observed=excluded.same_day_observed,
    same_day_max_change_pct=excluded.same_day_max_change_pct,
    same_day_close_change_pct=excluded.same_day_close_change_pct,
    same_day_mfe_from_alert_pct=excluded.same_day_mfe_from_alert_pct,
    same_day_mae_from_alert_pct=excluded.same_day_mae_from_alert_pct,
    same_day_crossed_zero=excluded.same_day_crossed_zero,
    same_day_hit_plus1=excluded.same_day_hit_plus1,
    same_day_hit_plus2=excluded.same_day_hit_plus2,
    same_day_hit_plus3=excluded.same_day_hit_plus3,
    same_day_mode_target_reached=excluded.same_day_mode_target_reached,
    same_day_mode_target_closed=excluded.same_day_mode_target_closed,
    same_day_buy_queue_any=excluded.same_day_buy_queue_any,
    same_day_buy_queue_close=excluded.same_day_buy_queue_close,
    same_day_buy_queue_snapshot_pct=excluded.same_day_buy_queue_snapshot_pct,
    same_day_first_buy_queue_at=excluded.same_day_first_buy_queue_at,
    d1_session_date=excluded.d1_session_date,
    d1_observed=excluded.d1_observed,
    d1_max_change_pct=excluded.d1_max_change_pct,
    d1_close_change_pct=excluded.d1_close_change_pct,
    d1_return_from_alert_pct=excluded.d1_return_from_alert_pct,
    d1_mfe_from_alert_pct=excluded.d1_mfe_from_alert_pct,
    d1_mae_from_alert_pct=excluded.d1_mae_from_alert_pct,
    d1_positive_close=excluded.d1_positive_close,
    d1_hit_plus1=excluded.d1_hit_plus1,
    d1_hit_plus2=excluded.d1_hit_plus2,
    d1_hit_plus3=excluded.d1_hit_plus3,
    d1_buy_queue_any=excluded.d1_buy_queue_any,
    d1_buy_queue_close=excluded.d1_buy_queue_close,
    d1_buy_queue_snapshot_pct=excluded.d1_buy_queue_snapshot_pct,
    d1_first_buy_queue_at=excluded.d1_first_buy_queue_at,
    matured_same_day_at=coalesce(public.stock_hunter_hunt_effectiveness_v416.matured_same_day_at,excluded.matured_same_day_at),
    matured_d1_at=coalesce(public.stock_hunter_hunt_effectiveness_v416.matured_d1_at,excluded.matured_d1_at),
    updated_at=pg_catalog.now();

  get diagnostics v_count = row_count;

  update public.stock_hunter_hunt_effectiveness_control_v416
     set last_refresh_at=pg_catalog.now(),
         last_refresh_count=v_count,
         last_error=null,
         updated_at=pg_catalog.now()
   where singleton=true;

  return v_count;
exception when others then
  update public.stock_hunter_hunt_effectiveness_control_v416
     set last_error=sqlerrm,updated_at=pg_catalog.now()
   where singleton=true;
  raise;
end;
$function$

revoke all on function private.refresh_stock_hunter_hunt_effectiveness_v416() from public, anon, authenticated;

create or replace view public.stock_hunter_hunt_effectiveness_summary_v416
with (security_invoker=true)
as
 SELECT channel,
    hunt_mode,
    hunt_state,
    asset_type,
    count(*) AS alerts_total,
    count(*) FILTER (WHERE same_day_observed) AS same_day_matured,
    round(100.0 * count(*) FILTER (WHERE same_day_crossed_zero IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE same_day_observed), 0)::numeric, 2) AS same_day_cross_zero_rate_pct,
    round(100.0 * count(*) FILTER (WHERE same_day_hit_plus1 IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE same_day_observed), 0)::numeric, 2) AS same_day_plus1_rate_pct,
    round(100.0 * count(*) FILTER (WHERE same_day_hit_plus2 IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE same_day_observed), 0)::numeric, 2) AS same_day_plus2_rate_pct,
    round(100.0 * count(*) FILTER (WHERE same_day_hit_plus3 IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE same_day_observed), 0)::numeric, 2) AS same_day_plus3_rate_pct,
    round(100.0 * count(*) FILTER (WHERE same_day_buy_queue_any IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE same_day_observed), 0)::numeric, 2) AS same_day_buy_queue_any_rate_pct,
    round(100.0 * count(*) FILTER (WHERE same_day_buy_queue_close IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE same_day_observed), 0)::numeric, 2) AS same_day_buy_queue_close_rate_pct,
    round(100.0 * count(*) FILTER (WHERE same_day_mode_target_reached IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE same_day_observed), 0)::numeric, 2) AS same_day_mode_target_rate_pct,
    count(*) FILTER (WHERE d1_observed) AS d1_matured,
    round(100.0 * count(*) FILTER (WHERE d1_positive_close IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE d1_observed), 0)::numeric, 2) AS d1_positive_close_rate_pct,
    round(100.0 * count(*) FILTER (WHERE d1_hit_plus1 IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE d1_observed), 0)::numeric, 2) AS d1_plus1_rate_pct,
    round(100.0 * count(*) FILTER (WHERE d1_hit_plus2 IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE d1_observed), 0)::numeric, 2) AS d1_plus2_rate_pct,
    round(100.0 * count(*) FILTER (WHERE d1_hit_plus3 IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE d1_observed), 0)::numeric, 2) AS d1_plus3_rate_pct,
    round(100.0 * count(*) FILTER (WHERE d1_buy_queue_any IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE d1_observed), 0)::numeric, 2) AS d1_buy_queue_any_rate_pct,
    round(100.0 * count(*) FILTER (WHERE d1_buy_queue_close IS TRUE)::numeric / NULLIF(count(*) FILTER (WHERE d1_observed), 0)::numeric, 2) AS d1_buy_queue_close_rate_pct,
    round(avg(same_day_mfe_from_alert_pct) FILTER (WHERE same_day_observed), 3) AS avg_same_day_mfe_pct,
    round(avg(same_day_mae_from_alert_pct) FILTER (WHERE same_day_observed), 3) AS avg_same_day_mae_pct,
    round(avg(d1_return_from_alert_pct) FILTER (WHERE d1_observed), 3) AS avg_d1_return_from_alert_pct
   FROM stock_hunter_hunt_effectiveness_v416
  GROUP BY channel, hunt_mode, hunt_state, asset_type;;
revoke all on table public.stock_hunter_hunt_effectiveness_summary_v416 from anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'stock-hunter-hunt-tape-v416-open',
  'stock-hunter-hunt-tape-v416-mid',
  'stock-hunter-hunt-tape-v416-close',
  'stock-hunter-hunt-effectiveness-v416-close-a',
  'stock-hunter-hunt-effectiveness-v416-close-b'
);
select cron.schedule('stock-hunter-hunt-tape-v416-open','30-59 5 * * 0-3,6','select private.capture_stock_hunter_hunt_market_tape_v416();');
select cron.schedule('stock-hunter-hunt-tape-v416-mid','* 6-8 * * 0-3,6','select private.capture_stock_hunter_hunt_market_tape_v416();');
select cron.schedule('stock-hunter-hunt-tape-v416-close','0-30 9 * * 0-3,6','select private.capture_stock_hunter_hunt_market_tape_v416();');
select cron.schedule('stock-hunter-hunt-effectiveness-v416-close-a','35 9 * * 0-3,6','select private.refresh_stock_hunter_hunt_effectiveness_v416();');
select cron.schedule('stock-hunter-hunt-effectiveness-v416-close-b','25 14 * * 0-3,6','select private.refresh_stock_hunter_hunt_effectiveness_v416();');

commit;
