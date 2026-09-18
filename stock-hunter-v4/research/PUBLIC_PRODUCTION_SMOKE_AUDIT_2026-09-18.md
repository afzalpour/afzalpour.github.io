# Stock Hunter Public Production Smoke Gate

AUDIT_DATE: 2026-09-18
STATUS: PENDING_CI
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

This smoke gate does not call Supabase and does not execute any capture or lifecycle operation.
