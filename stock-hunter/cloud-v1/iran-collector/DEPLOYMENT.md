# Iran Collector Deployment v1

Architecture: `SHIKAR-CLOUD-IRAN-EGRESS-V1`

The collector host is replaceable. Its non-negotiable requirement is an outbound **Iranian IP** that can reach the approved TSETMC endpoint.

## Safety order

Never start the permanent loop first.

Required order:

1. local protocol self-test;
2. TSETMC source-only probe from the candidate Iran host;
3. one signed cloud snapshot;
4. verify Cloudflare `/v1/health` and mobile staging;
5. only then enable the long-running loop.

The source-only probe requires **no cloud secret**:

```bash
python3 collector.py --self-test
python3 collector.py --source-probe
```

A valid source probe returns non-zero market rows and source/refid/hEven metadata. It does not send any data to Cloudflare.

## systemd — preferred for a small Iranian VPS

Copy the `iran-collector/` directory to the host and run:

```bash
sudo ./install-systemd.sh
```

The installer:
- creates an unprivileged `stockhunter` system user;
- installs the collector under `/opt/stock-hunter/`;
- creates bounded state under `/var/lib/stock-hunter-collector`;
- installs and enables the unit;
- **does not start it**;
- preserves an existing environment file;
- runs only the offline protocol self-test.

Then edit:

```text
/etc/stock-hunter-collector.env
```

with the real Worker ingest URL and collector secret.

Activation is one command:

```bash
sudo /opt/stock-hunter/activate-systemd.py
```

Activation fails closed. It runs `--source-probe`, then exactly one `--once`, and starts systemd only if both succeed.

## Docker / Iranian PaaS

Build:

```bash
docker build -t stock-hunter-iran-collector:v1 .
```

Before the permanent container:

```bash
docker run --rm --env-file collector.env \
  stock-hunter-iran-collector:v1 --source-probe

docker run --rm --env-file collector.env \
  -v stock_hunter_collector_state:/var/lib/stock-hunter-collector \
  stock-hunter-iran-collector:v1 --once
```

Then:

```bash
docker compose up -d
```

### Persistent-volume requirement

A PaaS/container host is acceptable only if `/var/lib/stock-hunter-collector` is persistent across restarts/redeploys.

That directory contains:
- persistent random stream ID;
- monotonic sequence;
- bounded outbound spool.

An ephemeral filesystem would reset stream identity and discard unsent evidence. Do not classify an ephemeral free container as production-ready.

## Secrets

Never commit:
- collector HMAC secret;
- Cloudflare API token;
- R2 keys.

The browser/PWA does not need the collector secret.

## Free-tier note

Free/trial Iran hosting may be used for the **probe**. Production availability must not be promised on a provider that explicitly offers no SLA or persistent storage guarantee.
