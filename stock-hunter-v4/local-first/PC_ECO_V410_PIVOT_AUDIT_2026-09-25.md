# PC Eco v4.1.0 Pivot Audit — 2026-09-25

## Decision

The persistent Iran-VPS / fixed-egress dependency is removed from the primary production-feed path.

The production bridge returns to a local-PC architecture because the user's Windows machine is the practical Iran-accessible data source and Eco v4.0.8 already established that a bounded bulk-feed client can operate with acceptable resource use.

## Implemented

- new Supabase Edge Function `stock-hunter-pc-ingest-v410`, ACTIVE version 1;
- custom client authentication with server-side SHA-256 only;
- gzip request decoding and strict size/row caps;
- existing signal/universe/feed-health tables retained;
- new Go Windows client with no external runtime;
- MarketWatch 30s / ClientType 120s;
- rolling snapshots for 4.1.6 Delta evidence;
- maximum 220 uploaded rows;
- no per-symbol full-market enrichment loop;
- automatic public-site open after first successful upload.

## Verification completed here

- Go compile/test path: PASS;
- Linux build with the same injected delivery credential: built;
- built-in client self-test: `SELFTEST PASS 4.1.0-pc-eco`;
- Windows amd64 cross-compile: PASS;
- executable SHA-256: `ff1e2531c3420ab064dcd3df626c353c4e552e0048d6fdcb3db1c28c0afe1ecc`;
- ZIP SHA-256: `b161de190f2f004bb54706b3d5961da6939541b3ca7246d5161c0933f9388e1e`;
- Edge Function deploy: ACTIVE v1.

The current execution environment could not resolve the Supabase public hostname for a direct HTTP smoke, so no fabricated network PASS is claimed. The first genuine end-to-end market/upload smoke must occur from the delivered Windows executable on the user's network.

## Safety

No raw credential is stored in this repository.
No production Hunt 4.1.6 formula/threshold/objective/session policy is changed.
The PC-side fast score is not the production Hunt decision; the browser still executes Frozen Hunt 4.1.6.
