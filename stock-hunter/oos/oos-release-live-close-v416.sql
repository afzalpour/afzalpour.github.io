-- Stock Hunter 4.1.6 one-time OOS release live-close migration.
-- Adapted against the live 40-column Calibration contract on 2026-09-18.
-- No release/unlock is performed by this migration.

-- Stock Hunter 4.1.6 one-time OOS release hardening.
-- Freeze the exact candidate-search dataset at release so dates that were once OOS
-- can never drift back into Train/Validation as prospective data continues to arrive.

create table if not exists public.stock_hunter_oos_release_dataset_v416
as select * from public.stock_hunter_calibration_dataset_v416 with no data;

alter table public.stock_hunter_oos_release_dataset_v416
  add column if not exists release_id bigint,
  add column if not exists frozen_at timestamptz not null default now();

alter table public.stock_hunter_oos_release_dataset_v416
  alter column release_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.stock_hunter_oos_release_dataset_v416'::regclass
      and conname='stock_hunter_oos_release_dataset_v416_pkey'
  ) then
    alter table public.stock_hunter_oos_release_dataset_v416
      add constraint stock_hunter_oos_release_dataset_v416_pkey primary key(release_id,sample_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.stock_hunter_oos_release_dataset_v416'::regclass
      and conname='stock_hunter_oos_release_dataset_release_fk_v416'
  ) then
    alter table public.stock_hunter_oos_release_dataset_v416
      add constraint stock_hunter_oos_release_dataset_release_fk_v416
      foreign key(release_id) references public.stock_hunter_oos_release_manifest_v416(release_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.stock_hunter_oos_release_dataset_v416'::regclass
      and conname='stock_hunter_oos_release_dataset_split_ck_v416'
  ) then
    alter table public.stock_hunter_oos_release_dataset_v416
      add constraint stock_hunter_oos_release_dataset_split_ck_v416
      check(split in ('train','validation','oos'));
  end if;
end $$;

create index if not exists stock_hunter_oos_release_dataset_lookup_v416
  on public.stock_hunter_oos_release_dataset_v416(release_id,split,hunt_mode,trade_date,sample_id);

alter table public.stock_hunter_oos_release_dataset_v416 enable row level security;
revoke all on public.stock_hunter_oos_release_dataset_v416 from anon, authenticated;
grant select on public.stock_hunter_oos_release_dataset_v416 to anon, authenticated, service_role;
drop policy if exists stock_hunter_oos_release_dataset_read_v416 on public.stock_hunter_oos_release_dataset_v416;
create policy stock_hunter_oos_release_dataset_read_v416
  on public.stock_hunter_oos_release_dataset_v416
  for select to anon, authenticated using(true);

alter table public.stock_hunter_oos_release_manifest_v416
  add column if not exists dataset_fingerprint_protocol text not null default 'md5-jsonb-v2',
  add column if not exists dataset_snapshot_rows integer,
  add column if not exists baseline_snapshot jsonb not null default '[]'::jsonb;

create or replace function private.guard_stock_hunter_oos_dataset_insert_v416()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if coalesce(current_setting('stock_hunter.oos_release_context',true),'') <> 'release_v1' then
    raise exception 'OOS frozen dataset can only be populated by the controlled release protocol';
  end if;
  return new;
end $$;
revoke all on function private.guard_stock_hunter_oos_dataset_insert_v416() from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_oos_dataset_insert_v416() to postgres;

drop trigger if exists stock_hunter_oos_dataset_insert_guard_v416 on public.stock_hunter_oos_release_dataset_v416;
create trigger stock_hunter_oos_dataset_insert_guard_v416
before insert on public.stock_hunter_oos_release_dataset_v416
for each row execute function private.guard_stock_hunter_oos_dataset_insert_v416();

drop trigger if exists stock_hunter_oos_dataset_immutable_v416 on public.stock_hunter_oos_release_dataset_v416;
create trigger stock_hunter_oos_dataset_immutable_v416
before update or delete or truncate on public.stock_hunter_oos_release_dataset_v416
for each statement execute function private.reject_stock_hunter_oos_release_mutation_v416();

