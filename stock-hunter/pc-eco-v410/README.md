# Stock Hunter PC Eco Bridge v4.1.0

Status: Windows delivery built / Supabase ingest deployed / client market smoke pending.

This is the local-PC replacement for the Iran-VPS path.

## Architecture

```
Windows PC (Iran-accessible TSETMC)
  -> bulk MarketWatch every 30s
  -> bulk ClientType every 120s
  -> local rolling snapshots / lightweight ranking
  -> gzip <= 220 rows
  -> Supabase Edge Function stock-hunter-pc-ingest-v410
  -> existing stock_hunter_signals_v4 + stock_hunter_universe_v4
  -> existing GitHub Pages Stock Hunter
  -> Frozen Hunt 4.1.6 remains browser-side
```

There is no VPS, fixed Iranian IP, Cloudflare Worker, per-symbol full-market fan-out, or Python runtime requirement.

## Resource contract

- `runtime.GOMAXPROCS(2)`
- one bulk MarketWatch initialization/update stream
- one bulk ClientType refresh every 120 seconds
- maximum 220 uploaded signal rows per cycle
- gzip transport
- 30-second cycle
- outside the Tehran market window the client sleeps for 60 seconds and does not upload
- no whole-market daily-history fan-out

## Credential model

The repository source contains **no raw client credential**.

The delivered executable is built privately with:

```
-ldflags "-X main.embeddedKey=<delivery-key>"
```

Supabase stores only the SHA-256 digest in the deployed Edge Function. The raw key is not committed to GitHub and must not be placed in issue comments.

## Backend

Deployed function:

`stock-hunter-pc-ingest-v410`

It:
- uses custom `X-PC-Key` authentication;
- accepts gzip request bodies;
- caps compressed and decompressed payload sizes;
- allows at most 300 rows;
- sanitizes the same signal columns used by the current site;
- updates feed health as `4.1.0-pc-eco`.

## Frozen model boundary

The local `fast_score` is only a bandwidth/ranking aid for selecting the upload set.
The authoritative actionable Hunt remains the frozen browser engine `4.1.6-hunt-v2`.
No Hunt formula, threshold, objective, session policy, lifecycle state, or challenger routing is changed by this bridge.

## Delivery identity

Windows amd64 executable SHA-256:

`ff1e2531c3420ab064dcd3df626c353c4e552e0048d6fdcb3db1c28c0afe1ecc`

Delivery ZIP SHA-256:

`b161de190f2f004bb54706b3d5961da6939541b3ca7246d5161c0933f9388e1e`

The binary self-test passed before packaging.
