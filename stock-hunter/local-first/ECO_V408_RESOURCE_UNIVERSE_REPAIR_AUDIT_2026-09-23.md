# Stock Hunter Eco Feed v4.0.8 — Resource / Universe Repair Audit

Date: 2026-09-23
Status: READY FOR WINDOWS CLIENT SMOKE

## Incident
A real Windows client run of Local-First v4.0.7 caused unacceptable bandwidth/CPU pressure and the UI reported only about 500 fetched symbols.

## Root causes
1. The legacy Agent repeatedly fetched full MarketWatch and also performed many concurrent per-symbol enrichment calls plus a fast hot-symbol loop.
2. The live MarketWatch row set was treated as if it were the complete market Universe.
3. Browser normalization did not preserve the incoming `snapshots` field even though frozen 4.1.6 Delta logic consumes it.
4. Explicit `همه نمادها` rendered live `rows`, not the complete Universe catalog.
5. A v4.1.0 hotfix still forced Detail/Search reads through Supabase rather than the active local source.

## Replacement
`Stock_Hunter_Eco_Bridge_v4.0.8.exe` is a single process that replaces both the old Feed Agent and Local Bridge.

Resource contract:
- `runtime.GOMAXPROCS(2)`;
- launcher sets Windows process priority to `BelowNormal`;
- one bulk MarketWatch scan every 30 seconds;
- one bulk ClientTypeAll refresh every 120 seconds;
- full instrument catalog refresh is independent, delayed at startup, cached locally, and attempted at low frequency;
- per-symbol depth fallback is limited to top candidates and cached;
- daily history is limited/cached and never fan-outs over the whole Universe;
- no 2.5-second hot-symbol loop.

Universe contract:
- live row count and Universe count are separate metrics;
- local REST Universe supports pagination beyond 1000 rows;
- explicit All Symbols uses the full catalog; non-live catalog members remain visible as non-analyzed rows.

## Binary / package
Windows amd64 binary SHA-256:
`0b80d20a349ca5d92acb7c61f4f23ab6a4dd747f33b1509f2fdf3d6f40abb8b4`

Delivery ZIP SHA-256:
`0d6ed1bbd11398f79a4568acd4d4f6f920d1f7fb985382a938be5408654c1139`

## Verification
- `go test ./...`: PASS
- `go vet ./...`: PASS
- built-in self-test: `SELFTEST PASS 4.0.8-eco`
- self-test covers local REST, snapshots, Universe search, and 1250-row pagination.
- PE target: Windows x86-64.

## Frozen model safety
No 4.1.6 Hunt formula, threshold, model weight, routing rule, lifecycle state, OOS gate, or challenger activation state is changed.
The browser change that preserves `snapshots` restores the data already expected by frozen `snapshotDynamicsV416`; it does not alter its formula.

Launcher verification: metrics field mapping corrected to `rows` / `universe`; ZIP integrity revalidated after the correction.
