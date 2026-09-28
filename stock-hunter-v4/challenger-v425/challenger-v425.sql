-- Stock Hunter 4.2.5 Challenger feature columns.
-- Additive only. Frozen Hunt 4.1.6 does not read these columns.

alter table public.stock_hunter_signals_v4
  add column if not exists book_imbalance3_v425 numeric,
  add column if not exists mlofi3_v425 numeric,
  add column if not exists book_persistence_v425 numeric,
  add column if not exists cancel_proxy_v425 numeric,
  add column if not exists rvol_tod_v425 numeric,
  add column if not exists rvol_tod_samples_v425 integer,
  add column if not exists book_levels_ready_v425 boolean,
  add column if not exists challenger_feature_version_v425 text;

comment on column public.stock_hunter_signals_v4.book_imbalance3_v425 is
  'Shadow-only top-3 displayed book imbalance for Challenger 4.2.5; Frozen Hunt 4.1.6 ignores this column.';
comment on column public.stock_hunter_signals_v4.mlofi3_v425 is
  'Shadow-only price-aware three-level order-flow imbalance for Challenger 4.2.5.';
comment on column public.stock_hunter_signals_v4.book_persistence_v425 is
  'Shadow-only fraction of recent valid snapshots with positive top-3 book imbalance.';
comment on column public.stock_hunter_signals_v4.cancel_proxy_v425 is
  'Shadow-only conservative displayed-depth cancellation proxy; not official exchange cancellation data.';
comment on column public.stock_hunter_signals_v4.rvol_tod_v425 is
  'Shadow-only time-of-day cumulative relative volume versus bounded local historical same-bucket baseline.';
comment on column public.stock_hunter_signals_v4.rvol_tod_samples_v425 is
  'Number of prior same-time buckets used by the local RVOL baseline.';
comment on column public.stock_hunter_signals_v4.book_levels_ready_v425 is
  'True only when three book levels are valid for current and previous observation.';
comment on column public.stock_hunter_signals_v4.challenger_feature_version_v425 is
  'Feature provenance identifier for shadow Challenger 4.2.5.';
