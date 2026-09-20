# Stock Hunter — Supabase Data-Plane Incident Audit

DATE: 2026-09-20
STATUS: REST_RECOVERED / LOCAL_FEED_FRESHNESS_PENDING
PROJECT: `summnepwuziwulzvpcms`

## User-visible symptom

The frozen 4.1.6 production UI displayed:

`خطا در دریافت اطلاعات بازار`

The local `Stock_Hunter_Feed_Agent_v4.0.5` process was reported as running.

## Root-cause evidence

A read-only GitHub Actions diagnostic reproduced the exact public REST reads used by the 4.1.6 browser.

Initial diagnostic:
- workflow run: `35495501455`, attempt 1;
- `stock_hunter_integrated_v1`: HTTP 503;
- `stock_hunter_feed_health_v4`: HTTP 503;
- PostgREST code: `PGRST002`;
- message: `Could not query the database for the schema cache. Retrying.`

At the same time, direct management SQL access produced connection refusal/timeouts. This established a Supabase database/Data API availability incident rather than a 4.1.6 scoring/runtime failure or a simple stale-feed UI state.

## Recovery verification

The same diagnostic was re-run after service recovery:
- workflow run: `35495501455`, attempt 2;
- integrated REST read: HTTP 200;
- feed-health REST read: HTTP 200.

A direct SQL read also succeeded intermittently after recovery.

The latest persisted local-agent heartbeat observed after REST recovery was still:
- agent version: `4.0.5`;
- status: `ok`;
- symbols in last successful send: `500`;
- last successful feed timestamp: `2026-09-19 16:26:36.56+00`.

Therefore the browser/Data API outage recovered, but a fresh post-incident local Feed Agent send has not yet been proven. The user-side Agent process should be fully restarted before treating local-feed freshness as restored.

## Safety

No 4.1.6 formula, threshold, Hunt scorer, session rule, routing state, prospective boundary or calibration/OOS state was changed while diagnosing this incident.

No Feed key was rotated.

The local-ingest caller contract remains unchanged.

## Operational distinction

- A stale local Feed heartbeat alone should produce the normal stale/unavailable-feed state.
- The observed `خطا در دریافت اطلاعات بازار` was caused by the primary REST read returning non-2xx.
- The 503/PGRST002 incident and the subsequent stale local-agent heartbeat are separate conditions and should not be conflated.

## Remaining closure condition

Mark local feed fully recovered only after a new successful `local-agent` heartbeat and fresh integrated/signal timestamps are observed after the Agent restart.
