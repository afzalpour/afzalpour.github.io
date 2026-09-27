-- Stock Hunter 4.1.7 / 4.1.6 outcome compatibility
-- Verifies prospective Reversal reference tracking without leaving synthetic rows.
-- Safe to run against the Stock Hunter database: all probe rows are rolled back.

begin;

do $$
declare
  v_event_id bigint;
  v_sample_id bigint;
  v_trade_date date := (now() at time zone 'Asia/Tehran')::date;
  v_ref numeric;
  v_cross boolean;
  v_close boolean;
begin
  -- Event path: reference must be reconstructed from prediction-time price/day_change,
  -- then same-day high/close must be compared to that frozen reference.
  insert into public.stock_hunter_hunt_events_v416(
    trade_date,symbol_id,symbol,company_name,hunt_state,hunt_mode,
    first_seen_at,last_seen_at,max_hunt_score,max_today_opportunity,
    day_change,evidence_count,dynamic_evidence_count,source_version,
    first_price,last_price,max_score_price,
    first_hunt_score,first_today_opportunity,first_order_pressure,first_impulse,
    first_feasibility,first_flow_volume,first_market_context,first_continuation12,
    first_risk_score,first_cancellation_ratio,feature_vector_complete,
    reference_yesterday_price
  ) values (
    v_trade_date,'__probe_reversal_reference_event__','PROBE','Rollback Probe','هشدار فوری','reversal',
    now(),now(),70,76,-1,4,2,'probe-reference-v1',
    99,99,99,70,76,60,62,64,61,55,60,20,10,true,null
  ) returning event_id,reference_yesterday_price into v_event_id,v_ref;

  if abs(v_ref-100) >= 0.0000001 then
    raise exception 'event reference reconstruction mismatch: %', v_ref;
  end if;

  insert into public.stock_hunter_hunt_outcome_observations_v416(
    event_id,observation_date,observed_at,open_price,high_price,low_price,close_price,
    candle_count,source_updated_at,close_return_pct,mfe_day_pct,mae_day_pct
  ) values (
    v_event_id,v_trade_date,now(),99,100.2,98.7,100.1,3,now(),
    (100.1/99.0-1)*100,(100.2/99.0-1)*100,(98.7/99.0-1)*100
  );

  select reversal_crossed_reference_same_day,reversal_closed_above_reference_same_day
    into v_cross,v_close
  from public.stock_hunter_hunt_outcomes_v416
  where event_id=v_event_id;

  if v_cross is distinct from true or v_close is distinct from true then
    raise exception 'event reversal flags mismatch: cross=%, close=%',v_cross,v_close;
  end if;

  -- Shadow path must obey the same frozen-reference contract.
  insert into public.stock_hunter_shadow_samples_v416(
    trade_date,symbol_id,symbol,company_name,hunt_mode,observed_at,bucket_minute,price,day_change,
    order_pressure,impulse,feasibility,flow_volume,market_context,continuation12,risk_score,cancellation_ratio,
    evidence_count,dynamic_evidence_count,baseline_today_opportunity,baseline_hunt_score,baseline_state,gate_reason,source_version,
    reference_yesterday_price
  ) values (
    v_trade_date,'__probe_reversal_reference_shadow__','PROBE','Rollback Probe','reversal',now(),600,99,-1,
    60,62,64,61,55,60,20,10,4,2,76,70,'هشدار فوری','', 'probe-reference-v1',null
  ) returning sample_id,reference_yesterday_price into v_sample_id,v_ref;

  if abs(v_ref-100) >= 0.0000001 then
    raise exception 'shadow reference reconstruction mismatch: %', v_ref;
  end if;

  insert into public.stock_hunter_shadow_outcome_observations_v416(
    sample_id,observation_date,observed_at,high_price,low_price,close_price,candle_count,
    close_return_pct,mfe_day_pct,mae_day_pct,source_updated_at
  ) values (
    v_sample_id,v_trade_date,now(),100.2,98.7,100.1,3,
    (100.1/99.0-1)*100,(100.2/99.0-1)*100,(98.7/99.0-1)*100,now()
  );

  select reversal_crossed_reference_same_day,reversal_closed_above_reference_same_day
    into v_cross,v_close
  from public.stock_hunter_shadow_outcomes_v416
  where sample_id=v_sample_id;

  if v_cross is distinct from true or v_close is distinct from true then
    raise exception 'shadow reversal flags mismatch: cross=%, close=%',v_cross,v_close;
  end if;
end $$;

rollback;
