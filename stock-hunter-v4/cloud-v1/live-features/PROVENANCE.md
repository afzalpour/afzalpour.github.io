# Stock Hunter Cloud Live Feature Provenance v1

Status: BASE SIGNAL BUILDABLE / FULL FROZEN-HUNT INPUT NOT YET PROVEN

This document separates what can be reconstructed exactly from the Iran collector payload from fields whose production provenance is currently unavailable.

## Point-in-time fields available directly from collector

Exact source facts:
- instrument id, symbol, company name, ISIN;
- source `hEven`;
- closing/last/yesterday/high/low/min/max prices;
- trade count, cumulative volume, cumulative value;
- raw `flow`, `cs`, `pf`;
- five BestLimits levels: bid/ask price, bid/ask quantity, buy/sell order counts;
- raw intraday ClientType counters.

These are point-in-time and may feed deterministic rolling features.

## Deterministic live signal feature source

The historical live feed logic currently preserved in:

`legacy-security/stock-hunter-market-scan-v4/index.ts`

is pinned at Git blob:

`e2b2e9353af61ac3b479b52a0338ceac1a26fd0f`

Its pure feature/scoring prefix is mechanically extracted into:

`cloud-v1/live-features/generated-signal-core-v401.ts`

Network/database code is excluded by the generator.

The generated legacy core provides the existing rolling/base fields:
- QI;
- OFI;
- bid-stack;
- ask-pull;
- price velocity;
- trade acceleration;
- absorption;
- cancellation ratio;
- queue decay;
- depth ratio;
- recovery;
- microprice;
- 5-minute candles;
- RSI;
- EMA9 / EMA21;
- ATR;
- VWAP;
- daily RVOL;
- technical score;
- momentum;
- real-flow ratio input;
- legacy fast score / signal acceleration;
- legacy continuation score;
- legacy risk score.

The legacy core also emits obsolete legacy Hunt/decision/entry/target outputs. Those fields are **discarded** by the cloud wrapper and have no authority over Frozen Hunt 4.1.6.

## Intraday real flow

`real_flow_ratio` is derivable live from raw ClientType counters:

individual average buy size / individual average sell size.

This is valid for the live cloud path because the collector observes the current intraday ClientType state. This does **not** authorize use of ClientType end-of-day history for historical PIT reconstruction.

## Unresolved production inputs

The browser 4.1.0+ integrated UI states that the following fields were calculated centrally by the Supabase view `stock_hunter_integrated_v1`:

- `integrated_eligible`;
- `integrated_score_v1`;
- `flow_score_v1`;
- `trend_score_v1`;
- `momentum_score_v1`;
- `data_quality_score_v1`;
- `direction_agreement_v1`;
- `confidence_score_v1`;
- `market_regime_v1`;
- `market_breadth_pct_v1`;
- `risk_gate_v1`;
- `gate_reason_v1`;
- positive/negative expert counts;
- final integrated decision fields.

The SQL definition of that view is not present in current repository history that has been located so far. The Supabase project is currently unavailable due its disk/WAL restart loop, so the live view definition cannot be queried.

Therefore these fields are classified:

`UNRESOLVED_PROVENANCE — DO NOT FABRICATE / DO NOT DEFAULT FOR PARITY CLAIMS`

## Asset/session classification gap

The collector now preserves raw `flow`, `cs`, and `pf`, but exact production `asset_type` / `market` derivation used by the old full-universe bridge has not yet been recovered from a committed source.

Until the classifier is recovered or rebuilt and independently validated, asset/session provenance is also unresolved for exact cloud cutover.

## Readiness rule

The cloud feature builder may produce `BASE_SIGNAL_PARITY_V401` rows for engineering/staging.

It must report:

`frozen_hunt_input_ready = false`

while either of these remain unresolved:
1. integrated-view provenance;
2. exact asset/session classification provenance.

The generated Frozen Hunt runtime may be tested with fixtures, but **must not be connected to production live ingest** until the missing inputs are resolved and browser/cloud live parity passes.

## Recovery paths

Preferred:
1. recover Supabase long enough to read `pg_get_viewdef('public.stock_hunter_integrated_v1'::regclass, true)` and related dependent views/functions;
2. recover the source package for the Eco Bridge universe classifier;
3. commit both recovered definitions with hashes;
4. port/generate them deterministically;
5. add live parity fixtures.

Fallback:
- independently redesign those features only as a new challenger/research path, never silently label them as Frozen 4.1.6 parity.
