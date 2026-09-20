import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.9";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.12";

const AUDIENCE="stock-hunter-live-gate-v417";
const EXPECTED_REPO="afzalpour/afzalpour.github.io";
const EXPECTED_REPO_ID="1350071624";
const EXPECTED_OWNER_ID="221893601";
const EXPECTED_REF="refs/heads/main";
const EXPECTED_WORKFLOW_REF="afzalpour/afzalpour.github.io/.github/workflows/stock-hunter-live-first-day-eod.yml@refs/heads/main";
const EXPECTED_MATURITY_WORKFLOW_REF="afzalpour/afzalpour.github.io/.github/workflows/stock-hunter-live-first-maturity-horizon.yml@refs/heads/main";
const JWKS=createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

const FIRST_DAY_SQL="-- Stock Hunter 4.1.6 first prospective trading-day EOD quality verifier.\n-- State-aware before and after the first eligible day.\n-- Expected final row: stock-hunter-prospective-eod-quality-v416: PASS\n\ndo $$\ndeclare\n  v_trade_date date := date '2026-09-19';\n  v_start timestamptz := timestamptz '2026-09-19 05:30:00+00';\n  v_eod_deadline timestamptz := timestamptz '2026-09-19 14:55:00+00';\n  v_now timestamptz := now();\n  v_shadow bigint;\n  v_events bigint;\n  v_shadow_outcomes bigint;\n  v_hunt_outcomes bigint;\n  v_bad_shadow bigint;\n  v_bad_events bigint;\n  v_bad_outcomes bigint;\n  v_latest_cron_bad bigint;\n  v_capture_job_coverage bigint;\n  v_downstream_job_coverage bigint;\n  v_candidate_runs bigint;\n  v_calibration_rows bigint;\n  v_oos_manifest bigint;\n  v_promotions bigint;\n  v_reviews bigint;\n  v_release_pins bigint;\n  c public.stock_hunter_capture_state_v416%rowtype;\n  o public.stock_hunter_outcome_control_v416%rowtype;\n  a public.stock_hunter_activation_status_v417%rowtype;\n  m public.stock_hunter_maturity_status_v416%rowtype;\n  cs public.stock_hunter_candidate_evaluator_status_v416%rowtype;\n  cc public.stock_hunter_candidate_eval_control_v416%rowtype;\nbegin\n  select * into strict c\n  from public.stock_hunter_capture_state_v416\n  where singleton=true;\n\n  select * into strict o\n  from public.stock_hunter_outcome_control_v416\n  where singleton=true;\n\n  select * into strict a\n  from public.stock_hunter_activation_status_v417\n  where status_id='default';\n\n  select * into strict m\n  from public.stock_hunter_maturity_status_v416;\n\n  select * into strict cs\n  from public.stock_hunter_candidate_evaluator_status_v416;\n\n  select * into strict cc\n  from public.stock_hunter_candidate_eval_control_v416\n  where singleton=true;\n\n  if a.routing_mode<>'CHAMPION_ONLY'\n     or a.challenger_traffic_percent<>0\n     or not a.kill_switch_engaged\n     or a.activation_review_id is not null then\n    raise exception 'control plane escaped champion-only lock during first prospective day';\n  end if;\n\n  select count(*) into v_shadow\n  from public.stock_hunter_shadow_samples_v416\n  where trade_date=v_trade_date;\n\n  select count(*) into v_events\n  from public.stock_hunter_hunt_events_v416\n  where trade_date=v_trade_date;\n\n  select count(*) into v_shadow_outcomes\n  from public.stock_hunter_shadow_outcome_observations_v416 so\n  join public.stock_hunter_shadow_samples_v416 s using(sample_id)\n  where s.trade_date=v_trade_date\n    and so.observation_date=v_trade_date;\n\n  select count(*) into v_hunt_outcomes\n  from public.stock_hunter_hunt_outcome_observations_v416 ho\n  join public.stock_hunter_hunt_events_v416 e using(event_id)\n  where e.trade_date=v_trade_date\n    and ho.observation_date=v_trade_date;\n\n  select count(*) into v_bad_shadow\n  from public.stock_hunter_shadow_samples_v416 s\n  where s.trade_date=v_trade_date\n    and (\n      s.source_version<>'4.1.6-shadow-v2-parity'\n      or s.hunt_mode not in ('reversal','acceleration')\n      or s.observed_at<v_start\n      or (s.observed_at at time zone 'Asia/Tehran')::date<>s.trade_date\n      or s.created_at < s.observed_at - interval '5 seconds'\n      or s.created_at - s.observed_at > interval '10 minutes'\n      or (s.hunt_mode='reversal' and coalesce(s.reference_yesterday_price,0)<=0)\n    );\n\n  if v_bad_shadow<>0 then\n    raise exception 'first-day shadow provenance invariant failed for % rows',v_bad_shadow;\n  end if;\n\n  select count(*) into v_bad_events\n  from public.stock_hunter_hunt_events_v416 e\n  where e.trade_date=v_trade_date\n    and (\n      e.source_version<>'4.1.6-server-v4-parity'\n      or e.hunt_mode not in ('reversal','acceleration')\n      or e.first_seen_at<v_start\n      or (e.first_seen_at at time zone 'Asia/Tehran')::date<>e.trade_date\n      or not coalesce(e.feature_vector_complete,false)\n      or (e.hunt_mode='reversal' and coalesce(e.reference_yesterday_price,0)<=0)\n    );\n\n  if v_bad_events<>0 then\n    raise exception 'first-day hunt-event provenance invariant failed for % rows',v_bad_events;\n  end if;\n\n  select count(*) into v_bad_outcomes\n  from (\n    select so.sample_id\n    from public.stock_hunter_shadow_outcome_observations_v416 so\n    join public.stock_hunter_shadow_samples_v416 s using(sample_id)\n    where s.trade_date=v_trade_date\n      and so.observation_date=v_trade_date\n      and (\n        so.observed_at < s.observed_at\n        or so.candle_count<=0\n        or so.high_price is null\n        or so.low_price is null\n        or so.close_price is null\n      )\n    union all\n    select ho.event_id\n    from public.stock_hunter_hunt_outcome_observations_v416 ho\n    join public.stock_hunter_hunt_events_v416 e using(event_id)\n    where e.trade_date=v_trade_date\n      and ho.observation_date=v_trade_date\n      and (\n        ho.observed_at < e.first_seen_at\n        or ho.candle_count<=0\n        or ho.high_price is null\n        or ho.low_price is null\n        or ho.close_price is null\n      )\n  ) q;\n\n  if v_bad_outcomes<>0 then\n    raise exception 'first-day same-day outcome integrity failed for % rows',v_bad_outcomes;\n  end if;\n\n  -- No pre-prospective rows may appear in raw collection tables.\n  if exists (\n      select 1 from public.stock_hunter_shadow_samples_v416\n      where observed_at<v_start\n    )\n    or exists (\n      select 1 from public.stock_hunter_hunt_events_v416\n      where first_seen_at<v_start\n    ) then\n    raise exception 'pre-prospective raw rows detected';\n  end if;\n\n  select count(*) into v_candidate_runs\n  from public.stock_hunter_candidate_evaluation_runs_v416;\n\n  select count(*) into v_calibration_rows\n  from public.stock_hunter_calibration_dataset_v416;\n\n  select count(*) into v_oos_manifest\n  from public.stock_hunter_oos_release_manifest_v416;\n\n  select count(*) into v_promotions\n  from public.stock_hunter_promotion_proposals_v416;\n\n  select count(*) into v_reviews\n  from public.stock_hunter_activation_reviews_v417;\n\n  select count(*) into v_release_pins\n  from private.stock_hunter_release_pin_manifests_v417;\n\n  -- Same-day data must not leak into mature calibration or downstream release state.\n  if v_calibration_rows<>0\n     or m.total_samples<>0\n     or m.trade_dates<>0\n     or m.oos_samples<>0\n     or m.selected_modes<>0\n     or m.robust_modes<>0\n     or m.oos_unlocked\n     or m.can_unlock_oos\n     or cs.calibration_ready\n     or cs.total_samples<>0\n     or cs.trade_dates<>0\n     or cc.oos_unlocked\n     or cc.auto_promote\n     or v_candidate_runs<>0\n     or v_oos_manifest<>0\n     or v_promotions<>0\n     or v_reviews<>0\n     or v_release_pins<>0 then\n    raise exception 'same-day prospective data leaked into maturity/OOS/promotion/release state';\n  end if;\n\n  if v_now >= v_eod_deadline then\n    if c.last_success_at is null or c.last_success_at<v_start or c.last_error is not null then\n      raise exception 'first trading-day capture did not finish successfully: %',\n        coalesce(c.last_error,'no successful capture after prospective start');\n    end if;\n\n    if v_shadow=0 then\n      raise exception 'first trading-day capture produced zero shadow samples';\n    end if;\n\n    if v_shadow_outcomes=0 then\n      raise exception 'first trading-day shadow outcome jobs produced zero same-day observations';\n    end if;\n\n    if v_events>0 and v_hunt_outcomes=0 then\n      raise exception 'hunt events exist but same-day hunt outcomes are zero';\n    end if;\n\n    if o.last_error is not null\n       or o.last_success_at is null\n       or o.last_success_at < timestamptz '2026-09-19 13:45:00+00' then\n      raise exception 'hunt outcome control did not finish cleanly after market close: %',\n        coalesce(o.last_error,'missing close-run success');\n    end if;\n\n    select count(*) into v_capture_job_coverage\n    from (\n      select distinct j.jobname\n      from cron.job j\n      join cron.job_run_details d using(jobid)\n      where j.jobname in (\n        'stock-hunter-capture-v416-open',\n        'stock-hunter-capture-v416-mid',\n        'stock-hunter-capture-v416-close'\n      )\n        and d.status='succeeded'\n        and d.start_time>=v_start\n        and d.start_time<=v_eod_deadline\n    ) q;\n\n    if v_capture_job_coverage<>3 then\n      raise exception 'not all three capture cron phases recorded a successful run';\n    end if;\n\n    select count(*) into v_downstream_job_coverage\n    from (\n      select distinct j.jobname\n      from cron.job j\n      join cron.job_run_details d using(jobid)\n      where j.jobname in (\n        'stock-hunter-outcomes-v416-close-a',\n        'stock-hunter-outcomes-v416-close-b',\n        'stock-hunter-shadow-outcomes-v416-close-a',\n        'stock-hunter-shadow-outcomes-v416-close-b',\n        'stock-hunter-candidate-evaluator-v416'\n      )\n        and d.status='succeeded'\n        and d.start_time>=timestamptz '2026-09-19 13:40:00+00'\n        and d.start_time<=v_eod_deadline\n    ) q;\n\n    if v_downstream_job_coverage<>5 then\n      raise exception 'not all five close/outcome/evaluator cron jobs recorded a successful run';\n    end if;\n\n    -- Latest run of each critical job must not be failed at EOD.\n    select count(*) into v_latest_cron_bad\n    from (\n      select j.jobname,\n             (\n               select d.status\n               from cron.job_run_details d\n               where d.jobid=j.jobid\n                 and d.start_time>=v_start\n                 and d.start_time<=v_eod_deadline\n               order by d.start_time desc\n               limit 1\n             ) as latest_status\n      from cron.job j\n      where j.jobname in (\n        'stock-hunter-capture-v416-open',\n        'stock-hunter-capture-v416-mid',\n        'stock-hunter-capture-v416-close',\n        'stock-hunter-outcomes-v416-close-a',\n        'stock-hunter-outcomes-v416-close-b',\n        'stock-hunter-shadow-outcomes-v416-close-a',\n        'stock-hunter-shadow-outcomes-v416-close-b',\n        'stock-hunter-candidate-evaluator-v416'\n      )\n    ) q\n    where latest_status is distinct from 'succeeded';\n\n    if v_latest_cron_bad<>0 then\n      raise exception '% critical cron jobs do not have a successful latest EOD run',v_latest_cron_bad;\n    end if;\n  end if;\nend $$;\n\nselect 'stock-hunter-prospective-eod-quality-v416: PASS' as result;\n";
const FIRST_MATURITY_SQL="-- Stock Hunter 4.1.6 first prospective maturity-horizon verifier.\n-- First cohort: trade_date 2026-09-19.\n-- Three future sessions: 2026-09-20, 2026-09-21, 2026-09-22.\n-- Expected final row: stock-hunter-first-maturity-horizon-v416: PASS\n\ndo $$\ndeclare\n  v_first_trade_date date := date '2026-09-19';\n  v_horizon_deadline timestamptz := timestamptz '2026-09-22 14:55:00+00';\n  v_now timestamptz := now();\n  v_cal_rows bigint;\n  v_expected_mature bigint;\n  v_bad_cal bigint;\n  v_bad_future_dates bigint;\n  v_later_cohort_leak bigint;\n  v_downstream_coverage bigint;\n  v_candidate_runs bigint;\n  v_oos bigint;\n  v_promotions bigint;\n  v_reviews bigint;\n  v_release_pins bigint;\n  m public.stock_hunter_maturity_status_v416%rowtype;\n  a public.stock_hunter_activation_status_v417%rowtype;\nbegin\n  select * into strict m\n  from public.stock_hunter_maturity_status_v416;\n\n  select * into strict a\n  from public.stock_hunter_activation_status_v417\n  where status_id='default';\n\n  if a.routing_mode<>'CHAMPION_ONLY'\n     or a.challenger_traffic_percent<>0\n     or not a.kill_switch_engaged\n     or a.activation_review_id is not null then\n    raise exception 'control plane escaped champion-only lock before first maturity horizon';\n  end if;\n\n  select count(*) into v_cal_rows\n  from public.stock_hunter_calibration_dataset_v416\n  where trade_date=v_first_trade_date;\n\n  select count(*) into v_expected_mature\n  from public.stock_hunter_shadow_outcomes_v416 o\n  join public.stock_hunter_shadow_samples_v416 s using(sample_id)\n  cross join public.stock_hunter_calibration_policy_v416 p\n  where p.policy_id='default'\n    and o.trade_date=v_first_trade_date\n    and o.future_sessions_observed>=3\n    and o.gate_reason=''\n    and s.observed_at>=p.prospective_start_at\n    and s.trade_date=(s.observed_at at time zone 'Asia/Tehran')::date\n    and s.created_at>=s.observed_at-interval '2 minutes'\n    and s.created_at<=s.observed_at + p.max_capture_lag_seconds * interval '1 second';\n\n  if v_cal_rows<>v_expected_mature then\n    raise exception 'calibration first-cohort count mismatch: dataset %, expected mature %',\n      v_cal_rows,v_expected_mature;\n  end if;\n\n  select count(*) into v_bad_cal\n  from public.stock_hunter_calibration_dataset_v416 c\n  where c.trade_date=v_first_trade_date\n    and (\n      c.future_sessions_observed<3\n      or c.source_version<>'4.1.6-shadow-v2-parity'\n      or c.gate_reason<>''\n      or c.observed_at<timestamptz '2026-09-19 05:30:00+00'\n      or (c.observed_at at time zone 'Asia/Tehran')::date<>c.trade_date\n      or c.return_3d_pct is null\n    );\n\n  if v_bad_cal<>0 then\n    raise exception 'first-cohort calibration contains % premature/invalid rows',v_bad_cal;\n  end if;\n\n  select count(*) into v_bad_future_dates\n  from public.stock_hunter_calibration_dataset_v416 c\n  where c.trade_date=v_first_trade_date\n    and (\n      not exists (\n        select 1\n        from public.stock_hunter_shadow_outcome_observations_v416 o\n        where o.sample_id=c.sample_id\n          and o.observation_date=date '2026-09-20'\n      )\n      or not exists (\n        select 1\n        from public.stock_hunter_shadow_outcome_observations_v416 o\n        where o.sample_id=c.sample_id\n          and o.observation_date=date '2026-09-21'\n      )\n      or not exists (\n        select 1\n        from public.stock_hunter_shadow_outcome_observations_v416 o\n        where o.sample_id=c.sample_id\n          and o.observation_date=date '2026-09-22'\n      )\n    );\n\n  if v_bad_future_dates<>0 then\n    raise exception '% first-cohort mature rows are missing one of the three required future sessions',\n      v_bad_future_dates;\n  end if;\n\n  -- Before the 2026-09-22 close, no 2026-09-19 cohort row may mature.\n  if v_now < v_horizon_deadline and v_cal_rows<>0 then\n    raise exception 'first cohort matured before third future-session close';\n  end if;\n\n  -- At the first horizon, later cohorts cannot yet have three future sessions.\n  select count(*) into v_later_cohort_leak\n  from public.stock_hunter_calibration_dataset_v416\n  where trade_date>v_first_trade_date;\n\n  if v_now <= v_horizon_deadline + interval '6 hours'\n     and v_later_cohort_leak<>0 then\n    raise exception 'later prospective cohort leaked into calibration at first maturity horizon';\n  end if;\n\n  select count(*) into v_candidate_runs\n  from public.stock_hunter_candidate_evaluation_runs_v416;\n  select count(*) into v_oos\n  from public.stock_hunter_oos_release_manifest_v416;\n  select count(*) into v_promotions\n  from public.stock_hunter_promotion_proposals_v416;\n  select count(*) into v_reviews\n  from public.stock_hunter_activation_reviews_v417;\n  select count(*) into v_release_pins\n  from private.stock_hunter_release_pin_manifests_v417;\n\n  if v_now <= v_horizon_deadline + interval '6 hours' then\n    if m.trade_dates>1\n       or m.calibration_ready\n       or m.oos_unlocked\n       or m.can_unlock_oos\n       or v_candidate_runs<>0\n       or v_oos<>0\n       or v_promotions<>0\n       or v_reviews<>0\n       or v_release_pins<>0 then\n      raise exception 'first maturity horizon prematurely advanced downstream lifecycle state';\n    end if;\n  end if;\n\n  if v_now >= v_horizon_deadline then\n    -- Every downstream close/evaluator job must have succeeded on each of the\n    -- three future sessions so the maturity horizon is operationally complete.\n    select count(*) into v_downstream_coverage\n    from (\n      select j.jobname,\n             (d.start_time at time zone 'Asia/Tehran')::date as run_date\n      from cron.job j\n      join cron.job_run_details d using(jobid)\n      where j.jobname in (\n        'stock-hunter-outcomes-v416-close-a',\n        'stock-hunter-outcomes-v416-close-b',\n        'stock-hunter-shadow-outcomes-v416-close-a',\n        'stock-hunter-shadow-outcomes-v416-close-b',\n        'stock-hunter-candidate-evaluator-v416'\n      )\n        and d.status='succeeded'\n        and (d.start_time at time zone 'Asia/Tehran')::date\n            in (date '2026-09-20',date '2026-09-21',date '2026-09-22')\n      group by j.jobname,(d.start_time at time zone 'Asia/Tehran')::date\n    ) q;\n\n    if v_downstream_coverage<>15 then\n      raise exception 'maturity horizon missing downstream cron coverage: got % of 15 job/day successes',\n        v_downstream_coverage;\n    end if;\n\n    if v_expected_mature=0 then\n      -- Zero is allowed only as an empirical result of zero eligible first-day\n      -- rows reaching three complete future sessions. Do not fabricate maturity.\n      if exists (\n        select 1\n        from public.stock_hunter_shadow_samples_v416 s\n        join public.stock_hunter_shadow_outcomes_v416 o using(sample_id)\n        where s.trade_date=v_first_trade_date\n          and s.gate_reason=''\n          and o.future_sessions_observed>=3\n      ) then\n        raise exception 'eligible completed first-cohort rows exist but expected mature count is zero';\n      end if;\n    end if;\n\n    if m.maturity_state<>'COLLECTING' then\n      raise exception 'first horizon should remain COLLECTING, got %',m.maturity_state;\n    end if;\n  end if;\nend $$;\n\nselect 'stock-hunter-first-maturity-horizon-v416: PASS' as result;\n";