-- Once OOS is released, candidate definitions for this version are frozen too.
create or replace function private.guard_stock_hunter_candidate_search_mutation_after_oos_v416()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if exists (
    select 1 from public.stock_hunter_candidate_eval_control_v416 c
    where c.singleton=true and c.oos_unlocked=true
  ) then
    raise exception 'candidate search is frozen after one-time OOS release for v4.1.6';
  end if;
  return null;
end $$;
revoke all on function private.guard_stock_hunter_candidate_search_mutation_after_oos_v416() from public,anon,authenticated,service_role;
grant execute on function private.guard_stock_hunter_candidate_search_mutation_after_oos_v416() to postgres;

drop trigger if exists stock_hunter_candidate_weights_freeze_after_oos_v416 on public.stock_hunter_candidate_weights_v416;
create trigger stock_hunter_candidate_weights_freeze_after_oos_v416
before insert or update or delete or truncate on public.stock_hunter_candidate_weights_v416
for each statement execute function private.guard_stock_hunter_candidate_search_mutation_after_oos_v416();

drop trigger if exists stock_hunter_candidate_library_freeze_after_oos_v416 on public.stock_hunter_candidate_library_v416;
create trigger stock_hunter_candidate_library_freeze_after_oos_v416
before insert or update or delete or truncate on public.stock_hunter_candidate_library_v416
for each statement execute function private.guard_stock_hunter_candidate_search_mutation_after_oos_v416();

-- Preserve the exact output contract of calibration_dataset. Before release it is the
-- live prospective dataset; after release it becomes the immutable frozen snapshot.
-- The switch is intentionally based only on whether the frozen snapshot table has rows.
-- That avoids a circular dependency through readiness/robustness views and makes the
-- switch atomic with the release transaction: rollback empties the snapshot again.
create or replace view public.stock_hunter_calibration_dataset_v416
with (security_invoker=true)
as
with p as (
  select prospective_start_at,max_capture_lag_seconds
  from public.stock_hunter_calibration_policy_v416
  where policy_id='default'
), mature as (
  select
    o.sample_id,o.trade_date,o.symbol_id,o.symbol,o.company_name,o.hunt_mode,o.observed_at,o.bucket_minute,
    o.price,o.day_change,o.order_pressure,o.impulse,o.feasibility,o.flow_volume,o.market_context,o.continuation12,
    o.risk_score,o.cancellation_ratio,o.evidence_count,o.dynamic_evidence_count,o.baseline_today_opportunity,
    o.baseline_hunt_score,o.baseline_state,o.gate_reason,o.source_version,o.return_1d_pct,o.return_2d_pct,
    o.return_3d_pct,o.mfe_1d_pct,o.mae_1d_pct,o.mfe_3d_pct,o.mae_3d_pct,o.future_sessions_observed,
    o.positive_1d,o.hit_plus_1pct_1d,o.hit_minus_1pct_3d
  from public.stock_hunter_shadow_outcomes_v416 o
  join public.stock_hunter_shadow_samples_v416 s on s.sample_id=o.sample_id
  cross join p
  where o.future_sessions_observed>=3
    and o.gate_reason=''
    and s.observed_at>=p.prospective_start_at
    and s.trade_date=(s.observed_at at time zone 'Asia/Tehran')::date
    and s.created_at>=s.observed_at-interval '2 minutes'
    and s.created_at<=s.observed_at+(p.max_capture_lag_seconds * interval '1 second')
), dates as (
  select trade_date,
         dense_rank() over(order by trade_date) as date_rank,
         count(*) over() as date_count
  from (select distinct trade_date from mature) d
), live_base as (
  select m.*,
         d.date_rank,d.date_count,
         case
           when d.date_count=0 then 'insufficient'
           when d.date_rank<=ceil(d.date_count*0.60) then 'train'
           when d.date_rank<=ceil(d.date_count*0.80) then 'validation'
           else 'oos'
         end as split,
         1.0 / count(*) over(partition by m.trade_date,m.symbol_id)::numeric as cluster_weight
  from mature m
  join dates d using(trade_date)
), freeze_state as (
  select exists(select 1 from public.stock_hunter_oos_release_dataset_v416) as frozen
), rows_union as (
  select
    b.sample_id,b.trade_date,b.symbol_id,b.symbol,b.company_name,b.hunt_mode,b.observed_at,b.bucket_minute,
    b.price,b.day_change,b.order_pressure,b.impulse,b.feasibility,b.flow_volume,b.market_context,b.continuation12,
    b.risk_score,b.cancellation_ratio,b.evidence_count,b.dynamic_evidence_count,b.baseline_today_opportunity,
    b.baseline_hunt_score,b.baseline_state,b.gate_reason,b.source_version,b.return_1d_pct,b.return_2d_pct,
    b.return_3d_pct,b.mfe_1d_pct,b.mae_1d_pct,b.mfe_3d_pct,b.mae_3d_pct,b.future_sessions_observed,
    b.positive_1d,b.hit_plus_1pct_1d,b.hit_minus_1pct_3d,b.date_rank,b.date_count,b.split,b.cluster_weight
  from live_base b
  cross join freeze_state s
  where not s.frozen

  union all

  select
    f.sample_id,f.trade_date,f.symbol_id,f.symbol,f.company_name,f.hunt_mode,f.observed_at,f.bucket_minute,
    f.price,f.day_change,f.order_pressure,f.impulse,f.feasibility,f.flow_volume,f.market_context,f.continuation12,
    f.risk_score,f.cancellation_ratio,f.evidence_count,f.dynamic_evidence_count,f.baseline_today_opportunity,
    f.baseline_hunt_score,f.baseline_state,f.gate_reason,f.source_version,f.return_1d_pct,f.return_2d_pct,
    f.return_3d_pct,f.mfe_1d_pct,f.mae_1d_pct,f.mfe_3d_pct,f.mae_3d_pct,f.future_sessions_observed,
    f.positive_1d,f.hit_plus_1pct_1d,f.hit_minus_1pct_3d,f.date_rank,f.date_count,f.split,f.cluster_weight
  from public.stock_hunter_oos_release_dataset_v416 f
  cross join freeze_state s
  where s.frozen
)
select * from rows_union;

