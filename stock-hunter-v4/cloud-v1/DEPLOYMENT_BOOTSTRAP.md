# Cloudflare Bootstrap / Deploy Gate

The code is deployable, but real Cloudflare resource creation requires credentials belonging to the user's Cloudflare account. No credential is committed to the repository.

## GitHub environment

Create/approve environment:

`stock-hunter-cloud-production`

Required secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STOCK_HUNTER_COLLECTOR_KEYS_JSON`

The collector key JSON must map collector IDs to long random secrets, for example:

```json
{"iran-primary":"<long-random-secret>"}
```

Do not use the example text as a real secret.

## Deployment workflow

`.github/workflows/stock-hunter-cloud-v1-deploy.yml`

It is `workflow_dispatch` only.

It:
1. verifies the required secrets are present;
2. installs the pinned Wrangler version;
3. runs the dry-run contract compile;
4. creates `stock-hunter-market-v1` R2 bucket only if it is absent;
5. deploys Worker + SQLite Durable Object;
6. installs `COLLECTOR_KEYS_JSON` as a Worker secret;
7. lists deployed versions for verification.

The R2 bucket remains private. The browser reads market data only through the Worker.

## Remaining external bootstrap

After cloud deployment, a real Iran-egress host is still required for the first live probe. On that host configure:
- Worker `/v1/ingest` URL;
- collector ID matching the cloud secret map;
- the corresponding HMAC secret.

Then run:

```bash
python3 collector.py --self-test
python3 collector.py --once
```

Only after `/v1/health` reports a fresh accepted snapshot should the long-running collector service be enabled.

No production frontend switch is authorized by cloud deployment alone; Frozen Hunt parity and live feed validation are separate gates.
