# Stock Hunter Model Validation v4.5.2 — Trade Cache + Daily Reference Repair

Date: 2026-09-25
Engine: `4.1.6-hunt-v2`

## Trigger
Real v4.5.1 run produced:
- all mechanical invariants PASS;
- `BestLimits=948`;
- `TradeParsed=0`;
- `DailyReference=0`;
- all 1316 ground-truth events therefore ambiguous;
- verdict `HISTORICAL_DATA_INADEQUATE`.

This output is an evidence-reader failure, not a model-quality result.

## Root cause
Static inspection of the canonical Historical Cache/Resume v4.2.1 executable recovered cache naming strings:
- `trade_%s_%s.json.gz`;
- `bulk_daily.json.gz`.

v4.5.1 did not prioritize those exact names.

## v4.5.2
- accepts `trade_<InsCode>_<true|false>.json.gz` plus previous aliases;
- accepts canonical `bulk_daily.json(.gz)` names;
- validates the canonical TradeHistory JSON schema (`hEven`, `pTran`, `qTitTran`);
- if daily reference is truly missing, performs exactly one request to `ClosingPrice/GetInstrmentsHistoryInDay/20260923`, validates it, compresses it, and reuses it;
- TradeHistory and BestLimits remain cache-only and are never re-downloaded;
- prints `Evidence status:` counts so path/schema failures are explicit.

Package: `Stock_Hunter_Model_Validation_Gate_v4.5.2.zip`
SHA-256: `dcd0ae9e844fc6bf098a7b59f60f6a0bc83d3d70356cb656b2e2420f2d7a2f99`

Local `go test ./...`: PASS.
Windows amd64 build: PASS.
ZIP integrity: PASS.

Frozen Hunt 4.1.6 formulas/thresholds/objectives remain unchanged.
