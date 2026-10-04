-- Stock Hunter 4.2.9 — live market replay adapter.
-- Purpose: serve replay UI directly from the authoritative Hunt Market Tape without
-- recreating the former ~100 MB derived replay table.
-- Frozen engine 4.1.6-hunt-v2 is not modified.

drop policy if exists "market tape replay public read v416"
on public.stock_hunter_hunt_market_tape_v416;

create policy "market tape replay public read v416"
on public.stock_hunter_hunt_market_tape_v416
for select
to anon, authenticated
using (
  observation_date >= (current_date - 35)
  and observation_date <= current_date
);

revoke select on public.stock_hunter_hunt_market_tape_v416 from anon, authenticated;
grant select (
  observation_date,
  observed_at,
  symbol_id,
  symbol,
  last_price,
  yesterday_price,
  buy_queue,
  sell_queue,
  volume
) on public.stock_hunter_hunt_market_tape_v416 to anon, authenticated;

create or replace view public.stock_hunter_market_replay_live_v416
with (security_invoker = true)
as
with base as (
  select
    observation_date as trade_date,
    symbol_id,
    symbol,
    observed_at,
    last_price,
    yesterday_price,
    buy_queue,
    sell_queue,
    volume,
    to_timestamp(floor(extract(epoch from observed_at) / 30.0) * 30.0) as bucket_at
  from public.stock_hunter_hunt_market_tape_v416
  where last_price is not null and last_price > 0
)
select
  trade_date,
  symbol_id,
  max(symbol) as symbol,
  bucket_at,
  (array_agg(last_price order by observed_at asc))[1] as open_price,
  max(last_price) as high_price,
  min(last_price) as low_price,
  (array_agg(last_price order by observed_at desc))[1] as close_price,
  max(yesterday_price) as yesterday_price,
  case when max(yesterday_price) > 0 then (((array_agg(last_price order by observed_at asc))[1] / max(yesterday_price)) - 1) * 100 end as open_change_pct,
  case when max(yesterday_price) > 0 then ((max(last_price) / max(yesterday_price)) - 1) * 100 end as high_change_pct,
  case when max(yesterday_price) > 0 then ((min(last_price) / max(yesterday_price)) - 1) * 100 end as low_change_pct,
  case when max(yesterday_price) > 0 then (((array_agg(last_price order by observed_at desc))[1] / max(yesterday_price)) - 1) * 100 end as close_change_pct,
  max(coalesce(buy_queue,0)) as max_buy_queue,
  max(coalesce(sell_queue,0)) as max_sell_queue,
  (array_agg(volume order by observed_at desc))[1] as last_volume,
  count(last_price)::integer as sample_count,
  max(observed_at) as updated_at,
  30::integer as bucket_seconds
from base
group by trade_date, symbol_id, bucket_at;

revoke all on public.stock_hunter_market_replay_live_v416 from public;
grant select on public.stock_hunter_market_replay_live_v416 to anon, authenticated, service_role;

create or replace view public.stock_hunter_market_replay_live_symbols_v416
with (security_invoker = true)
as
select
  observation_date as trade_date,
  symbol_id,
  max(symbol) as symbol,
  count(last_price)::integer as bucket_count,
  30::integer as resolution_seconds
from public.stock_hunter_hunt_market_tape_v416
where last_price is not null and last_price > 0
group by observation_date, symbol_id;

revoke all on public.stock_hunter_market_replay_live_symbols_v416 from public;
grant select on public.stock_hunter_market_replay_live_symbols_v416 to anon, authenticated, service_role;

notify pgrst, 'reload schema';