const LIVE_SNAPSHOT_SQL=`
select jsonb_build_object(
  'checked_at', now(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'feed', jsonb_build_object(
    'signal_rows', (select count(*) from public.stock_hunter_signals_v4),
    'max_updated_at', (select max(updated_at) from public.stock_hunter_signals_v4),
    'fresh_180s_rows', (select count(*) from public.stock_hunter_signals_v4 where updated_at>=now()-interval '180 seconds'),
    'health', (select to_jsonb(x) from public.stock_hunter_feed_health_v4 x where id='local-agent' limit 1)
  ),
  'prospective_raw', jsonb_build_object(
    'shadow_samples', (select count(*) from public.stock_hunter_shadow_samples_v416),
    'hunt_events', (select count(*) from public.stock_hunter_hunt_events_v416),
    'shadow_outcomes', (select count(*) from public.stock_hunter_shadow_outcome_observations_v416),
    'hunt_outcomes', (select count(*) from public.stock_hunter_hunt_outcome_observations_v416),
    'calibration_dataset_rows', (select count(*) from public.stock_hunter_calibration_dataset_v416)
  ),
  'routing', (select to_jsonb(x) from public.stock_hunter_activation_status_v417 x where status_id='default' limit 1),
  'capture', jsonb_build_object(
    'v416_state', (select to_jsonb(x) from public.stock_hunter_capture_state_v416 x where singleton=true limit 1),
    'outcome_control', (select to_jsonb(x) from public.stock_hunter_outcome_control_v416 x where singleton=true limit 1),
    'active_v417_cron_callers', (select count(*) from cron.job where active and command ilike '%stock-hunter-capture-v417%')
  ),
  'auth_aggregate', jsonb_build_object(
    'auth_users', (select count(*) from auth.users),
    'profiles', (select count(*) from public.stock_hunter_profiles_v417),
    'roles', (select count(*) from public.stock_hunter_user_roles_v417),
    'admin_audit_rows', (select count(*) from public.stock_hunter_admin_audit_v417)
  ),
  'release_state', jsonb_build_object(
    'candidate_evaluation_runs', (select count(*) from public.stock_hunter_candidate_evaluation_runs_v416),
    'oos_release_manifests', (select count(*) from public.stock_hunter_oos_release_manifest_v416),
    'oos_release_results', (select count(*) from public.stock_hunter_oos_release_results_v416),
    'promotion_proposals', (select count(*) from public.stock_hunter_promotion_proposals_v416),
    'activation_reviews', (select count(*) from public.stock_hunter_activation_reviews_v417),
    'release_pins', (select count(*) from private.stock_hunter_release_pin_manifests_v417)
  ),
  'cron_health', (
    select coalesce(jsonb_agg(to_jsonb(q) order by q.jobname),'[]'::jsonb)
    from (
      select j.jobname,
             d.status as latest_completed_status,
             d.start_time as latest_completed_start,
             (
               select count(*)
               from cron.job_run_details r
               where r.jobid=j.jobid
                 and r.end_time is null
             )::integer as inflight_runs
      from cron.job j
      left join lateral (
        select status,start_time
        from cron.job_run_details
        where jobid=j.jobid
          and end_time is not null
        order by start_time desc
        limit 1
      ) d on true
      where j.jobname like 'stock-hunter-%'
    ) q
  )
) as snapshot;
`;
const VERIFIERS={
  "first-day-eod-v416":{
    workflowRef:EXPECTED_WORKFLOW_REF,
    events:new Set(["push","workflow_dispatch"]),
    sql:FIRST_DAY_SQL,
    snapshotSql:LIVE_SNAPSHOT_SQL,
    result:"stock-hunter-prospective-eod-quality-v416: PASS",
    notBefore:"2026-09-19T14:55:00.000Z"
  },
  "first-maturity-horizon-v416":{
    workflowRef:EXPECTED_MATURITY_WORKFLOW_REF,
    events:new Set(["schedule","workflow_dispatch"]),
    sql:FIRST_MATURITY_SQL,
    snapshotSql:LIVE_SNAPSHOT_SQL,
    result:"stock-hunter-first-maturity-horizon-v416: PASS",
    notBefore:"2026-09-22T14:55:00.000Z"
  }
} as const;