grant select on public.stock_hunter_calibration_dataset_v416 to anon,authenticated,service_role;

create or replace function private.release_stock_hunter_oos_v416(
  p_note text,
  p_protocol_version text default '4.1.6-oos-release-v1'
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_can boolean;
  v_release_id bigint;
  v_engine_version text := '4.1.6-hunt-v2';
  v_candidate_snapshot jsonb;
  v_baseline_snapshot jsonb;
  v_robustness_snapshot jsonb;
  v_control_snapshot jsonb;
  v_first date;
  v_last date;
  v_train_last date;
  v_val_first date;
  v_val_last date;
  v_oos_first date;
  v_oos_last date;
  v_total integer;
  v_train integer;
  v_val integer;
  v_oos integer;
  v_dates integer;
  v_oos_dates integer;
  v_fingerprint text;
  v_frozen_fingerprint text;
  v_snapshot_rows integer;
begin
  if nullif(trim(p_note),'') is null then
    raise exception 'release note is required';
  end if;
  if p_protocol_version <> '4.1.6-oos-release-v1' then
    raise exception 'unexpected OOS release protocol version';
  end if;

  perform 1
  from public.stock_hunter_candidate_eval_control_v416
  where singleton=true
  for update;

  if exists(select 1 from public.stock_hunter_oos_release_manifest_v416) then
    raise exception 'OOS release already exists for v4.1.6';
  end if;

  select can_unlock_oos into v_can
  from public.stock_hunter_oos_unlock_readiness_v416
  limit 1;
  if not coalesce(v_can,false) then
    raise exception 'OOS robustness gate is not ready';
  end if;

  select
    min(d.trade_date),max(d.trade_date),
    max(d.trade_date) filter(where d.split='train'),
    min(d.trade_date) filter(where d.split='validation'),
    max(d.trade_date) filter(where d.split='validation'),
    min(d.trade_date) filter(where d.split='oos'),
    max(d.trade_date) filter(where d.split='oos'),
    count(*)::integer,
    count(*) filter(where d.split='train')::integer,
    count(*) filter(where d.split='validation')::integer,
    count(*) filter(where d.split='oos')::integer,
    count(distinct d.trade_date)::integer,
    count(distinct d.trade_date) filter(where d.split='oos')::integer,
    md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.sample_id::text),''))
  into v_first,v_last,v_train_last,v_val_first,v_val_last,v_oos_first,v_oos_last,
       v_total,v_train,v_val,v_oos,v_dates,v_oos_dates,v_fingerprint
  from public.stock_hunter_calibration_dataset_v416 d
  where d.future_sessions_observed>=3
    and d.return_1d_pct is not null
    and d.return_3d_pct is not null;

  if coalesce(v_total,0)=0 or coalesce(v_oos,0)=0 then
    raise exception 'OOS release dataset is empty or has no OOS partition';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.hunt_mode),'[]'::jsonb)
    into v_candidate_snapshot
  from public.stock_hunter_candidate_selected_v416 s;

  select coalesce(jsonb_agg(to_jsonb(l) order by l.hunt_mode),'[]'::jsonb)
    into v_baseline_snapshot
  from public.stock_hunter_candidate_library_v416 l
  where l.is_baseline=true;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.hunt_mode),'[]'::jsonb)
    into v_robustness_snapshot
  from public.stock_hunter_candidate_robustness_v416 r;

  select to_jsonb(c) into v_control_snapshot
  from public.stock_hunter_candidate_eval_control_v416 c
  where c.singleton=true;

  if jsonb_array_length(v_candidate_snapshot) <> 2 then
    raise exception 'both hunt modes must have selected non-baseline candidates';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(v_candidate_snapshot) x
    where coalesce((x->>'is_baseline')::boolean,false)
  ) then
    raise exception 'baseline cannot be frozen as selected challenger';
  end if;
  if jsonb_array_length(v_baseline_snapshot) <> 2 then
    raise exception 'both hunt modes must have frozen baselines';
  end if;
  if jsonb_array_length(v_robustness_snapshot) <> 2 then
    raise exception 'both hunt modes must have robustness records';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(v_robustness_snapshot) x
    where not coalesce((x->>'robustness_ready')::boolean,false)
  ) then
    raise exception 'all frozen hunt modes must pass robustness';
  end if;

  perform set_config('stock_hunter.oos_release_context','release_v1',true);

  insert into public.stock_hunter_oos_release_manifest_v416(
    protocol_version,engine_version,release_note,
    dataset_first_trade_date,dataset_last_trade_date,train_last_trade_date,
    validation_first_trade_date,validation_last_trade_date,oos_first_trade_date,oos_last_trade_date,
    total_samples,train_samples,validation_samples,oos_samples,trade_dates,oos_trade_dates,
    dataset_fingerprint,dataset_fingerprint_protocol,dataset_snapshot_rows,
    candidate_snapshot,baseline_snapshot,robustness_snapshot,control_snapshot
  ) values (
    p_protocol_version,v_engine_version,trim(p_note),
    v_first,v_last,v_train_last,v_val_first,v_val_last,v_oos_first,v_oos_last,
    v_total,v_train,v_val,v_oos,v_dates,v_oos_dates,
    v_fingerprint,'md5-jsonb-v2',v_total,
    v_candidate_snapshot,v_baseline_snapshot,v_robustness_snapshot,coalesce(v_control_snapshot,'{}'::jsonb)
  ) returning release_id into v_release_id;

  insert into public.stock_hunter_oos_release_dataset_v416(
    sample_id,trade_date,symbol_id,symbol,company_name,hunt_mode,observed_at,bucket_minute,
    price,day_change,order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,
    risk_score,cancellation_ratio,evidence_count,dynamic_evidence_count,baseline_today_opportunity,
    baseline_hunt_score,baseline_state,gate_reason,source_version,return_1d_pct,return_2d_pct,
    return_3d_pct,mfe_1d_pct,mae_1d_pct,mfe_3d_pct,mae_3d_pct,future_sessions_observed,
    positive_1d,hit_plus_1pct_1d,hit_minus_1pct_3d,date_rank,date_count,split,cluster_weight,
    release_id,frozen_at
  )
  select
    d.sample_id,d.trade_date,d.symbol_id,d.symbol,d.company_name,d.hunt_mode,d.observed_at,d.bucket_minute,
    d.price,d.day_change,d.order_pressure,d.impulse,d.feasibility,d.flow_volume,d.market_context,d.continuation12,
    d.risk_score,d.cancellation_ratio,d.evidence_count,d.dynamic_evidence_count,d.baseline_today_opportunity,
    d.baseline_hunt_score,d.baseline_state,d.gate_reason,d.source_version,d.return_1d_pct,d.return_2d_pct,
    d.return_3d_pct,d.mfe_1d_pct,d.mae_1d_pct,d.mfe_3d_pct,d.mae_3d_pct,d.future_sessions_observed,
    d.positive_1d,d.hit_plus_1pct_1d,d.hit_minus_1pct_3d,d.date_rank,d.date_count,d.split,d.cluster_weight,
    v_release_id,now()
  from public.stock_hunter_calibration_dataset_v416 d
  where d.future_sessions_observed>=3
    and d.return_1d_pct is not null
    and d.return_3d_pct is not null;

  get diagnostics v_snapshot_rows = row_count;
  if v_snapshot_rows <> v_total then
    raise exception 'frozen OOS dataset row count mismatch: expected %, got %',v_total,v_snapshot_rows;
  end if;

  select md5(coalesce(string_agg((to_jsonb(f)-'release_id'-'frozen_at')::text,'|' order by f.sample_id::text),''))
    into v_frozen_fingerprint
  from public.stock_hunter_oos_release_dataset_v416 f
  where f.release_id=v_release_id;

  if v_frozen_fingerprint is distinct from v_fingerprint then
    raise exception 'frozen OOS dataset fingerprint mismatch';
  end if;

  insert into public.stock_hunter_oos_release_results_v416(
    release_id,hunt_mode,result_role,candidate_id,is_baseline,family,
    order_pressure_w,impulse_w,feasibility_w,flow_volume_w,market_context_w,
    selected_count,selected_trade_dates,selected_weight,utility,
    avg_return_3d_pct,avg_mfe_3d_pct,avg_mae_3d_pct,positive_rate_3d_pct,
    validation_rank,robustness_ready,released_at
  )
  select
    v_release_id,e.hunt_mode,'candidate',e.candidate_id,e.is_baseline,e.family,
    l.order_pressure_w,l.impulse_w,l.feasibility_w,l.flow_volume_w,l.market_context_w,
    e.selected_count,e.selected_trade_dates,e.selected_weight,e.utility,
    e.avg_return_3d_pct,e.avg_mfe_3d_pct,e.avg_mae_3d_pct,e.positive_rate_3d_pct,
    s.validation_rank,r.robustness_ready,now()
  from public.stock_hunter_candidate_selected_v416 s
  join public.stock_hunter_candidate_eval_v416 e
    on e.hunt_mode=s.hunt_mode and e.candidate_id=s.candidate_id and e.split='oos'
  join public.stock_hunter_candidate_library_v416 l
    on l.hunt_mode=e.hunt_mode and l.candidate_id=e.candidate_id
  join public.stock_hunter_candidate_robustness_v416 r
    on r.hunt_mode=s.hunt_mode and r.candidate_id=s.candidate_id;

  insert into public.stock_hunter_oos_release_results_v416(
    release_id,hunt_mode,result_role,candidate_id,is_baseline,family,
    order_pressure_w,impulse_w,feasibility_w,flow_volume_w,market_context_w,
    selected_count,selected_trade_dates,selected_weight,utility,
    avg_return_3d_pct,avg_mfe_3d_pct,avg_mae_3d_pct,positive_rate_3d_pct,
    validation_rank,robustness_ready,released_at
  )
  select
    v_release_id,e.hunt_mode,'baseline',e.candidate_id,true,e.family,
    l.order_pressure_w,l.impulse_w,l.feasibility_w,l.flow_volume_w,l.market_context_w,
    e.selected_count,e.selected_trade_dates,e.selected_weight,e.utility,
    e.avg_return_3d_pct,e.avg_mfe_3d_pct,e.avg_mae_3d_pct,e.positive_rate_3d_pct,
    null,null,now()
  from public.stock_hunter_candidate_selected_v416 s
  join public.stock_hunter_candidate_library_v416 l
    on l.hunt_mode=s.hunt_mode and l.is_baseline=true
  join public.stock_hunter_candidate_eval_v416 e
    on e.hunt_mode=l.hunt_mode and e.candidate_id=l.candidate_id and e.split='oos';

  if (select count(*) from public.stock_hunter_oos_release_results_v416 where release_id=v_release_id) <> 4 then
    raise exception 'OOS snapshot must contain candidate and baseline for both modes';
  end if;
  if (select count(distinct hunt_mode) from public.stock_hunter_oos_release_results_v416 where release_id=v_release_id) <> 2 then
    raise exception 'OOS snapshot must contain exactly two hunt modes';
  end if;
  if (select count(*) from public.stock_hunter_oos_release_results_v416 where release_id=v_release_id and result_role='candidate' and is_baseline) <> 0 then
    raise exception 'candidate OOS result cannot be baseline';
  end if;

  update public.stock_hunter_candidate_eval_control_v416
     set oos_unlocked=true,
         oos_unlocked_at=now(),
         oos_unlock_note=trim(p_note),
         updated_at=now()
   where singleton=true and not oos_unlocked;
  if not found then
    raise exception 'OOS control could not be unlocked';
  end if;

  return v_release_id;
