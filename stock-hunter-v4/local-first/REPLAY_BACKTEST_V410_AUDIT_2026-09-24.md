# Stock Hunter Replay Backtest v4.1.0 — Diagnostic Replay Audit

Date: 2026-09-24
Status: READY FOR WINDOWS CLIENT RUN

## Purpose
Run a diagnostic replay without waiting for the next market session, using only genuine point-in-time snapshots already stored on the user's Windows machine.

## Data discovery
The tool scans:
- %LOCALAPPDATA%\StockHunterLocalBridge\archive
- %LOCALAPPDATA%\StockHunterLocalBridge\latest.json
- %LOCALAPPDATA%\StockHunterEco\archive
- %LOCALAPPDATA%\StockHunterReplay\archive

It never fabricates missing intraday snapshots.

## Quality levels
- DIAGNOSTIC_REPLAY_OK: multiple point-in-time snapshots with useful span.
- LIMITED: some replayable data, but weak temporal coverage.
- INSUFFICIENT_SINGLE_POINT: only one point-in-time snapshot.
- NO_DATA: no usable point-in-time archive found.

## Scope
Replay evaluates the frozen 4.1.6 Hunt logic for reversal / acceleration candidates and records first signal, state, score, later maximum day change, and diagnostic same-day completion:
- reversal: later reaches >= 0%;
- acceleration: later reaches >= +1%.

These are diagnostic replay outcomes only. They do not replace OOS/prospective validation or lift-vs-control.

## Recorder
The package includes a 15-minute local recorder. It reads only 127.0.0.1 and writes gzip point-in-time snapshots under %LOCALAPPDATA%\StockHunterReplay\archive. It makes no external TSETMC or Supabase request itself and skips recording when Live rows=0.

## Verification
- Go test: PASS
- Go vet: PASS
- built-in selftest: PASS
- synthetic four-point replay: PASS; one reversal candidate correctly completes after crossing zero
- Windows amd64 PE build: PASS

Executable SHA-256:
`bc6abf7057545cdc4985c42e4baab416c4b80f8b2ecee07b2e6d87fcad4b23f6`

Delivery ZIP SHA-256:
`b3077fe1ef4f4b5353576a5f595bc715938b55e1d06d5baae8a616b13af14da5`

## Frozen-model safety
No production Hunt formula, threshold, routing, lifecycle state, OOS gate, or challenger activation state is changed by this diagnostic package.
