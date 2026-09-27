# Stock Hunter — Canonical Cloud Production Architecture

Status: CANONICAL / DESIGN FROZEN FOR IMPLEMENTATION
Date: 2026-09-24
Architecture ID: `SHIKAR-CLOUD-IRAN-EGRESS-V1`

This document is the cross-chat source of truth for the production topology. It does **not** authorize any change to the frozen Hunt 4.1.6 formulas, thresholds, objectives, lifecycle gates, provenance rules, or promotion/OOS policy.

## Product requirements

1. The production service must work when the owner's personal computer is powered off or has no Internet access.
2. The production service must be usable from mobile phones and by multiple independent users.
3. TSETMC access is treated as **Iran-egress-only**. Foreign infrastructure must never be a required direct caller of TSETMC.
4. The architecture must start on free tiers where practical, but must not pretend that any provider offers unlimited permanent free storage.
5. Every storage layer must be bounded. No database, local disk, spool, or archive is allowed to grow without a hard retention/cap policy.
6. Supabase is no longer a production-critical market-data dependency. Its recovery is a side track only.
7. Frozen Hunt 4.1.6 remains the production Champion. Challenger 4.1.7 remains CHAMPION_ONLY / 0% traffic / Kill Switch ON unless separately authorized by valid lifecycle evidence.

## Production topology

```text
TSETMC
  |
  | Iran IP only
  v
Iran Feed Collector(s)
  |  stateless market fetcher
  |  bounded spool only
  |  no Hunt scoring
  |  HMAC signed HTTPS push
  v
Cloudflare Worker — Ingest Gateway
  |
  v
Cloudflare Durable Object — Market Coordinator
  |---- latest/hot state
  |---- exact shared Frozen Hunt 4.1.6 runtime (after parity extraction)
  |---- WebSocket / HTTP fan-out
  |
  +---- Cloudflare R2 — bounded compressed archive
  +---- Cloudflare D1 — small metadata/control only
  |
  v
GitHub Pages PWA
  |
  +---- mobile users
  +---- desktop users
  +---- public users

After market / historical:
R2 -> GitHub Actions -> PIT reconstruction / objectives / parity / validation / reports
```

## Iran Feed Collector contract

The Iran collector is the only production component that requires Iranian egress to TSETMC.

Responsibilities:
- fetch MarketWatch Init/Plus and other approved point-in-time sources;
- preserve source timestamps and freshness;
- send raw/normalized market facts, not Hunt decisions;
- push to Cloudflare over outbound HTTPS;
- sign each payload with HMAC-SHA256;
- maintain a strictly bounded local spool when international connectivity is unavailable;
- flush the spool in sequence order before resuming live sends;
- never become a permanent historical store.

Non-responsibilities:
- no user-facing UI;
- no production database;
- no long-term archive;
- no Hunt formula implementation;
- no threshold tuning;
- no Objective labeling.

Collector is replaceable. The production protocol must support multiple collector identities so a second Iran collector can later be added as standby without changing the browser or scoring architecture.

## Cloud ingest security

Each ingest request carries:
- protocol version;
- collector ID;
- stream ID;
- monotonic sequence;
- send timestamp;
- nonce;
- SHA-256 of the exact transmitted body;
- HMAC-SHA256 signature.

The cloud side must:
- reject unknown collectors;
- enforce a bounded timestamp freshness window;
- verify the HMAC over a canonical byte string;
- reject non-increasing sequence numbers within a collector stream;
- validate payload identity against signed headers;
- keep secrets out of browser assets and GitHub Pages;
- support secret rotation without changing the public protocol.

## Live scoring

Collector does not calculate Hunt.

The cloud scoring layer must eventually execute the **same frozen engine**, not a reimplementation by interpretation. The extraction step must:
- reuse `app-hunt-v416.js` and relevant session logic;
- inject a controlled clock where needed;
- preserve exact formulas and thresholds;
- preserve Objective A/B definitions;
- preserve asset eligibility and session rules;
- pass browser ↔ server fixture parity before production cutover.

Until that parity layer exists, the cloud scaffold may ingest and expose market facts only. It must not claim Frozen Hunt parity.

## Storage policy

### Collector disk
- bounded spool only;
- target operational cap: 100 MB by default;
- target age cap: 60 minutes by default;
- oldest unsent data may be dropped only after emitting an explicit data-loss/freshness condition;
- no unbounded historical cache.

### Durable Object
- latest/hot coordination only;
- rolling state required for live dynamics;
- no indefinite raw history.

### R2
- compressed archive and latest cloud snapshot;
- operational hard cap should remain below the provider free-tier ceiling (initial design target: 8 GB);
- full raw data is not retained forever;
- validated compact feature/provenance packs become the long-lived scientific artifact;
- raw forensic windows are retained according to explicit policy.

