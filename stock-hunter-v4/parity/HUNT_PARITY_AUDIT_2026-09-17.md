# Stock Hunter 4.1.6 — Browser ↔ Backend Hunt Parity Audit

AUDIT_DATE: 2026-09-17
PROTOCOL: 4.1.6-browser-server-parity-v1
ENGINE: 4.1.6-hunt-v2
FIXED_NOW: 2026-09-16T07:00:00.000Z
FIXTURE_COUNT: 9
PROOF_SCOPE: FROZEN_FIXTURES_NOT_EXHAUSTIVE

## What is compared

The browser side executes the production `app-session-v413.js` and `app-hunt-v416.js` in an isolated Node VM with a frozen clock and deterministic market snapshots. The backend side is the deployed `stock-hunter-capture-v416?parity=1` Edge Function. CI requires `assert.deepStrictEqual(server, browser)` over the complete parity payload.

For captured Hunt rows the payload covers: capture eligibility, hunt mode, today-opportunity score, Hunt score, Hunt state, gate, evidence count, dynamic evidence count, order pressure, impulse, feasibility, flow/volume, market context and continuation. Non-captured fixtures are also compared exactly.

## Frozen fixtures

- 101 — baseline negative day-change / Reversal path with fresh snapshot activity.
- 102 — positive sub-1% day-change / Acceleration path.
- 103 — single snapshot plus recent candle trade evidence.
- 104 — high-risk guard input.
- 105 — stock-option asset classification guard input.
- 106 — candle-only recent trade evidence with flat snapshot volume.
- 107 — stale trade evidence but recent order-book movement.
- 108 — millisecond snapshot timestamps; must normalize to seconds.
- 109 — stale frozen tape with no recent book movement; must remain non-huntable.

## Defect closed by this audit

`app-session-v413.js` previously interpreted millisecond timestamps as seconds in trade-date and freshness checks. `sessionTsSecV413()` now normalizes timestamps above 1e12 before Tehran-date and recency calculations, matching the deployed capture backend behavior.

## Evidence

A prior independent deployment check on 2026-09-17 (GitHub Actions run 35226494331, job `parity`) completed successfully, including the step `Compare browser fixtures with deployed capture backend`. The current branch carries the same independent comparison forward and pins the fixture count/protocol in CI.

## Interpretation

PASS means the production browser implementation and the deployed capture backend produce exactly the same serialized result for these nine deterministic fixtures. It does not claim mathematical equivalence over every possible market input. Any change to session filtering, Hunt scoring, fixture protocol or backend parity output must re-run this CI gate before calibration/telemetry results are trusted.
