-- Stock Hunter 4.3.0 — complete market replay symbol catalog.
-- UI/data-access only. Frozen engine 4.1.6-hunt-v2 remains unchanged.
-- Returns the complete active numeric universe in one JSON value so Data API row caps
-- cannot truncate the replay dropdown. SECURITY INVOKER preserves caller RLS/grants.

create or replace function public.stock_hunter_market_replay_symbol_catalog_v430(p_trade_date date default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with latest as (
  select max(trade_date) as latest_trade_date
  from public.stock_hunter_market_replay_live_symbols_v416
), chosen as (
  select coalesce(p_trade_date, latest.latest_trade_date) as trade_date
  from latest
), available as (
  select s.symbol_id::text as symbol_id,
         max(s.symbol) as symbol,
         max(s.bucket_count)::integer as bucket_count,
         max(s.resolution_seconds)::integer as resolution_seconds
  from public.stock_hunter_market_replay_live_symbols_v416 s
  join chosen c on s.trade_date = c.trade_date
  group by s.symbol_id
), catalog as (
  select u.ins_code::text as symbol_id,
         u.symbol,
         coalesce(u.company_name,'') as company_name,
         coalesce(u.asset_type,'') as asset_type,
         coalesce(u.market,'') as market,
         a.bucket_count,
         a.resolution_seconds
  from public.stock_hunter_universe_v4 u
  left join available a on a.symbol_id = u.ins_code::text
  where u.is_active = true
    and u.ins_code ~ '^[0-9]+$'
    and u.symbol is not null
    and btrim(u.symbol) <> ''
)
select jsonb_build_object(
  'requested_trade_date', p_trade_date,
  'trade_date', (select trade_date from chosen),
  'total_symbols', count(*),
  'available_symbols', count(*) filter (where bucket_count is not null),
  'symbols', coalesce(
    jsonb_agg(
      jsonb_build_object(
        'symbol_id', symbol_id,
        'symbol', symbol,
        'company_name', company_name,
        'asset_type', asset_type,
        'market', market,
        'bucket_count', bucket_count,
        'resolution_seconds', resolution_seconds
      )
      order by (bucket_count is not null) desc, symbol asc, company_name asc
    ),
    '[]'::jsonb
  )
)
from catalog;
$$;

revoke all on function public.stock_hunter_market_replay_symbol_catalog_v430(date) from public;
grant execute on function public.stock_hunter_market_replay_symbol_catalog_v430(date) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
