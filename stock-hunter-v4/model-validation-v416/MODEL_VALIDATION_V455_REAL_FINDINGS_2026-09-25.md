# Stock Hunter 4.1.6 — v4.5.5 Real Historical Validation Findings

Date: 2026-09-25
Historical day: 2026-09-23
Engine: `4.1.6-hunt-v2`

## What is proven
- All mechanical invariants PASS.
- Official daily reference is valid and contains 2294 rows.
- BestLimits coverage is 948/948 eligible symbols.
- TradeHistory cache discovery/parser works on real cached files.
- Ground-truth events remain 682 reversal + 634 acceleration = 1316.

## Historical evidence coverage
- eligible = 948
- BestLimits = 948
- TradeParsed = 684
- DailyReference = 684
- temporal-reliable = 114
- temporal-unreliable = 570
- TRADE_CACHE_NOT_FOUND = 209
- TRADE_PARSE_FAIL = 55

The counts 209 and 55 align with prior historical-cache history:
- 209 bootstrap-covered event-bearing symbols from the original first-300 import did not necessarily retain raw TradeHistory response files;
- final terminal NO_TRADES count was 55.

Therefore these counts are not evidence of Hunt-model failure.

## Signal envelope result
For every 30-second polling phase (0/5/10/15/20/25s):
- robustTP = 0
- robustFP = 0
- robustSignals = 0
- hundreds of `possibleSignals` remain;
- about 17–22 per-objective per-phase `hardMiss` cases appear;
- the remainder are ambiguous because required PIT inputs are not fully historically proven.

Zero robust signals must not be interpreted as zero predictive ability. The historical envelope is too wide because exact intraday realFlow and some integrated/market-context inputs are not historically proven.

## Current verdict
`HISTORICAL_DATA_INADEQUATE` is accepted as an evidence-quality verdict only.

It is NOT a verdict that Frozen Hunt 4.1.6 is good or bad.

## Mandatory next scientific work
Before production infrastructure resumes:
1. explain why 570 parsed TradeHistory symbols fail temporal reliability, by failure reason and mismatch distribution;
2. compute phase-consistent Hard Miss intersection across all six polling phases, not phase-local counts;
3. inspect each persistent Hard Miss's binding gate/component (dynamic readiness, evidence count, feasibility, risk, asset gate, session, threshold score);
4. do not change thresholds based on the 2026-09-23 diagnostic;
5. after historical gross-error audit, run exact prospective shadow validation because historical realFlow/integrated inputs are not fully recoverable PIT.

Production cutover remains blocked.
