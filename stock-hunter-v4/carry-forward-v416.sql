-- Stock Hunter 4.1.6 Sticky/Carry-forward persistence + backtest contract.
-- Does not alter Frozen Hunt scoring. It persists early hunts and measures the
-- 15-minute window after the first verified +1% crossing.

alter table public.stock_hunter_hunt_events_v416
  drop constraint if exists stock_hunter_hunt_events_v416_hunt_state_check;
alter table public.stock_hunter_hunt_events_v416
  add constraint stock_hunter_hunt_events_v416_hunt_state_check
  check (hunt_state = any (array['شکار ویژه'::text,'هشدار فوری'::text,'شکار زودهنگام'::text]));

create table if not exists public.stock_hunter_hunt_carry_v416(
  source_event_id bigint primary key references public.stock_hunter_hunt_events_v416(event_id) on delete cascade,
  trade_date date not null,
  symbol_id text not null,
  symbol text not null,
  company_name text,
  hunt_mode text not null check (hunt_mode in ('reversal','acceleration')),
  source_hunt_state text not null default 'شکار زودهنگام' check (source_hunt_state='شکار زودهنگام'),
  detected_at timestamptz not null,
  detected_price numeric not null check (detected_price>0),
  detected_day_change numeric,
  detected_hunt_score numeric,
  detected_today_opportunity numeric,
  evidence_count integer,
  dynamic_evidence_count integer,
  reference_yesterday_price numeric,
  crossed_plus1_at timestamptz,
  crossed_plus1_price numeric,
  carry_until timestamptz,
  status text not null default 'WAITING_CROSS'
    check (status in ('WAITING_CROSS','ACTIVE','COMPLETED','EXPIRED_NO_CROSS')),
  last_observed_at timestamptz,
  last_price_15m numeric,
  peak_price_15m numeric,
  trough_price_15m numeric,
  peak_day_change_15m numeric,
  end_day_change_15m numeric,
  mfe_from_detect_15m numeric,
  mae_from_detect_15m numeric,
  mfe_from_cross_15m numeric,
  mae_from_cross_15m numeric,
  hit_plus2_15m boolean,
  hit_plus3_15m boolean,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trade_date,symbol_id)
);
create index if not exists stock_hunter_hunt_carry_v416_live_idx
  on public.stock_hunter_hunt_carry_v416(trade_date,status,carry_until desc);

alter table public.stock_hunter_hunt_carry_v416 enable row level security;
drop policy if exists "stock hunter carry public read" on public.stock_hunter_hunt_carry_v416;
create policy "stock hunter carry public read"
  on public.stock_hunter_hunt_carry_v416 for select to anon,authenticated using (true);
revoke all on table public.stock_hunter_hunt_carry_v416 from anon,authenticated;
grant select on table public.stock_hunter_hunt_carry_v416 to anon,authenticated;
grant select,insert,update,delete on table public.stock_hunter_hunt_carry_v416 to service_role;

create or replace function private.refresh_stock_hunter_hunt_carry_v416()
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_now_tehran timestamp := pg_catalog.clock_timestamp() at time zone 'Asia/Tehran';
  v_today date := (pg_catalog.clock_timestamp() at time zone 'Asia/Tehran')::date;
  v_count integer := 0;
