# Stock Hunter Eco Detail Fallback Audit — 2026-09-24

Status: READY FOR CI / PUBLIC SMOKE

## Client observation
Eco Bridge v4.0.8 starts normally and the public site opens quickly, but selecting some symbols from the complete Universe can show:
`نماد در فهرست بازار وجود دارد، اما در حال حاضر رکورد تحلیلی قابل بازیابی نیست.`

## Root cause
The complete Universe and the live MarketWatch feed are intentionally separate.
Two cases can therefore occur:
1. a live row exists but its feed identifier differs from the Universe `ins_code`; exact-ID matching misses it;
2. the symbol legitimately has no current live row (closed/halted/non-live at that moment), even though it exists in the full Universe.

## Repair
- Universe-to-live resolution now uses exact ID first and normalized symbol as a safe fallback.
- Symbol lookup is cached as a map and is not an O(Universe × LiveRows) loop.
- If no live analytical row exists, Detail no longer errors.
- Detail performs one on-demand daily-history request for only the selected symbol and renders historical/daily information plus the five display-only forecast scenarios.
- Intraday QI/OFI, Hunt Score, entry/stop and other live metrics are not fabricated in historical-only mode.
- Full live Detail remains unchanged when a genuine live analytical row exists.

## Resource safety
This repair does not change Eco Bridge scan cadence:
- MarketWatch bulk: 30 seconds;
- ClientType bulk: 120 seconds;
- full Universe: cached / at most daily.
No hot-symbol loop or whole-market per-symbol fan-out is reintroduced.

## Frozen-model safety
No 4.1.6 Hunt formula, threshold, model weight, routing rule, lifecycle state, OOS gate, or challenger activation state changes.