function out(status:number,body:unknown){
  return Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return out(405,{error:"method_not_allowed"});
  const auth=req.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer "))return out(401,{error:"missing_oidc_token"});
  try{
    const token=auth.slice(7).trim();
    const {payload}=await jwtVerify(token,JWKS,{
      issuer:"https://token.actions.githubusercontent.com",
      audience:AUDIENCE
    });

    if(String(payload.repository||"")!==EXPECTED_REPO) return out(403,{error:"repository_mismatch"});
    if(String(payload.repository_id||"")!==EXPECTED_REPO_ID) return out(403,{error:"repository_id_mismatch"});
    if(String(payload.repository_owner_id||"")!==EXPECTED_OWNER_ID) return out(403,{error:"owner_id_mismatch"});
    if(String(payload.ref||"")!==EXPECTED_REF) return out(403,{error:"ref_mismatch"});

    const body=await req.json().catch(()=>({}));
    const purpose=String(body?.purpose||"");
    const verifier=(VERIFIERS as Record<string,any>)[purpose];
    if(!verifier)return out(400,{error:"unknown_purpose"});
    if(String(payload.workflow_ref||"")!==verifier.workflowRef) return out(403,{error:"workflow_ref_mismatch"});
    if(!verifier.events.has(String(payload.event_name||""))) return out(403,{error:"event_not_allowed"});

    if(Date.now()<Date.parse(verifier.notBefore)){
      return out(409,{
        error:"horizon_not_reached",
        purpose,
        not_before:verifier.notBefore,
        checked_at:new Date().toISOString()
      });
    }

    const dbUrl=Deno.env.get("SUPABASE_DB_URL");
    if(!dbUrl)return out(500,{error:"db_url_unavailable"});
    const sql=postgres(dbUrl,{prepare:false,max:1,connect_timeout:10,idle_timeout:2});
    try{
      await sql.begin(async tx=>{
        await tx.unsafe("SET TRANSACTION READ ONLY");
        await tx.unsafe("SET LOCAL statement_timeout = '90000ms'");
        await tx.unsafe(verifier.sql);
      });

      let snapshot:unknown=null;
      let snapshotError:string|null=null;
      if(verifier.snapshotSql){
        try{
          await sql.begin(async tx=>{
            await tx.unsafe("SET TRANSACTION READ ONLY");
            await tx.unsafe("SET LOCAL statement_timeout = '10000ms'");
            const rows=await tx.unsafe(verifier.snapshotSql);
            const row=(rows as any[])?.[0] as any;
            snapshot=row?.snapshot??null;
          });
        }catch(e){
          const msg=e instanceof Error?e.message:String(e);
          snapshotError=msg.slice(0,500);
        }
      }

      return out(200,{
        result:verifier.result,
        purpose,
        repository:String(payload.repository),
        ref:String(payload.ref),
        workflow_ref:String(payload.workflow_ref),
        run_id:String(payload.run_id||""),
        checked_at:new Date().toISOString(),
        snapshot,
        snapshot_error:snapshotError
      });
    }catch(e){
      const msg=e instanceof Error?e.message:String(e);
      return out(422,{error:"verifier_failed",message:msg.slice(0,2000),purpose});
    }finally{
      await sql.end({timeout:1}).catch(()=>{});
    }
  }catch(e){
    const msg=e instanceof Error?e.message:String(e);
    return out(401,{error:"oidc_verification_failed",message:msg.slice(0,500)});
  }
});