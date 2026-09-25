# Stock Hunter Model Validation v4.5.4 — Canonical Trade Cache Index Repair

Date: 2026-09-25
Engine: `4.1.6-hunt-v2`

## Trigger
Real v4.5.3 run recovered the official daily reference successfully (`rows=2294`) but precheck returned `cache-found=0 parsed=0`.

This proves the remaining failure is TradeHistory cache discovery, not Hunt model quality.

## Canonical layout
Historical checkpoint records the real cache layout as:
`%LOCALAPPDATA%\\StockHunterHistorical\\cache\\trade\\20260923\\<InsCode>_grouped_true.json.gz`
with optional `_grouped_false.json.gz` fallback.

## v4.5.4 repair
- checks the exact canonical layout first;
- builds one bounded recursive index under TradeHistory cache roots;
- extracts long numeric InsCode tokens from both file names and directory paths;
- supports directory-per-symbol layouts and prior aliases;
- prints cache root/file/id counts and up to five real sample paths before replay;
- keeps TradeHistory and BestLimits strictly cache-only;
- reuses the already recovered daily reference;
- does not change Frozen Hunt formulas, thresholds, objectives, routing, or session logic.

Package: `Stock_Hunter_Model_Validation_Gate_v4.5.4.zip`
SHA-256: `b484cbe708a3f6e4f455d46ab3aff9b1ab58663a6c757c9ca84baa19554f9f64`

`go test ./...`: PASS
Windows amd64 build: PASS
ZIP integrity: PASS
