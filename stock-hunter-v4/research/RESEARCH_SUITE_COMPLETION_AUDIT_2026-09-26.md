# Research Suite Completion Audit — 2026-09-26

Scope: completion of the previously partial Stock Hunter research/validation features without changing Frozen Hunt Engine 4.1.6 scoring formulas or lifecycle gates.

## Completed

1. Backtest Lab
   - exact journey-level precision/failure calculation when detailed events are available
   - zero / +1 / +2 / +3 outcomes
   - median MFE / MAE
   - median time-to-zero and time-to-+1
   - D+1 positive close
   - breakdowns by hour, market, liquidity and market regime
   - Jalali date inputs and bounded retention summary

2. Market Replay
   - compact 30-second replay is the preferred resolution whenever available
   - legacy 5-minute rows remain fallback only
   - hunt milestones are overlaid on replay
   - direct symbol/date deep links are supported

3. Alert Center
   - three user-facing levels: early hunt, special hunt, successful crossing
   - distinct sounds per level
   - Service Worker notification display
   - event-key de-duplication until state/event actually changes
   - Persian/Jalali event presentation

4. Symbol detail timeline
   - Hunt timeline is injected into the main symbol detail dialog
   - first detection, early hunt, active hunt, zero, +1, +2, +3 are shown
   - replay chart uses the best available resolution
   - MFE/MAE, same-day close and D+1 are shown
   - direct links open the exact Hunt Journey and Market Replay context

5. No-code Strategy Builder
   - condition builder without changing Frozen Hunt Engine
   - live scan and historical test use the same user-defined rule set
   - ALL (AND) and ANY (OR) rule matching
   - local persistence and authenticated cloud persistence
   - optional match alerts
   - database constraint updated to allow ALL / ANY

## Live-data verification

- backtest slices are populated for all four slice types: hour, market, liquidity and regime
- 30-second market replay rows exist in production
- hunt journeys are populated and include zero / +1 outcomes
- strategy persistence table exists with RLS and per-user ownership policies
- research retention includes BACKTEST_SLICES and MARKET_REPLAY_30SEC

## Invariants

- Frozen Hunt scoring remains 4.1.6-hunt-v2.
- User strategies are a research/scan layer and do not mutate engine weights or thresholds.
- Dates shown in these research surfaces remain Jalali.
- UI remains Persian-first.
