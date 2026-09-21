# Stock Hunter — Shadow Sample Quality Quarantine

DATE: 2026-09-21
STATUS: LIVE_APPLIED / NON_DESTRUCTIVE / CALIBRATION_EXCLUSION_ACTIVE

## Purpose

Prevent known pre-v7 stale/mixed prospective Shadow Samples from ever entering Calibration, while preserving the original rows and their outcome history as audit evidence.

## Incident cohorts

Two pre-v7 capture bursts are quarantined:

1. 2026-09-21 06:15:06 UTC
   - 146 Shadow Samples
   - sample IDs 1280..1425
   - all 146 were independently proven older than the canonical 180-second source freshness limit
   - reason code: `PROVEN_STALE_OVER_180_ALL_ROWS`

2. 2026-09-21 07:34:39 UTC
   - 292 Shadow Samples
   - sample IDs 2448..2739
   - 74 of 292 were independently proven older than 180 seconds
   - the exact 74 IDs were not durably recorded before the source rows later refreshed
   - therefore the complete capture burst is conservatively quarantined
   - reason code: `MIXED_PRE_FIX_CAPTURE_CONSERVATIVE_QUARANTINE`

Total quarantine cardinality: **438**.

No Shadow Sample row was deleted, overwritten, fabricated or backfilled.

## Live implementation

Created:
- `public.stock_hunter_shadow_sample_exclusions_v416`
- primary key: `sample_id`
- immutable after insert via trigger
- RLS enabled
- read-only to anon/authenticated/service_role
- no insert/update/delete grant to browser roles

Calibration contract:
- `public.stock_hunter_calibration_dataset_v416` remains `security_invoker=true`
- its mature/live prospective branch excludes any sample present in the quarantine ledger
- the OOS frozen snapshot branch is unchanged
- current frozen OOS rows = 0, so the exclusion is effective before any one-shot OOS release

Live verification immediately after DDL:
- quarantine total = 438
- proven-all-stale = 146
- mixed conservative = 292
- quarantined rows leaking into Calibration = 0
- live view definition contains the exclusion predicate

## Maturity contract

Updated repository verifiers:
- `verify-first-maturity-horizon-v416.sql`
- `verify-rolling-maturity-watch-v416.sql`

Both explicitly reject any quarantined sample in Calibration.

The 2026-09-22 first maturity verifier is for the 2026-09-19 cohort only. Therefore this 2026-09-21 quarantine does not remove or manufacture first-cohort evidence; it protects later maturity/calibration windows.

## Verification note

Direct execution of the two full verifier SQL files immediately after quarantine hit a PostgreSQL connection timeout. This is classified as infrastructure/data-plane availability, not verifier failure. The live quarantine cardinality and zero-leak assertions had already completed successfully in the same DDL transaction and were re-read successfully afterward.

No lifecycle state was advanced.

## Safety

Unchanged:
- production Champion: 4.1.6
- engine: `4.1.6-hunt-v2`
- routing: `CHAMPION_ONLY`
- challenger traffic: 0%
- kill switch: ON
- state_version: 1
- 4.1.7 capture remains dark
- no OOS release, Promotion, Activation Review or final release freeze
