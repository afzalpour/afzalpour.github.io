# Cloudflare Bootstrap / Deploy Gate v3

Architecture: `SHIKAR-CLOUD-IRAN-EGRESS-V1`  
Status: EXTERNAL ACCOUNT + IRAN-EGRESS BOOTSTRAP REQUIRED / REPOSITORY READY

The repository side is deployable. Exact integrated-view provenance and its source-equivalent Cloud port are closed. Real Cloudflare resource creation still requires credentials belonging to the user's Cloudflare account, and real market transport still requires one persistent Linux host with Iranian outbound IP. No credential is committed to the repository.

## GitHub environment

Create/approve this GitHub Environment:

`stock-hunter-cloud-production`

### Worker / Wrangler secrets

Required:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STOCK_HUNTER_COLLECTOR_KEYS_JSON`

The collector key JSON maps collector IDs to long random HMAC secrets, for example:

```json
{"iran-primary":"<long-random-secret>"}
```

The example value is not a real secret.

The deploy workflow validates the map before any Cloudflare mutation. The map must:
- be a non-empty JSON object;
- use collector IDs matching `[A-Za-z0-9._:-]{1,128}`;
- use string HMAC secrets of at least 16 characters.

This mirrors the current Worker ingest contract and prevents a malformed key map from reaching production.

### R2 S3 secrets for daily raw-pack workflow

Required by `.github/workflows/stock-hunter-cloud-raw-pack-v1.yml`:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

These are the S3-compatible R2 credentials, not the general Cloudflare API token.

Create an R2 token with **Object Read & Write** permission and scope it to the `stock-hunter-market-v1` bucket when possible. The daily pack job only needs to list/read raw objects and upload/verify the pack.

## Cloudflare API token scope

The deployment workflow uses Wrangler to:
- create/read the R2 bucket;
- install/list R2 lifecycle rules;
- create/deploy the Worker + Durable Object;
- write the Worker secret.

Use the narrowest token that supports those actions. Current Cloudflare authorization documentation requires Workers deployment permission and R2 write permission; creating a brand-new Worker may require product-level Workers Admin access, while later deployments can use Worker Editor access.

No Zone route permission is needed by the current scaffold because it uses the Worker-hosted endpoint and does not configure a custom zone route.

## Deployment workflow

`.github/workflows/stock-hunter-cloud-v1-deploy.yml`

Trigger: manual `workflow_dispatch`.

It:

1. verifies `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `STOCK_HUNTER_COLLECTOR_KEYS_JSON` are present;
2. validates the collector key map without printing secret material;
3. installs the pinned Wrangler;
4. runs the cloud contract dry-run compile;
5. creates private R2 bucket `stock-hunter-market-v1` if absent;
6. installs bounded lifecycle rules:
   - `raw/v1/` -> expire after 3 days;
   - `packs/raw-v1/` -> expire after 15 days;
7. deploys Worker `stock-hunter-cloud-v1` + SQLite Durable Object;
8. installs `COLLECTOR_KEYS_JSON` as a Worker secret;
9. lists deployed Worker versions.

The R2 bucket remains private. Browser clients read only through the Worker.

## Iran-egress bootstrap

After cloud deployment, deploy the repository package:

`stock-hunter-v4/cloud-v1/iran-collector/`

Preferred VPS path:

```bash
sudo ./install-systemd.sh
```

The installer deliberately does not start the collector.

Set real values in:

`/etc/stock-hunter-collector.env`

Then activate:

```bash
sudo /opt/stock-hunter/activate-systemd.py
```

Activation performs:

1. TSETMC source-only probe from the Iran IP;
2. one signed `--once` cloud snapshot;
3. long-running service start only after both pass.

Container/PaaS deployment is also supported, but persistent storage for `/var/lib/stock-hunter-collector` is mandatory for production use.

## First cloud/mobile validation

After the first accepted snapshot:

1. Worker `GET /v1/health` must report fresh;
2. Worker `GET /v1/latest` must return the captured rows;
3. open the isolated mobile staging surface:
   `https://afzalpour.github.io/stock-hunter-v4/cloud-v1/staging/`
4. provide the Worker HTTPS base in the staging input or `?api=https://...`;
5. verify WebSocket snapshot notifications, sequence, row count and freshness.

The staging page contains no secret and performs no Hunt scoring.

## Historical raw-pack bootstrap

Once R2 S3 credentials exist, the scheduled/manual workflow:

`.github/workflows/stock-hunter-cloud-raw-pack-v1.yml`

can compact already captured R2 raw objects into deterministic daily packs. It never calls TSETMC.

## Provenance closure

The former exact-input provenance blocker is closed:

- authoritative `pg_get_viewdef(public.stock_hunter_integrated_v1)` is preserved in-repo;
- authoritative viewdef MD5: `09f820b9692f94010a5391c489ac9c96`;
- PR #277 merged the source-equivalent integrated Cloud port;
- Eco v4.0.8 `asset_type` / `market` derivation is also recovered and ported;
- only a full snapshot batch may mark `frozen_hunt_input_ready=true`; the single-row base builder remains fail-closed.

## Cutover gate

Cloud deployment alone **does not authorize production Hunt cutover**.

The next evidence chain is operational and prospective:

1. successful TSETMC `--source-probe` from an Iranian outbound IP;
2. one accepted signed `--once` snapshot;
3. fresh `/v1/health` and valid `/v1/latest`;
4. mobile staging WebSocket smoke;
5. long-running collector activation;
6. deterministic R2 raw-pack production;
7. prospective Live Shadow evidence through the exact Cloud feature builder + Frozen Hunt 4.1.6.

Until those gates are actually observed:
- production `index.html` remains on the existing frozen path;
- actionable cloud Hunt remains fail-closed;
- historical diagnostics must not be substituted for prospective evidence;
- Frozen Hunt 4.1.6 formulas, thresholds, objectives, and session policy remain unchanged.
