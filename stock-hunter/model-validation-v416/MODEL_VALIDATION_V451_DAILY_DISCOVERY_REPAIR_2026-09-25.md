# Stock Hunter Model Validation v4.5.1 — Daily Reference Discovery Repair

Date: 2026-09-25
Engine under test: `4.1.6-hunt-v2`
Historical diagnostic date: `2026-09-23`

## Reason for patch

The first real v4.5.0 execution passed all frozen-formula mechanical invariants, then reported:

`WARN bulk daily cache: ... cache\\bulk\\20260923.json.gz: The system cannot find the path specified.`

This is an evidence-location failure, not a Hunt-model failure.

## v4.5.1 change

Validation criteria are unchanged.

The validator now:
- checks the canonical daily-cache path first;
- performs bounded deterministic discovery under StockHunter historical roots;
- recognizes alternate daily/bulk JSON and JSON.GZ names/locations;
- validates candidate files by requiring parsable `insCode + priceYesterday` rows;
- detects gzip by magic bytes as well as filename suffix;
- performs no network requests;
- does not re-download TradeHistory or BestLimits.

A dedicated unit test confirms discovery works when the daily file is outside the canonical path.

## Package

`Stock_Hunter_Model_Validation_Gate_v4.5.1.zip`

SHA-256:
`0f61f1c39ff0af25ea5c57a44529593ce18cbbea9f522d89a9c8b900157ccbdd`

Local build tests: PASS.

## Interpretation

If v4.5.1 discovers a daily reference, the historical gross-error validation proceeds normally.

If it still cannot discover one, the correct result is evidence missing / historical data inadequate. That must not be interpreted as model failure and must not be repaired by fabricated previous-close or EOD substitutions.