begin
  insert into public.stock_hunter_hunt_carry_v416(
    source_event_id,trade_date,symbol_id,symbol,company_name,hunt_mode,source_hunt_state,
    detected_at,detected_price,detected_day_change,detected_hunt_score,detected_today_opportunity,
    evidence_count,dynamic_evidence_count,reference_yesterday_price
  )
  select e.event_id,e.trade_date,e.symbol_id,e.symbol,e.company_name,e.hunt_mode,e.hunt_state,
         e.first_seen_at,e.first_price,e.day_change,e.first_hunt_score,e.first_today_opportunity,
         e.evidence_count,e.dynamic_evidence_count,e.reference_yesterday_price
    from public.stock_hunter_hunt_events_v416 e
   where e.hunt_state='شکار زودهنگام'
     and e.first_price>0
     and e.trade_date >= (
       select prospective_start_date from public.stock_hunter_hunt_effectiveness_control_v416 where singleton=true
     )
  on conflict(source_event_id) do update set
    symbol=excluded.symbol,company_name=excluded.company_name,
    detected_hunt_score=excluded.detected_hunt_score,
    detected_today_opportunity=excluded.detected_today_opportunity,
    evidence_count=excluded.evidence_count,dynamic_evidence_count=excluded.dynamic_evidence_count,
    reference_yesterday_price=coalesce(public.stock_hunter_hunt_carry_v416.reference_yesterday_price,excluded.reference_yesterday_price),
    updated_at=pg_catalog.now();

  with base as (
    select c.*,fc.observed_at cross_at,fc.last_price cross_price
      from public.stock_hunter_hunt_carry_v416 c
      left join lateral (
        select t.observed_at,t.last_price
          from public.stock_hunter_hunt_market_tape_v416 t
         where t.symbol_id=c.symbol_id
           and t.observation_date=c.trade_date
           and t.observed_at>=c.detected_at
           and c.reference_yesterday_price>0
           and ((t.last_price/c.reference_yesterday_price)-1)*100>=1
         order by t.observed_at asc limit 1
      ) fc on true
     where c.trade_date>=v_today-10
  ),
  metrics as (
    select b.source_event_id,b.cross_at,b.cross_price,
           case when b.cross_at is not null then b.cross_at+interval '15 minutes' end carry_end,
           max(t.last_price) filter(where t.observation_id is not null) peak_price,
           min(t.last_price) filter(where t.observation_id is not null) trough_price,
           (array_agg(t.last_price order by t.observed_at desc) filter(where t.observation_id is not null))[1] last_price,
           max(((t.last_price/nullif(b.reference_yesterday_price,0))-1)*100) filter(where t.observation_id is not null) peak_day_change,
           (array_agg(((t.last_price/nullif(b.reference_yesterday_price,0))-1)*100 order by t.observed_at desc) filter(where t.observation_id is not null))[1] end_day_change,
           max(((t.last_price/nullif(b.detected_price,0))-1)*100) filter(where t.observation_id is not null) mfe_detect,
           min(((t.last_price/nullif(b.detected_price,0))-1)*100) filter(where t.observation_id is not null) mae_detect,
           max(((t.last_price/nullif(b.cross_price,0))-1)*100) filter(where t.observation_id is not null) mfe_cross,
           min(((t.last_price/nullif(b.cross_price,0))-1)*100) filter(where t.observation_id is not null) mae_cross,
           bool_or((((t.last_price/nullif(b.reference_yesterday_price,0))-1)*100)>=2) filter(where t.observation_id is not null) hit_plus2,
           bool_or((((t.last_price/nullif(b.reference_yesterday_price,0))-1)*100)>=3) filter(where t.observation_id is not null) hit_plus3,
           max(t.observed_at) filter(where t.observation_id is not null) last_observed_at
      from base b
      left join public.stock_hunter_hunt_market_tape_v416 t
        on t.symbol_id=b.symbol_id and t.observation_date=b.trade_date
       and b.cross_at is not null and t.observed_at>=b.cross_at
       and t.observed_at<=least(b.cross_at+interval '15 minutes',v_now)
     group by b.source_event_id,b.cross_at,b.cross_price,b.reference_yesterday_price,b.detected_price
  )
  update public.stock_hunter_hunt_carry_v416 c
     set crossed_plus1_at=m.cross_at,crossed_plus1_price=m.cross_price,carry_until=m.carry_end,
         status=case
           when m.cross_at is not null and v_now<m.carry_end then 'ACTIVE'
           when m.cross_at is not null and v_now>=m.carry_end then 'COMPLETED'
           when c.trade_date<v_today or (c.trade_date=v_today and v_now_tehran::time>time '13:05') then 'EXPIRED_NO_CROSS'
           else 'WAITING_CROSS' end,
         last_observed_at=m.last_observed_at,last_price_15m=m.last_price,
         peak_price_15m=m.peak_price,trough_price_15m=m.trough_price,
         peak_day_change_15m=m.peak_day_change,end_day_change_15m=m.end_day_change,
         mfe_from_detect_15m=m.mfe_detect,mae_from_detect_15m=m.mae_detect,
         mfe_from_cross_15m=m.mfe_cross,mae_from_cross_15m=m.mae_cross,
         hit_plus2_15m=m.hit_plus2,hit_plus3_15m=m.hit_plus3,
         completed_at=case when m.cross_at is not null and v_now>=m.carry_end then coalesce(c.completed_at,m.carry_end) else c.completed_at end,
         updated_at=pg_catalog.now()
    from metrics m
   where c.source_event_id=m.source_event_id;
  get diagnostics v_count=row_count;
  return v_count;
end;
$function$;
revoke all on function private.refresh_stock_hunter_hunt_carry_v416() from public,anon,authenticated;

-- Backfill formal early-hunt events from the already-collected shadow ledger.
with ranked as (
  select s.*,row_number() over(partition by s.trade_date,s.symbol_id order by s.observed_at,s.sample_id) rn
    from public.stock_hunter_shadow_samples_v416 s
    left join public.stock_hunter_shadow_sample_exclusions_v416 x on x.sample_id=s.sample_id
   where x.sample_id is null and s.baseline_state='شکار زودهنگام'
     and s.trade_date >= (select prospective_start_date from public.stock_hunter_hunt_effectiveness_control_v416 where singleton=true)
)
insert into public.stock_hunter_hunt_events_v416(
  trade_date,symbol_id,symbol,company_name,hunt_state,hunt_mode,first_seen_at,last_seen_at,
  max_hunt_score,max_today_opportunity,day_change,evidence_count,dynamic_evidence_count,source_version,
  first_price,last_price,max_score_price,first_hunt_score,first_today_opportunity,first_order_pressure,
  first_impulse,first_feasibility,first_flow_volume,first_market_context,first_continuation12,
  first_risk_score,first_cancellation_ratio,feature_vector_complete,reference_yesterday_price
)
select r.trade_date,r.symbol_id,r.symbol,r.company_name,'شکار زودهنگام',r.hunt_mode,r.observed_at,r.observed_at,
       r.baseline_hunt_score,r.baseline_today_opportunity,r.day_change,r.evidence_count,r.dynamic_evidence_count,
       '4.1.6-backfill-shadow-early-v1',r.price,r.price,r.price,r.baseline_hunt_score,r.baseline_today_opportunity,
       r.order_pressure,r.impulse,r.feasibility,r.flow_volume,r.market_context,r.continuation12,r.risk_score,
       r.cancellation_ratio,true,r.reference_yesterday_price
  from ranked r where r.rn=1
on conflict(trade_date,symbol_id,hunt_state) do nothing;

do $do$
begin
  if not exists(select 1 from cron.job where jobname='stock-hunter-hunt-carry-v416') then
    perform cron.schedule('stock-hunter-hunt-carry-v416','* 5-9 * * 0-3,6','select private.refresh_stock_hunter_hunt_carry_v416();');
  end if;
end
$do$;

select private.refresh_stock_hunter_hunt_carry_v416();
