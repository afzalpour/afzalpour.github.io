# Stock Hunter Frozen Hunt 4.1.6 — Prospective Effectiveness Tracking Audit

Date: 2026-09-25  
Status: LIVE_DEPLOYED / ROLLBACK_PROBE_PASS / PROSPECTIVE_START_2026-09-26

## Objective

Validate the primary Frozen Hunt 4.1.6 model, not the five supplementary technical forecast models.

The system now measures, for each real Hunt alert:

- whether a negative Reversal crosses 0% later the same day;
- whether it reaches +1%, +2% or +3%;
- whether it reaches/finishes in a canonical buy queue;
- the equivalent D+1 outcomes on the next observed market session;
- MFE/MAE from the original alert price;
- Action Now (شکار ویژه / هشدار فوری) separately from Radar (شکار زودهنگام).

No Frozen Hunt formula, threshold, state or production routing rule changed.

## Prospective boundary

The permanent D+1 tracker starts on 2026-09-26.

Older events are deliberately not relabeled with later snapshots. This prevents a missing historical session from being mistaken for D+1.

Historical pre-start data remain usable only for their already-recorded same-day/outcome evidence. No synthetic queue or D+1 backfill is introduced.

## Live objects

### Control
public.stock_hunter_hunt_effectiveness_control_v416

- prospective start date: 2026-09-26
- narrow tape retention: 30 days
- operational capture/refresh status

### Narrow market tape
public.stock_hunter_hunt_market_tape_v416

Captured only for symbols that have a real Action Now or Radar Hunt alert in the prospective window.

Fields include:
- last/close/yesterday prices;
- daily low/high;
- min/max allowed;
- best bid/ask;
- canonical buy_queue / sell_queue;
- source freshness timestamp.

The tape is bounded to 30 days. Permanent alert outcomes are stored separately.

### Permanent effectiveness ledger
public.stock_hunter_hunt_effectiveness_v416

One deduplicated row per channel + trade_date + symbol.

Action Now uses the first actual event for the symbol/day.
Radar uses the first non-quarantined شکار زودهنگام shadow sample.

Permanent outcomes include:
- same-day crossed zero;
- same-day hit +1/+2/+3;
- same-day mode target reached/closed;
- same-day buy queue any/close and queue snapshot share;
- D+1 observed session date;
- D+1 positive close;
- D+1 hit +1/+2/+3;
- D+1 buy queue any/close and queue snapshot share;
- D+1 return/MFE/MAE from alert.

### Aggregate view
public.stock_hunter_hunt_effectiveness_summary_v416

Reports denominators explicitly. Missing/unmatured D+1 data are not counted as failures.

## D+1 definition

D+1 is the next observed prospective tape session after the alert trade date.

This avoids hard-coding calendar dates and therefore does not silently reinterpret Thursday/Friday or exchange holidays as trading sessions.

If no next observed session exists yet, the alert remains unmatured.

## Canonical buy-queue definition

The tracker persists the production feed's existing buy_queue field.

That field is generated when level-1 best bid is approximately the daily max_allowed price and positive bid quantity exists.

The effectiveness layer does not invent a price-change proxy for a queue.

## Scheduling

Tape capture:
- stock-hunter-hunt-tape-v416-open — 30-59 5 * * 0-3,6
- stock-hunter-hunt-tape-v416-mid — * 6-8 * * 0-3,6
- stock-hunter-hunt-tape-v416-close — 0-30 9 * * 0-3,6

Refresh:
- stock-hunter-hunt-effectiveness-v416-close-a — 35 9 * * 0-3,6
- stock-hunter-hunt-effectiveness-v416-close-b — 25 14 * * 0-3,6

All schedules are database cron jobs. The capture function also has a Tehran-time/session guard and per-row freshness requirement.

## Verification

### Rollback-only functional probe

A synthetic Reversal alert was created inside one transaction:

- alert price 99 vs reference 100 (-1%);
- same-day tape reached 101;
- D+1 tape reached 103;
- D+1 best bid=max allowed and buy_queue>0.

Assertions passed:
- same-day crossed zero;
- mode target reached;
- D+1 session resolved correctly;
- D+1 observed;
- D+1 +1 reached;
- D+1 positive close;
- D+1 buy queue detected both any-time and close.

The transaction was rolled back. Residue check:
- probe events: 0
- probe tape rows: 0
- probe effectiveness rows: 0

### Closed-market behavior

On Friday 2026-09-25, direct tape capture returned no live tape rows. No synthetic data were created.

## Security

All three new public tables have RLS enabled.

anon and authenticated have no table grants.

The two mutation functions live in the non-exposed private schema, run as SECURITY INVOKER, use an empty search path, and public/authenticated execution is revoked.

Supabase Security Advisor after deployment reported the new tables only as INFO RLS Enabled No Policy, which is intentional fail-closed behavior because these are internal operational ledgers. No public policy is required.

The unrelated existing project warning for hosted leaked-password protection remains unchanged.

## Historical R2 limitation

A real R2 replay harness was added separately, but production R2 credentials are no longer available to the current GitHub environment. Therefore no historical D+1 queue evidence was fabricated.

This prospective tracker is the canonical path for accumulating trustworthy primary-model evidence from 2026-09-26 onward.
