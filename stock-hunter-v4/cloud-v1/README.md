# Stock Hunter Cloud v1 — Implementation Scaffold

Canonical architecture: `../../CLOUD_PRODUCTION_ARCHITECTURE_CANONICAL.md`

This directory is the implementation boundary for `SHIKAR-CLOUD-IRAN-EGRESS-V1`.

## Current status

Implemented in this scaffold:
- Iran-only collector protocol;
- Python collector for MarketWatch Init/Plus + raw ClientType counters;
- gzip transport;
- HMAC-SHA256 authentication;
- collector stream + monotonic sequence;
- bounded local spool;
- Cloudflare Worker ingest validation;
- Durable Object sequence/replay gate;
- R2 latest-snapshot object;
- public freshness/latest endpoints;
- CI guard that prevents foreign cloud code from directly referencing TSETMC;
- protocol interoperability self-tests.

Intentionally not implemented yet:
- Frozen Hunt scoring in cloud;
- WebSocket fan-out;
- R2 historical compaction/archive packs;
- D1 metadata;
- PWA switch-over;
- Web Push.

The missing Hunt step is deliberate. It must be built by extracting/reusing the exact frozen 4.1.6 runtime and passing parity; formulas must not be retyped from memory.

## Iran collector

Directory: `iran-collector/`

Required environment:
- `STOCK_HUNTER_INGEST_URL`
- `STOCK_HUNTER_COLLECTOR_SECRET`

Optional:
- `STOCK_HUNTER_COLLECTOR_ID=iran-primary`
- `STOCK_HUNTER_INTERVAL_SECONDS=30`
- `STOCK_HUNTER_STATE_DIR=/var/lib/stock-hunter-collector`
- `STOCK_HUNTER_SPOOL_MAX_BYTES=104857600`
- `STOCK_HUNTER_SPOOL_MAX_AGE_SECONDS=3600`

Self-test:

```bash
python3 iran-collector/collector.py --self-test
```

Single real snapshot probe from an Iranian host:

```bash
python3 iran-collector/collector.py --once
```

Production loop:

```bash
python3 iran-collector/collector.py --loop
```

The production loop fetches only inside the broad Tehran market window and resets/reinitializes when leaving/re-entering the window.

## Cloudflare Worker

Directory: `cloudflare/`

Bindings:
- Durable Object: `MARKET_COORDINATOR`
- R2: `MARKET_LATEST`

Required secret:

```text
COLLECTOR_KEYS_JSON
```

Example value shape:

```json
{"iran-primary":"a-long-random-secret"}
```

Never commit real secrets.

Before first deployment:
1. create an R2 bucket named `stock-hunter-market-v1` (or update the binding config to an approved name);
2. set `COLLECTOR_KEYS_JSON` as a Worker secret;
3. dry-run compile;
4. deploy;
5. obtain the Worker `/v1/ingest` URL;
6. configure that URL and the same collector secret on the Iran collector host;
7. run `--once`;
8. verify `/v1/health` is fresh and `/v1/latest` returns the snapshot.

Cloud latest state is an overwritten R2 object, not an ever-growing table.

## Public endpoints

- `GET /v1/health` — freshness metadata.
- `GET /v1/latest` — latest gzip snapshot, returned as JSON with HTTP gzip encoding.

Ingest:
- `POST /v1/ingest` — HMAC-authenticated collector only.

## Safety

- No foreign-cloud code may call TSETMC directly.
- No production Hunt claim until exact 4.1.6 server/browser parity passes.
- No unbounded storage.
- Stale market data must fail closed for active Hunt.
- Supabase is not required by this scaffold.


## Multi-user live fan-out

The cloud runtime exposes:

`GET /v1/ws`

as a browser WebSocket upgrade endpoint. It is origin-restricted to the configured public origin.

The Durable Object uses WebSocket Hibernation APIs. Clients receive only small control messages such as:

```json
{
  "protocol": "stock-hunter-live-v1",
  "type": "snapshot_available",
  "observed_at": 1790272800,
  "accepted_at": 1790272802,
  "sequence": 77,
  "row_count": 4267,
  "body_sha256": "...",
  "collector_id": "iran-primary"
}
```

The full 4k-symbol snapshot is **not** broadcast over every socket. After `snapshot_available`, clients fetch `GET /v1/latest`. This keeps one accepted upstream market snapshot shared across all users while bounding per-client WebSocket traffic.

Application-level `ping`/ `pong` is configured with platform auto-response so the Durable Object does not need to wake for routine keepalive traffic.

No browser is allowed to publish market data over this socket.


## Staging cloud market client

Module:

`client/cloud-market-client-v1.js`

This module is deliberately **not referenced by production `index.html`**. CI fails if production begins loading it before cutover gates are explicitly completed.

Responsibilities:
- HTTPS-only API base;
- `/v1/health` probe;
- `/v1/latest` retrieval;
- `/v1/ws` connection;
- exponential WebSocket reconnect (1s → 30s);
- sequence-aware refresh;
- single in-flight latest fetch with coalescing;
- explicit freshness classification;
- `activeHuntAllowed=false` for data older than the freshness threshold.

It contains no collector or cloud secret.

A future staging loader may instantiate it with the deployed Cloudflare API base and map a fresh validated snapshot into the existing frontend normalization path. Production cutover remains blocked until Iran-egress live probe plus full live feature provenance/parity gates pass.
