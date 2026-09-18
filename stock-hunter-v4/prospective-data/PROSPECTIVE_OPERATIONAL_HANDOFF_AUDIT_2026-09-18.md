# Stock Hunter Prospective Operational Handoff

AUDIT_DATE: 2026-09-18
STATUS: LIVE_OPERATIONAL_HANDOFF_PASS / FIRST_REAL_MARKET_WINDOW_PENDING
TARGET_PROJECT: summnepwuziwulzvpcms
NEXT_REAL_EVENT_UTC: 2026-09-19T05:30:00Z
NEXT_REAL_EVENT_TEHRAN: 2026-09-19 09:00

## Current live clock and state

Live database clock during this handoff:

- UTC: 2026-09-18 14:09+
- Tehran: 2026-09-18 17:39+
- prospective_start_at: 2026-09-19 05:30:00+00
- Tehran prospective start: 2026-09-19 09:00

Current prospective state:

ARMED_AWAITING_FIRST_MARKET_WINDOW

Current maturity state:

COLLECTING

Current counts:

- raw prospective Shadow samples = 0
- mature Calibration samples = 0
- mature reversal = 0
- mature acceleration = 0
- mature OOS = 0
- mature trade dates = 0
- candidate evaluation runs = 0
- OOS release manifests = 0
- Promotion Proposals = 0
- Activation Reviews = 0
- final release manifests = 0

No synthetic data was created.

## Scheduler readiness

The pg_cron scheduler backend is alive.

The three active capture phases remain:

- stock-hunter-capture-v416-open
  - 30-59 5 * * 0-3,6
- stock-hunter-capture-v416-mid
  - * 6-12 * * 0-3,6
- stock-hunter-capture-v416-close
  - 0-30 13 * * 0-3,6

Friday 2026-09-18 is excluded by the trading schedule.

Therefore the empty current cron run history is expected.

The first eligible invocation is Saturday 2026-09-19 at 05:30 UTC / 09:00 Tehran, exactly equal to the frozen prospective_start_at.

## Dark v417 isolation

stock-hunter-capture-v417 is deployed and ACTIVE, but remains dark.

The prospective launch verifier now additionally requires:

- exactly three active Stock Hunter capture HTTP cron callers;
- all three are the frozen v416 prospective capture jobs;
- zero active cron callers reference stock-hunter-capture-v417.

Current live result:

- active v417 capture callers = 0

This prevents dark deployment from silently changing the empirical prospective collection protocol.

## Vault / authentication path

The launch verifier continues to require the active v416 cron commands to:

- resolve project URL from Vault;
- resolve the custom capture token from Vault;
- send X-Stock-Hunter-Capture-Token;
- target stock-hunter-capture-v416.

Vault secret values are never exported into the repository.

The v417 dark deployment does not participate in prospective capture.

## Calibration/OOS lock

Current Calibration policy remains:

- total mature samples >= 120
- reversal >= 40
- acceleration >= 40
- OOS >= 30
- trade dates >= 20
- train/validation/OOS = 60/20/20
- auto_promote = false

Current live Calibration readiness:

- calibration_ready = false
- reason = نمونه بالغ ۳ جلسه‌ای کافی نیست

Current OOS readiness:

- can_unlock_oos = false
- oos_unlocked = false
- auto_unlock_oos = false

Current OOS integrity:

LOCKED_AWAITING_MATURITY

No downstream lifecycle state has advanced.

## Control-plane safety

Production remains:

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null
- champion = 4.1.6-hunt-v2

The 4.1.7 capture Edge Function is dark and does not alter this state.

## Live verifier results

Updated launch preflight:

stock-hunter-prospective-launch-preflight-v416: PASS

Rolling maturity watch:

stock-hunter-rolling-maturity-watch-v416: PASS

First-day EOD verifier, pre-EOD structural mode:

stock-hunter-prospective-eod-quality-v416: PASS

First maturity-horizon verifier, pre-horizon structural mode:

stock-hunter-first-maturity-horizon-v416: PASS

These PASS results are state-aware.

They do not claim that the first capture, first EOD, or first three-session maturity horizon has already occurred.

## Future strict transitions already encoded

After prospective_start_at + 10 minutes, the launch verifier requires a real capture run at or after the boundary.

At 2026-09-19 18:25 Tehran, the first-day EOD verifier becomes strict and requires:

- successful first-day capture;
- non-zero first-day Shadow samples;
- functioning same-day outcome path;
- succeeded cron coverage;
- zero leakage into mature Calibration/OOS/Promotion/Activation.

At 2026-09-22 18:25 Tehran, the first maturity-horizon verifier becomes strict and requires:

- complete three-future-session outcome evidence;
- exact first-cohort Calibration equality;
- all 15 downstream job/day successes for the three future sessions;
- no premature downstream release progression.

## Completion semantics

Operational handoff is complete.

There is no safe implementation step to execute before the first real market window without contaminating the prospective experiment.

The next valid progression is empirical:

Saturday 2026-09-19 09:00 Tehran -> first real prospective capture window.

No automatic OOS release, Promotion, Canary, activation, attestation, or final freeze is authorized by this handoff.
