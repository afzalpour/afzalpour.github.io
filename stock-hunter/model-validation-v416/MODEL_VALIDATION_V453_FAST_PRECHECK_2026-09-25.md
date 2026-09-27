# Stock Hunter Model Validation v4.5.3 — Fast Evidence Precheck

Date: 2026-09-25

Trigger: the real v4.5.1 run spent time on the full replay even though evidence readers returned `TradeParsed=0` and `DailyReference=0`.

v4.5.3 keeps all frozen validation criteria unchanged and adds a fast precheck before the heavy replay:
- recover/validate daily reference first;
- test up to 60 resolved eligible TradeHistory caches;
- print `PRECHECK TradeHistory: tried=... cache-found=... parsed=...`;
- if cache path/schema is still unreadable, exit 6 immediately without starting the full replay.

It also includes the v4.5.2 repairs:
- canonical historical cache naming `trade_<InsCode>_<true|false>.json.gz`;
- `bulk_daily.json(.gz)` discovery;
- exactly one official daily-reference recovery request when missing;
- no TradeHistory or BestLimits re-download.

Package SHA-256:
`1ba10a6bdd487671cbcfed8270ce95d52dcf6b9bff04bff92d3a745e5844a88c`

`go test ./...`: PASS
Windows amd64 build: PASS
ZIP integrity: PASS
