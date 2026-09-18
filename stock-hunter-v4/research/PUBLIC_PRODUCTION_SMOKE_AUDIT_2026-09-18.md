# Stock Hunter Public Production Smoke Gate

AUDIT_DATE: 2026-09-18
STATUS: PUBLIC_BYTES_VERIFIED / FINAL_SMOKE_PENDING
CANONICAL_MAIN_SHA: ebfa15dd37787c72626c245983244885a91a07e2
PUBLIC_ROOT: https://afzalpour.github.io/
PUBLIC_APP: https://afzalpour.github.io/stock-hunter-v4/

## Purpose

Verify the actually published GitHub Pages artifacts from an external GitHub Actions runner, not only repository contents.

The gate is read-only.

It checks:

- HTTP 200 for the public root and Stock Hunter app;
- HTTP 200 for key runtime assets;
- byte-for-byte SHA-256 equality between deployed Pages content and repository content for:
  - index.html
  - stock-hunter-v4/index.html
  - stock-hunter-v4/sw.js
  - stock-hunter-v4/hunt-runtime-core-v417.js
  - stock-hunter-v4/app-runtime-router-v417.js
- required runtime markers in the published app and service worker;
- Champion 4.1.6 cache identity remains shikar-sahm-v4.1.6-r12;
- no public smoke request performs POST/RPC/traffic mutations.

First external runner verification confirmed HTTP 200 and byte-for-byte equality for all five published artifacts.

Observed SHA-256 values:
- root index: cb082148b8afefb3cfff12ad4f41a7e48948792c9ea374ed73639874b1f5b532
- Stock Hunter index: b7180019c0cf4852f12827c2de3d405492fd9388092987d1e82733db36da1f16
- service worker: e6a55f18002d9fe9dd92d6d90b2c0469671e44da95c85f66da8b8cdc3e449d69
- runtime core: 60da05f0e3bad6c5d18bb451d71e422feb8d47f9e6f8727e9ba506c85a211702
- runtime router: dd3d3d25bcf98ef92d711a0ff92c6673b23e5f17b2b300dfc31c34406eb742dc

The first workflow attempt exposed two test-definition issues only:
1. invalid YAML caused by a colon inside a plain scalar;
2. an incorrect assumed runtime-core constant name.

Neither issue indicated deployed-byte drift.

This smoke gate does not call Supabase and does not execute any capture or lifecycle operation.
