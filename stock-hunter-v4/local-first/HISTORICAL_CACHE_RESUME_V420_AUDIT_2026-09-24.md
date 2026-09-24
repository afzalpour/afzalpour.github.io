# Stock Hunter Historical Cache/Resume v4.2.0

Date: 2026-09-24
Status: READY FOR WINDOWS RETRY CLASSIFICATION

## Trigger
After fresh coverage completed, retry-post selected 15 unresolved post-300 symbols. The first seven all returned `empty trade history`, causing the generic seven-failure fail-fast to stop before the remaining eight symbols were checked.

Current ledger before v4.2.0:
- shortlist: 957
- event-covered: 851
- failed-known: 40
- legacy unresolved: 66
- unresolved first 300: 91
- accumulated events: 633 reversal + 586 acceleration
- total unresolved: 106 = 15 post-300 + 91 first-300.

## Defect
v4.1.9 treated an empty TradeHistory response as a transient failure. That caused:
- terminal no-trade instruments to be retried repeatedly;
- terminal empty responses to count toward fail-fast;
- later retry candidates to be starved.

## Repair
v4.2.0 introduces explicit terminal `no_trades` state:
- both `grouped=true` and `grouped=false` TradeHistory variants must be empty before `NO_TRADES` is recorded;
- timeout/network/HTTP errors remain retryable failures;
- `NO_TRADES` is considered resolved coverage but is not counted as event-covered;
- `NO_TRADES` resets the transient-failure streak and never triggers fail-fast;
- fail-fast now counts only seven consecutive transient/network failures.

Persistent ledger/cache remains:
`%LOCALAPPDATA%\StockHunterHistorical`

Recommended sequence:
1. RETRY_FAILED_POST300_20260923.cmd
2. STATUS_20260923.cmd
3. then RETRY_UNRESOLVED_FIRST300_20260923.cmd in controlled batches.

No production 4.1.6 Hunt formula, threshold, routing, lifecycle, OOS gate or challenger state is changed.

## Verification
- go test ./...: PASS
- go vet ./...: PASS
- selftest: PASS
- Windows amd64 PE build: PASS
- ZIP integrity: PASS
- CMD launchers: ASCII + CRLF

ZIP SHA-256:
`ffd17fde9658faef1562cc828421bee302e3a2df478fa6b10d4c8e5b42c83d22`

Executable SHA-256:
`19e14761146724f85fb35da986e7269f78ee125e0fe029fda152e09c8b204c39`
