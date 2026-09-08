# RC1.5-C.1 Runtime incident — 2026-09-08

## Symptom
Live Staging showed none of the C.1 enhancements: tax singleton/date-aware UX, Persian runtime guard, or custom report builder.

## Root cause
`tax-date-aware.js`, `custom-report-builder.js`, and `persian-runtime-guard.js` register handlers through `Lifecycle.use(...)`, but the deployed `src/ui/runtime/lifecycle.js` exposed only `emit`, `schedule`, and `stop`.

The modules were present and referenced from `index.html`, so syntax/build CI passed, but browser evaluation stopped at `Lifecycle.use is not a function`.

## Corrective actions
1. Restore a named lifecycle registry (`use/remove/run/snapshot`) while preserving `emit/schedule/stop` compatibility.
2. Make C.1 renderers idempotent to prevent mutation feedback loops.
3. Add a runtime-contract unit test for Lifecycle registration/execution/order/removal.
4. Include `rc15-c1-bootstrap.js` and all C.1 modules in CI syntax checks.
5. Do not mark C.1 Live PASS until user verifies the deployed Staging build.
