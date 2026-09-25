# Stock Hunter PC Eco Production Architecture — Canonical v1

Canonical architecture ID: `SHIKAR-PC-ECO-GITHUB-V1`  
Status: PRIMARY PRODUCTION FEED PATH  
Date: 2026-09-25

## Decision

The primary live-feed path no longer depends on a persistent Iranian VPS, fixed Iranian egress IP, or Cloudflare collector.

The user's Windows PC is the primary Iran-accessible market-data origin. GitHub remains the source/release/public-site host; Supabase remains the ingest/data backend used by the existing site.

## Data path

```
Windows PC
  -> TSETMC bulk MarketWatch / ClientType
  -> Stock Hunter PC Eco Bridge v4.1.1
  -> gzip bounded upload
  -> Supabase Edge Function stock-hunter-pc-ingest-v410
  -> stock_hunter_signals_v4 / stock_hunter_universe_v4 / feed health
  -> GitHub Pages Stock Hunter
  -> Frozen Hunt 4.1.6 browser engine
```

## Resource contract

- one bulk MarketWatch stream at 30-second cadence;
- one bulk ClientType refresh every 120 seconds;
- no whole-market per-symbol request fan-out;
- full eligible MarketWatch universe uploaded every cycle in gzip batches of at most 250 rows;
- no local top-N transport prefilter may prevent an eligible symbol from reaching Frozen Hunt;
- gzip transport;
- two Go scheduler threads maximum;
- no upload outside the configured Tehran market window;
- no Python runtime or local service installation required.

## Authentication

The desktop delivery credential is injected only into the delivered executable at build time.

The raw credential:
- is not committed to GitHub;
- is not written to public documentation;
- is not required as user input.

The Supabase Edge Function stores only its SHA-256 digest and performs custom authorization before any database write.

## Frozen model boundary

The PC bridge does not replace or redefine Frozen Hunt 4.1.6.

Local `fast_score` is transport/display metadata only and must not decide whether an eligible symbol reaches Frozen Hunt.

The public site continues to execute `4.1.6-hunt-v2` for actionable Hunt classification. No formula, threshold, objective, session policy, lifecycle state, or challenger routing is changed by this architecture.

## Delivery

Primary Windows client:

`Stock_Hunter_PC_Eco_Bridge_v4.1.1.exe`

Executable SHA-256:

`a318401d3d6e3fc7640139cc4370a0b61301db4b1b26421ade49dc0ec3e1671e`

Delivery ZIP SHA-256:

`0d51471a3a9f0dfefc7273b273e840b4798dc8590bcdefe040ad26cc323aee54`

## Cloud/VPS path

The earlier `SHIKAR-CLOUD-IRAN-EGRESS-V1` design is retained as an optional future redundancy/failover design only.

It is no longer a prerequisite for restoring or operating the primary live feed.

## First live acceptance

The only remaining operational acceptance is a genuine run of the delivered Windows executable on the user's machine/network:

1. TSETMC bulk fetch succeeds;
2. first gzip upload returns `ok:true`;
3. `stock_hunter_feed_health_v4` advances with `agent_version=4.1.1-pc-eco-full-universe`;
4. public GitHub Pages shows fresh data;
5. repeated cycles remain bounded and stable.

This acceptance must be based on the real Windows run; it must not be fabricated from historical or synthetic data.
