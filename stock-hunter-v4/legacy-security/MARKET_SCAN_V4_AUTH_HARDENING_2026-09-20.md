# Stock Hunter — Legacy Market Scan Authentication Hardening

DATE: 2026-09-20
STATUS: DEPLOYED_V2 / CI_PENDING

## Scope

Legacy Edge Function:
`stock-hunter-market-scan-v4`

This function is not the canonical 4.1.6 prospective capture path. It writes the legacy `stock_hunter_signals_v4` surface and may still have an external caller that is not represented in this repository.

Therefore the caller transport was deliberately preserved.

## Pre-hardening finding

Deployed version 1 had:
- `verify_jwt=false`;
- custom `x-scan-secret` authentication;
- a 64-character raw caller secret embedded directly in Edge Function source;
- no Vault use for that caller credential.

No caller was found in:
- repository code search for the function slug;
- production `pg_cron` jobs.

This does not prove that no external caller exists.

## Hardening applied

Deployed version 2:
- keeps `verify_jwt=false`;
- keeps the same `x-scan-secret` request contract;
- keeps the same caller secret value from the caller's perspective;
- removes the raw secret from source;
- stores only its SHA-256 digest in the deployed source;
- hashes the supplied request header with Web Crypto and compares the digest;
- uses an aggregate byte comparison rather than direct raw-secret string equality;
- returns unauthorized responses with `Cache-Control: no-store`.

Deployment:
- version: 2
- ezbr sha256: `5edbf18ca4e84cedd29e384806bdbe47b0930ef8add37012104ffb7c1bd0507a`

## Live negative regression

Request 109:
- missing `x-scan-secret`
- HTTP 401
- `unauthorized`

Request 110:
- wrong `x-scan-secret`
- HTTP 401
- `unauthorized`

## Compatibility statement

The external request header name and accepted secret value were not changed. The hardening changes only how the function stores and compares that value internally.

A positive invocation from the unknown external caller was not independently observed during this audit, so this document does not claim that an external caller is currently active.

## Remaining improvement

If the external caller is later identified and can be coordinated, migrate this legacy endpoint from a reusable shared secret to a replay-resistant service request scheme or retire the endpoint if unused.

Do not copy any historical raw credential into this repository.
