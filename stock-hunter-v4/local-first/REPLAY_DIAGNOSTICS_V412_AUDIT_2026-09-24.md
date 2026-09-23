# Stock Hunter Replay Diagnostics v4.1.2 — Backtester Quality Repair

Date: 2026-09-24
Status: READY FOR WINDOWS CLIENT RUN

## Trigger
The first real local replay reported:
- date: 2026-09-23
- archives: 4
- distinct times: 3
- unique symbols: 523
- candidates: 0
- quality: DIAGNOSTIC_REPLAY_OK

That quality label was insufficiently strict because v4.1.0/v4.1.1 only considered distinct snapshot count and temporal span. It did not require any archive to be inside a market window, any Delta-ready observation, or any Huntable row.

## Repair
v4.1.2 adds:
- exact archive timestamps in Asia/Tehran;
- in-session vs off-hours archive counts;
- row-observation count;
- valid price/volume count;
- Delta-ready count;
- Huntable count;
- reversal / acceleration / outside observation counts;
- Huntability rejection distribution;
- Hunt gate distribution.

Quality can now return:
- OFF_HOURS_ONLY;
- NO_VALID_PRICE_VOLUME;
- NO_DELTA_READY_ROWS;
- NO_HUNTABLE_ROWS;
- INSUFFICIENT_SINGLE_POINT;
- LIMITED;
- DIAGNOSTIC_REPLAY_OK.

Zero candidates is considered interpretable only when the replay has actual in-session, Delta-ready and Huntable observations.

## Verification
- go test ./...: PASS
- go vet ./...: PASS
- selftest: PASS
- synthetic 4-point replay: DIAGNOSTIC_REPLAY_OK, 4 in-session archives, 4 Delta-ready, 4 Huntable, one reversal candidate completed after crossing zero
- Windows amd64 PE build: PASS

Package SHA-256:
`77fa9a628bd34cce77cfe3515fbe684d53f79473421ee86ff2d8580e4f08e6f0`

Executable SHA-256:
`668577f0a030a085ac7e84b068af7b6ffa88b67fc3c7c9826f1d8506bf2545e3`

No production Hunt formula, threshold, routing, lifecycle or OOS state is changed.