end $$;

revoke all on function private.release_stock_hunter_oos_v416(text,text) from public,anon,authenticated,service_role;
grant execute on function private.release_stock_hunter_oos_v416(text,text) to postgres;
comment on function private.release_stock_hunter_oos_v416(text,text) is
  'One-time manual OOS release. Atomically freezes dataset, candidate/baseline snapshots, OOS results, fingerprint, then irreversibly unlocks OOS.';

create or replace view public.stock_hunter_oos_release_integrity_v416
with (security_invoker=true)
as
with mc as (
  select count(*)::integer as manifest_count
  from public.stock_hunter_oos_release_manifest_v416
), m as (
  select * from public.stock_hunter_oos_release_manifest_v416 order by release_id limit 1
), f as (
  select count(*)::integer as snapshot_rows,
         count(*) filter(where split='train')::integer as train_rows,
         count(*) filter(where split='validation')::integer as validation_rows,
         count(*) filter(where split='oos')::integer as oos_rows,
         md5(coalesce(string_agg((to_jsonb(x)-'release_id'-'frozen_at')::text,'|' order by x.sample_id::text),'')) as frozen_fingerprint
  from public.stock_hunter_oos_release_dataset_v416 x
  where x.release_id=(select release_id from m)
), r as (
  select count(*)::integer as result_rows,
         count(*) filter(where result_role='candidate')::integer as candidate_rows,
         count(*) filter(where result_role='baseline')::integer as baseline_rows,
         count(distinct hunt_mode)::integer as result_modes
  from public.stock_hunter_oos_release_results_v416
  where release_id=(select release_id from m)
), c as (
  select oos_unlocked from public.stock_hunter_candidate_eval_control_v416 where singleton=true
)
select
  mc.manifest_count,
  m.release_id,
  c.oos_unlocked,
  m.protocol_version,
  m.dataset_fingerprint_protocol,
  m.dataset_fingerprint,
  f.frozen_fingerprint,
  m.dataset_snapshot_rows,
  f.snapshot_rows,
  f.train_rows,
  f.validation_rows,
  f.oos_rows,
  r.result_rows,
  r.candidate_rows,
  r.baseline_rows,
  r.result_modes,
  case when m.release_id is null then 0 else jsonb_array_length(m.candidate_snapshot) end as frozen_candidate_modes,
  case when m.release_id is null then 0 else jsonb_array_length(m.baseline_snapshot) end as frozen_baseline_modes,
  case when m.release_id is null then 0 else jsonb_array_length(m.robustness_snapshot) end as frozen_robustness_modes,
  case
    when mc.manifest_count=0 and not c.oos_unlocked then 'LOCKED_AWAITING_MATURITY'
    when mc.manifest_count<>1 then 'HOLD_MANIFEST_COUNT'
    when not c.oos_unlocked then 'HOLD_MANIFEST_WITHOUT_UNLOCK'
    when f.snapshot_rows is distinct from m.dataset_snapshot_rows then 'HOLD_DATASET_ROW_COUNT'
    when f.frozen_fingerprint is distinct from m.dataset_fingerprint then 'HOLD_DATASET_FINGERPRINT'
    when r.result_rows<>4 or r.candidate_rows<>2 or r.baseline_rows<>2 or r.result_modes<>2 then 'HOLD_OOS_RESULTS'
    when jsonb_array_length(m.candidate_snapshot)<>2 or jsonb_array_length(m.baseline_snapshot)<>2 or jsonb_array_length(m.robustness_snapshot)<>2 then 'HOLD_SNAPSHOT_CARDINALITY'
    else 'FROZEN_PASS'
  end as integrity_state