### D1
- metadata/control only;
- no tick/order-book archive;
- initial design cap: 250 MB;
- appropriate for manifests, system health, user preferences/alert metadata, release/control metadata.

### Personal computer
- optional development/recovery cache only;
- not a production dependency;
- bounded rolling cache;
- historical tooling may use temporary local files and delete them after verified cloud upload/checksum when policy permits.

## Archive compaction invariant

Old raw data may be removed only after:

```text
raw evidence
  -> deterministic transform
  -> feature/provenance pack
  -> validation PASS
  -> cryptographic hash recorded
  -> cloud upload verified
  -> retention policy allows raw eviction
```

No interpolation, future backfill, or fabricated point-in-time fields may be introduced by compaction.

## Historical / scientific execution

GitHub Actions and other foreign infrastructure must not directly depend on TSETMC Iran-only endpoints.

Historical jobs consume already captured R2 artifacts and may perform:
- Historical PIT reconstruction;
- Objective A/B ground-truth evaluation;
- browser/server parity;
- diagnostic backtests;
- calibration diagnostics;
- reproducible reports.

Historical evidence remains diagnostic/historical and must not be presented as prospective/OOS evidence.

## Availability and failover

Phase 1:
- one Iran collector;
- bounded spool;
- cloud health/freshness reporting.

Phase 2:
- second Iran collector;
- independent collector ID/stream;
- cloud sequence/deduplication;
- primary/standby or freshest-valid-source selection.

If the Iran collector can reach TSETMC but cannot reach Cloudflare, it spools within the hard cap. The UI must mark cloud data stale when freshness exceeds the production limit; stale data is never presented as an active Hunt.

If the cloud platform is unavailable, the frontend must fail closed for live Hunt and may show the latest clearly timestamped cached snapshot as historical/stale only.

## Frontend / mobile

GitHub Pages remains the static origin. The app evolves into a PWA:
- installable on mobile;
- cloud API/WebSocket as the live source;
- no dependency on localhost;
- no direct TSETMC calls;
- local IndexedDB/cache for UX only, never the canonical live source.

Future Web Push can deliver Watchlist/Hunt alerts while the PWA is not open.

## Provider replaceability

The interfaces are more important than providers.

Replaceable boundaries:
- Iran Collector host;
- cloud ingest/runtime provider;
- object storage provider;
- metadata database;
- auth provider.

Provider-specific code must stay behind adapters. A future move from Cloudflare must not require changing the frozen Hunt contract or browser domain model.

## Explicitly rejected production designs

- Owner PC as the primary market feed.
- Foreign cloud directly polling TSETMC.
- One database row per high-frequency market snapshot forever.
- Raw market history stored indefinitely in PostgreSQL.
- Supabase as the sole live-feed dependency.
- Railway as a solution to Iran-only TSETMC egress unless it is proven to provide Iranian egress.
- Any design that assumes unlimited free storage.

## Supabase status

Project `summnepwuziwulzvpcms` entered a PostgreSQL restart loop with:
`pg_wal/xlogtemp...: No space left on device`.

Restart did not recover it; Pause failed because the pre-pause backup could not complete. Table/schema reads returned connection refused. Supabase recovery is therefore a separate infrastructure/support task and must not block the new production architecture.

## Implementation order

1. Freeze this architecture and protocol in repo.
2. Build Iran Collector protocol implementation and offline self-tests.
3. Build Cloudflare ingest/Market Coordinator scaffold and cross-language protocol self-test.
4. Prove an Iran-hosted collector can read TSETMC and push one signed snapshot to cloud.
5. Add bounded latest-state storage and freshness API.
6. Extract Frozen Hunt 4.1.6 into a shared cloud/browser runtime with exact parity tests.
7. Add WebSocket fan-out and switch the frontend to cloud live data.
8. Add bounded R2 archive/manifest policy.
9. Move historical/PIT jobs to R2 + GitHub Actions.
10. Add PWA/Web Push/user features.
11. Add a second Iran collector when public availability requires redundancy.

## Frozen invariants

- Production Champion: Stock Hunter 4.1.6.
- Engine: `4.1.6-hunt-v2`.
- Objective A: negative -> zero/positive in the same session.
- Objective B: starts in `0% <= dayChange < +1%` and crosses +1% in the same session.
- 10-day forecast models are display-only and have zero Hunt Score weight.
- No future data in pre-event features.
- ClientType end-of-day data is not point-in-time intraday evidence.
- BestLimits historical reconstruction is stateful forward-carry only; never future backfill.
- No synthetic data may be counted as prospective evidence.
- No scoring/threshold/routing/lifecycle change is authorized by this architecture document.

## Continuity phrase

When a future chat needs to recover this architecture, use:

`SHIKAR-CLOUD-IRAN-EGRESS-V1`

and read this file before making architecture or deployment changes.
