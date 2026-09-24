# Stock Hunter Model Validation v4.5.0 — Package Audit

Date: 2026-09-25  
Engine under test: `4.1.6-hunt-v2`  
Historical diagnostic date: `2026-09-23`

## Package

Artifact name:
`Stock_Hunter_Model_Validation_Gate_v4.5.0.zip`

SHA-256:
`7b63e48e6b9a9444740e0b11dc2e8928404c41f558deff86b9311ed983c43e3f`

The package contains a Windows x64 executable, one-click CMD, validation-gate document, README, source and unit tests.

## Behavior

- offline and network-free;
- reads `%LOCALAPPDATA%\\StockHunterHistorical` only;
- deterministic cache paths;
- does not rerun TradeHistory or BestLimits downloads;
- audits TradeHistory temporal completeness against cached official daily volume/value/OHLC/last;
- uses only point-in-time trades and forward-carried BestLimits at/before each replay timestamp;
- six 30-second polling phases: 0/5/10/15/20/25 seconds;
- Objective A/B reported separately;
- missing exact PIT inputs are never replaced with EOD/future/default values;
- conservative robust/possible envelopes are used where exact historical inputs are unavailable.

## Interpretation

This tool is deliberately a gross-error diagnostic, not an OOS/prospective proof. A clean historical result advances the project only to exact prospective shadow validation.

Infrastructure completion under `SHIKAR-CLOUD-IRAN-EGRESS-V1` is paused until this gate is evaluated.

## Execution

Run only:
`RUN_MODEL_VALIDATION_20260923.cmd`

Expected outputs:
- `model-validation-v450-output/model-validation.html`
- `model-validation-v450-output/model-validation.json`

Exit codes:
- 0 = historical diagnostic clean
- 5 = mechanical validation fail
- 6 = historical data inadequate
- 7 = historical gross error found
