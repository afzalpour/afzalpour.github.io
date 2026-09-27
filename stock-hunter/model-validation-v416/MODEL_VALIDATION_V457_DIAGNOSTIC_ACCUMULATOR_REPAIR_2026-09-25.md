# Stock Hunter Model Validation v4.5.7 — Hard-Miss Diagnostic Accumulator Repair

Date: 2026-09-25
Engine: `4.1.6-hunt-v2`

## Trigger

Real v4.5.6 output correctly reduced the diagnostic universe but every persistent Hard-Miss with pre-cross observations still printed:
- `bestScoreHi=0`
- `bestTodayHi=0`
- `evidenceHi=0`
- `dynHi=0`
- `blocker=UNRESOLVED`

This pattern is incompatible with nonzero pre-cross observation counts and indicates diagnostic instrumentation failure, not model evidence.

## Root cause

In `diagnosePhaseBeforeCross`, the observation counter was incremented before `betterDiag` was called.

`betterDiag` treats `Obs==0` as the signal that the first observation must seed the best envelope. Because `Obs` had already been incremented, the first envelope was never seeded. The empty blocker list in the zero-valued best record then prevented later envelopes with real blockers from replacing it.

## v4.5.7 repair

- seed the first pre-cross envelope before incrementing/retaining the observation count;
- add a unit test that fails if the first observation is not captured;
- classify persistent events with zero pre-cross observations as `UNSCORABLE_EARLY_CROSS`;
- print counts of model-assessable vs unscorable persistent findings;
- preserve all Frozen Hunt formulas, thresholds, objectives and production routing;
- no TradeHistory or BestLimits redownload.

Package:
`Stock_Hunter_Model_Validation_Gate_v4.5.7.zip`

SHA-256:
`7f07aeea36b6f0d09f5d38135b0ad74d45af681475414b609dc536edb52ea6ca`

Verification:
- `go test ./...`: PASS
- dedicated first-observation diagnostic test: PASS
- Windows amd64 build: PASS
- ZIP integrity: PASS
