# Stock Hunter Eco Governor v4.0.9 — Off-Hours Network Audit

Date: 2026-09-24
Status: WINDOWS CLIENT SMOKE REQUIRED

## Evidence from real client
Eco v4.0.8 metrics after 36 scans:
- rows: 0
- universe: 4267
- scan_interval_seconds: 30
- client_type_interval_seconds: 120
- last_marketwatch_bytes: 3574135

Interpretation:
- Universe repair is successful: the complete cached catalog is 4267 instruments.
- rows=0 is expected outside trading hours and is not a Universe failure.
- continuing a multi-megabyte decoded MarketWatch scan every 30 seconds outside all configured market sessions is unnecessary resource use.

## Governor repair
Delivery: `Stock_Hunter_Eco_Governor_v4.0.9.zip`

The Governor keeps the existing verified Eco v4.0.8 collector unchanged during the union of configured market sessions and switches to a passive local-cache bridge outside that window.

Network policy (Asia/Tehran):
- Sat-Wed 08:20-17:05: active Eco v4.0.8 collector;
- otherwise: passive cache-only bridge.

Passive mode:
- no external MarketWatch polling;
- no ClientType polling;
- `scan_count=0`;
- `last_marketwatch_bytes=0`;
- localhost remains on `127.0.0.1:41716`;
- complete Universe is served from `%LOCALAPPDATA%\\StockHunterEco\\universe.json.gz`;
- live rows intentionally return empty to prevent stale data from becoming actionable.

The passive bridge supports Universe pagination/search and the same localhost REST paths used by the browser.

## Verification
- Passive bridge Linux functional test: PASS.
- Cached Universe pagination test with 4267 synthetic catalog rows: PASS.
- Search endpoint smoke: PASS.
- Windows target: PE32+ amd64.
- ZIP integrity: PASS.
- Scheduler policy cases (market days/window, Thu/Fri, after-session): PASS.

Package SHA-256:
`39c7640a9a754b2e3fd37d49aa27ce76d7e1175417a560b3b239eb3e0a029991`

Passive bridge SHA-256:
`12c286f9dfc4908aa495e9227594d7b4ac15a3ee34235f48010df452ebf6ebf1`

## Frozen-model safety
No 4.1.6 Hunt formula, threshold, model weight, routing, lifecycle, OOS gate or challenger state is changed.
