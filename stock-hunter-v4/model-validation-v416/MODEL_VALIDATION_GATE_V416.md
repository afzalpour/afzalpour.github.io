# Stock Hunter 4.1.6 — Model Validation Gate

Status: FROZEN VALIDATION ORDER / BEFORE PRODUCTION CUTOVER  
Engine: `4.1.6-hunt-v2`  
Objectives: A = negative -> zero/positive same session; B = 0..+1% -> cross +1% same session.

## Why this gate exists

Infrastructure correctness cannot establish predictive correctness. Cloud deployment, mobile delivery and storage work are not allowed to substitute for validation of the Hunt model itself.

## Order

1. **G0 — Formula identity / mechanical correctness**
   - Frozen browser/cloud parity must remain exact.
   - Score components remain bounded and monotonic in their documented directions.
   - Threshold hierarchy and gate semantics remain frozen.
2. **G1 — Point-in-time evidence quality**
   - no future data at prediction timestamp;
   - BestLimits is forward-carry only;
   - incomplete five-level snapshots are quarantined;
   - TradeHistory completeness is measured against official same-day volume/value/OHLC/last before using temporal volume features;
   - EOD ClientType is never substituted for intraday `realFlow`.
3. **G2 — Historical gross-error diagnostic (2026-09-23)**
   - replay uses 30-second grids with six polling phases: 0, 5, 10, 15, 20, 25 seconds;
   - Objective A/B are reported separately;
   - future crossing labels are outcomes only, never pre-event features;
   - exact Hunt results are emitted only where all required PIT inputs are proven;
   - otherwise only conservative robust/possible envelopes are allowed;
   - report Robust TP, Robust FP, Hard Miss, Ambiguous Event and lead time.
4. **G3 — Exact prospective shadow validation**
   - required because historical intraday `realFlow` and some integrated PIT inputs are not proven historically;
   - capture exact production inputs in real time with the Frozen engine unchanged;
   - compare outcome rate of Hunt candidates with the eligible-pool base rate;
   - no parameter/threshold optimization is allowed on the evaluation cohort.
5. **G4 — Production readiness decision**
   - production cloud source cutover stays blocked if G0/G1 fail;
   - a historical Hard-Miss/Robust-FP pattern indicating a structural defect must be investigated before infrastructure rollout resumes;
   - predictive readiness requires prospective evidence, not a single historical day.

## Pre-registered interpretation

The 2026-09-23 historical run is a **gross-error diagnostic**, not prospective/OOS proof.

- `MECHANICAL_VALIDATION_FAIL`: stop; formula implementation/invariants are wrong.
- `HISTORICAL_DATA_INADEQUATE`: stop historical inference; collect a better PIT source rather than fabricating inputs.
- `HISTORICAL_GROSS_ERROR_FOUND`: stop production work; investigate phase-consistent hard misses/robust false positives and formula/input provenance.
- `HISTORICAL_DIAGNOSTIC_CLEAN`: proceed to prospective shadow validation, not directly to production cutover.
- `PROSPECTIVE_VALIDATION_PASS`: only after exact forward-captured inputs and outcomes support positive lift over the eligible-pool base rate with adequate sample size.

## Frozen non-negotiables

- No threshold tuning from this historical date.
- No synthetic/backfilled prospective evidence.
- No EOD ClientType leakage.
- No future BestLimits or trade data in pre-event features.
- No silently forcing `integrated_eligible=false` or defaulting integrated fields to zero for an exact-parity claim.
- No production Hunt cutover merely because infrastructure is ready.
