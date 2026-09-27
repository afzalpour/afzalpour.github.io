# Stock Hunter Prospective Launch Preflight Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_PREFLIGHT_PASS / FIRST_REAL_MARKET_WINDOW_PENDING

## Launch boundary

Live database clock during this audit:

- Tehran: 2026-09-18 11:33
- prospective_start_at: 2026-09-19 05:30:00+00
- Tehran prospective start: 2026-09-19 09:00

The current collection state is:

ARMED_AWAITING_FIRST_MARKET_WINDOW

This is expected because Friday 2026-09-18 is outside the configured Sat-Wed trading schedule and the first prospective window has not started.

## Clean pre-launch state

At audit time:

- hunt events = 0
- shadow samples = 0
- mature calibration samples = 0
- OOS manifests = 0
- promotion proposals = 0
- activation reviews = 0
- final release manifests = 0
- capture last_run_at = null
- capture last_success_at = null
- capture last_error = null

The production control plane remains:

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null
- champion engine = 4.1.6-hunt-v2

No synthetic data or manual launch row was created.

## Capture scheduler

The three live capture jobs are active:

- open: 30-59 5 * * 0-3,6
- mid: * 6-12 * * 0-3,6
- close: 0-30 13 * * 0-3,6

Each current cron command:

- calls stock-hunter-capture-v416;
- reads stock_hunter_project_url_v416 from Vault;
- reads stock_hunter_capture_token_v416 from Vault;
- sends X-Stock-Hunter-Capture-Token.

The five downstream outcome/evaluator jobs are also active:

- stock-hunter-outcomes-v416-close-a
- stock-hunter-outcomes-v416-close-b
- stock-hunter-shadow-outcomes-v416-close-a
- stock-hunter-shadow-outcomes-v416-close-b
- stock-hunter-candidate-evaluator-v416

Vault entries for the project URL and capture token both exist. Secret values were not exported or stored in the repository.

## Live endpoint probe

A live POST was issued through pg_net using the same Vault-backed custom header path as the scheduler.

Request id: 746

Response:

- HTTP 200
- timed_out = false
- error_msg = null
- body = {"ok":true,"skipped":"outside-market-window"}

After the probe:

- hunt events remained 0
- shadow samples remained 0
- capture state remained unchanged

This proves the current Vault -> Edge Function -> custom authentication path is reachable before launch without forcing a market scan.

## State-aware launch verifier

Repository verifier:

stock-hunter-v4/prospective-data/verify-prospective-launch-preflight-v416.sql

Live result:

stock-hunter-prospective-launch-preflight-v416: PASS

Before prospective_start_at it requires a clean ARMED state.

After prospective_start_at + 10 minutes it becomes stricter: the first eligible capture must have recorded last_run_at at or after the prospective boundary. A missing run fails with:

first eligible capture did not run within launch grace window

It also continues to require:

- no capture error;
- all scheduler/Vault dependencies present;
- the control plane locked at CHAMPION_ONLY / 0%;
- no premature activation review.

## Completion semantics

Infrastructure is ready for the first real prospective collection window.

This audit does not claim any real-data maturity. Statistical maturity remains zero until actual market observations are captured and mature through the three-future-session outcome boundary.

Next operational event: Saturday 2026-09-19 at 09:00 Tehran.
