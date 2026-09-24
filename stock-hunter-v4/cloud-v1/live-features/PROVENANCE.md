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

## Session logic and Eco asset/market labels recovered

Exact production session logic remains committed in:

`stock-hunter-v4/app-session-v413.js`

and the parity-approved capture runtime carries the equivalent session gate.

The descriptive Eco v4.0.8 `asset_type` / `market` derivation is now also recovered from the canonical Project Library artifact:

- ZIP SHA-256: `0d6ed1bbd11398f79a4568acd4d4f6f920d1f7fb985382a938be5408654c1139`
- EXE SHA-256: `0b80d20a349ca5d92acb7c61f4f23ab6a4dd747f33b1509f2fdf3d6f40abb8b4`

The Go 1.23 `pclntab` and x86-64 assembly preserve the exact classifier branches. The source-equivalent port is:

`cloud-v1/live-features/recovered-eco-labels-v408.ts`

Its inputs are raw collector facts:

- `symbol`
- `company_name`
- `yval`
- `flow`

The collector already parsed `yval`; the signed v1 payload now preserves it explicitly.

Recovery audit:

`ECO_V408_LABEL_CLASSIFIER_BINARY_RECOVERY_AUDIT_2026-09-24.md`

Therefore:

`asset_type_market_derivation_provenance_unresolved`

is CLOSED.

## Readiness rule

The cloud feature builder may produce `BASE_SIGNAL_PARITY_V401` rows for engineering/staging.

It must still report:

`frozen_hunt_input_ready = false`

while the authoritative integrated-view provenance remains unresolved.

Current blocker:

1. `integrated_view_provenance_unresolved`

The generated Frozen Hunt runtime may be tested with fixtures, but production cloud Hunt cutover remains blocked until the authoritative integrated SQL/dependencies are recovered and live browser/cloud parity passes.

## Recovery paths

Preferred:
1. recover Supabase long enough to read `pg_get_viewdef('public.stock_hunter_integrated_v1'::regclass, true)` and related dependent views/functions;
2. commit the recovered integrated definitions with hashes;
3. port/generate them deterministically;
4. add live parity fixtures.

Eco v4.0.8 asset/market label provenance is already recovered from the canonical executable artifact and no longer blocks readiness.

Recovery audit:
`INTEGRATED_V410_PROVENANCE_RECOVERY_AUDIT_2026-09-24.md` documents what was recovered from Git history, the live Supabase management plane, and what remains unavailable.

Fallback:
- independently redesign those features only as a new challenger/research path, never silently label them as Frozen 4.1.6 parity.