from mc
cross join c
left join m on true
cross join f
cross join r;

revoke all on public.stock_hunter_oos_release_integrity_v416 from anon,authenticated;
grant select on public.stock_hunter_oos_release_integrity_v416 to service_role;


-- Live-close ACL companion.
-- Companion ACL/immutability hardening for the one-time OOS release.
-- The controlled private release function runs as postgres; service/data-api roles are read-only.

revoke all on public.stock_hunter_oos_release_dataset_v416 from public,anon,authenticated,service_role;
grant select on public.stock_hunter_oos_release_dataset_v416 to anon,authenticated,service_role;

revoke insert,update,delete,truncate,references,trigger
  on public.stock_hunter_oos_release_manifest_v416
  from public,anon,authenticated,service_role;
revoke insert,update,delete,truncate,references,trigger
  on public.stock_hunter_oos_release_results_v416
  from public,anon,authenticated,service_role;

grant select on public.stock_hunter_oos_release_manifest_v416 to service_role;
grant select on public.stock_hunter_oos_release_results_v416 to service_role;
grant select on public.stock_hunter_candidate_eval_control_v416 to service_role;

create unique index if not exists stock_hunter_oos_release_manifest_singleton_v416
  on public.stock_hunter_oos_release_manifest_v416 ((true));

drop trigger if exists stock_hunter_oos_manifest_immutable_v416 on public.stock_hunter_oos_release_manifest_v416;
create trigger stock_hunter_oos_manifest_immutable_v416
before update or delete or truncate on public.stock_hunter_oos_release_manifest_v416
for each statement execute function private.reject_stock_hunter_oos_release_mutation_v416();

drop trigger if exists stock_hunter_oos_results_immutable_v416 on public.stock_hunter_oos_release_results_v416;
create trigger stock_hunter_oos_results_immutable_v416
before update or delete or truncate on public.stock_hunter_oos_release_results_v416
for each statement execute function private.reject_stock_hunter_oos_release_mutation_v416();


-- Make the integrity surface explicitly service-role-only.
revoke all on public.stock_hunter_oos_release_integrity_v416 from public,anon,authenticated,service_role;
grant select on public.stock_hunter_oos_release_integrity_v416 to service_role;
