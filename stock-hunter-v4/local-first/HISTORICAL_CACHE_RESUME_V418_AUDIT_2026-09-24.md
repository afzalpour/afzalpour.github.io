# Stock Hunter Historical Cache/Resume v4.1.8

Date: 2026-09-24
Status: READY FOR WINDOWS CLIENT CONTINUATION

## Trigger
The first historical objective run for 2026-09-23 completed 300 trade-history requests:
- daily rows: 2294
- shortlist: 957
- success: 211
- failed: 89
- objective events: 208 reversal + 199 acceleration
- decoded payload: 42,702,776 bytes

The next step is to complete coverage without re-downloading known successful work.

## Repair
v4.1.8 adds a persistent cache and resumable ledger under:
`%LOCALAPPDATA%\StockHunterHistorical`

A bootstrap file derived from the prior real report imports:
- the prior 300 attempted slots;
- all 407 recorded objective events;
- 209 event-bearing symbols as already covered;
- 25 explicitly listed prior HTTP-500 failures.

This leaves 91 unresolved symbols in the first 300 for targeted retry (89 prior failures plus the two prior successes that produced no objective event and cannot be distinguished from the truncated failure list).

## Commands
- `RUN_CONTINUE_20260923.cmd`: continue after the prior 300, batch size 75.
- `RUN_NEXT_BATCH_20260923.cmd`: repeatable next batch; ledger/cache prevent re-fetch of resolved symbols.
- `RETRY_UNRESOLVED_FIRST300_20260923.cmd`: targeted retry of unresolved first-300 items, batch size 40.
- `STATUS_20260923.cmd`: local-only status, no network.
- `CHECK_PACKAGE.cmd`: self-test.

## Network controls
- one request at a time;
- 8s per-request timeout;
- 240s trade-stage wall-clock budget;
- fail-fast after repeated failures;
- gzip raw-response cache;
- primary TradeHistory grouped=true;
- HTTP 500 gets one fallback attempt using grouped=false.

## Methodology safety
This tool completes historical Ground Truth for Objective A/B only.
It does not reconstruct the full point-in-time Hunt Score.

ClientTypeHistory for a date is day-level context and is not injected into point-in-time Hunt scoring because doing so would introduce look-ahead.
Historical BestLimits is a delta feed and is deferred to a separate stateful carry-forward reconstruction step after TradeHistory coverage is sufficiently complete.

No production 4.1.6 Hunt formula, threshold, routing, lifecycle, OOS gate or challenger state is changed.

## Verification
- go test ./...: PASS
- go vet ./...: PASS
- selftest: PASS
- Windows amd64 PE build: PASS
- ZIP integrity: PASS

ZIP SHA-256:
`d4914650bf8c46d94279b33c2e568e8622fa59c006c509789724345614f8635b`

Executable SHA-256:
`4051a5914a9b0bcdffe36d0c1a6d8ea886d31c361ce074aabfef53860b56cd8f`

Bootstrap SHA-256:
`2907a7e0364af539b5a6862f79c606065b865a0a7dbed31f2083949ecf35cd69`
