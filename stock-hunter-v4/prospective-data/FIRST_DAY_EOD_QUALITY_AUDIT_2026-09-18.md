# Stock Hunter First Prospective Day EOD Quality Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_EOD_PASS
TRADE_DATE: 2026-09-19
EOD_VERIFICATION_DEADLINE_UTC: 2026-09-19T14:55:00Z
EOD_VERIFICATION_DEADLINE_TEHRAN: 2026-09-19 18:25

## Purpose

This gate validates the complete first-day prospective chain:

capture -> raw Hunt/Shadow provenance -> same-day outcome observations -> cron completion -> candidate evaluator scheduling

while proving that same-day observations do not leak into mature Calibration, OOS, Promotion, Activation, or final release state.

## Raw prospective invariants

For 2026-09-19:

Shadow samples must use source_version:

4.1.6-shadow-v2-parity

Hunt events must use source_version:

4.1.6-server-v4-parity

All first-day raw rows must:

- be observed at or after prospective_start_at = 2026-09-19T05:30:00Z;
- map back to the same Tehran trade_date;
- use hunt_mode reversal or acceleration;
- preserve a positive reference_yesterday_price for reversal rows;
- keep Shadow create/observe lag within the frozen 600-second capture-lag contract;
- keep Hunt event feature_vector_complete=true.

No raw row with an observation timestamp before the prospective boundary is allowed.

## Same-day outcome integrity

The EOD verifier checks same-day Shadow and Hunt outcome observations for:

- observation_date equal to the first prospective trade date;
- observed_at not earlier than the prediction timestamp;
- positive candle_count;
- non-null high/low/close prices.

After EOD deadline:

- first-day Shadow samples must be non-zero;
- first-day same-day Shadow outcome observations must be non-zero;
- if Hunt events exist, same-day Hunt outcome observations must also be non-zero;
- outcome_control must have a clean post-close success.

No arbitrary outcome-coverage percentage threshold is invented in this gate. Counts are reported for empirical review; the strict invariant is that the outcome path is functioning and not completely empty when predictions exist.

## Cron completion

By 18:25 Tehran, all three capture phases must have at least one succeeded cron run:

- stock-hunter-capture-v416-open
- stock-hunter-capture-v416-mid
- stock-hunter-capture-v416-close

All five downstream close jobs must also record a succeeded run:

- stock-hunter-outcomes-v416-close-a
- stock-hunter-outcomes-v416-close-b
- stock-hunter-shadow-outcomes-v416-close-a
- stock-hunter-shadow-outcomes-v416-close-b
- stock-hunter-candidate-evaluator-v416

The latest EOD run for every critical job must be succeeded.

The candidate evaluator is expected to return NULL and create no evaluation-run row until Calibration is actually ready. Cron success, not a premature candidate snapshot, is the correct first-day behavior.

## Same-day leakage prohibition

On the first prospective trade date, after EOD:

- stock_hunter_calibration_dataset_v416 rows must remain 0;
- maturity total_samples/trade_dates/oos_samples must remain 0;
- selected/robust modes must remain 0;
- OOS must remain locked;
- candidate calibration_ready must remain false;
- candidate evaluation run rows must remain 0;
- OOS release manifests must remain 0;
- promotion proposals must remain 0;
- activation reviews must remain 0;
- final release-pin manifests must remain 0.

This preserves the existing three-future-session maturity boundary and prevents same-day selection leakage.

## Control-plane invariant

Throughout first-day collection:

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null

## Current verification

Before the first prospective market window, the state-aware verifier returned:

stock-hunter-prospective-eod-quality-v416: PASS

The first real EOD verifier was executed after the deadline through the GitHub OIDC → Supabase read-only live gate and returned PASS. This is a live database pass, not a structural/pre-EOD-only result.

Repository verifier:

stock-hunter-v4/prospective-data/verify-first-day-eod-quality-v416.sql

## Next transition

At 18:25 Tehran on 2026-09-19, rerun the same verifier and report:

- Shadow sample count and mode split;
- Hunt event count and mode/state split;
- earliest/latest prediction timestamps;
- Shadow/Hunt same-day outcome counts;
- cron success/failure evidence;
- capture/outcome control timestamps and errors;
- same-day leakage checks;
- current maturity state.

No production mutation is authorized by this audit.


## Live EOD closure — 2026-09-19

Canonical live verifier result:

`stock-hunter-prospective-eod-quality-v416: PASS`

Execution evidence:
- GitHub workflow: `Stock Hunter Live First-Day EOD Check`;
- run id: `35465143770`;
- main commit: `5843b478ae9af3d583d5529a07cf966d89cfc348`;
- GitHub OIDC token issuance: PASS;
- exact repository/ref/workflow trust checks: PASS;
- verifier execution through Supabase Edge direct database connection: PASS;
- transaction mode: READ ONLY;
- bridge/workflow safety contract: PASS.

Therefore the official EOD verifier found no violation of its frozen invariants, including first-day provenance/outcome/cron/leakage/control-plane conditions.

No lifecycle mutation is authorized by this PASS. Calibration/OOS remains governed by the three-future-session maturity contract.
