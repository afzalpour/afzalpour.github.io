# Stock Hunter Model Validation v4.5.5 — Ledger-first Trade Cache Locator

Date: 2026-09-25
Engine: `4.1.6-hunt-v2`

## Trigger
Real v4.5.4 run:
- mechanical checks PASS;
- official daily reference valid (`2294` rows);
- Trade cache index `roots=0 files=0 ids=0`;
- precheck `cache-found=0 parsed=0`.

This is still an evidence-location failure, not a Hunt-model result.

## v4.5.5
- reads the real historical ledger first;
- uses `cache_file` / cache-path fields when present;
- resolves moved basenames under StockHunterHistorical;
- falls back to a bounded read-only scan of StockHunter roots;
- prints ledger refs, existing cache refs, scanned-file counts, sample paths and state-root inventory on failure;
- does not redownload TradeHistory or BestLimits;
- reuses the validated 2294-row daily reference;
- leaves Frozen Hunt 4.1.6 unchanged.

Package: `Stock_Hunter_Model_Validation_Gate_v4.5.5.zip`
SHA-256: `39cdedc894b1003311b4e603d252674a6c4b6b3d55839dda8e96cf9b49f66f27`

`go test ./...`: PASS
Windows amd64 build: PASS
ZIP integrity: PASS
