# Avan Core 1.0 RC1 — Regression Status

## Passed from live gates
- Supabase Auth signup/login/session persistence — PASS (Gate B-3 live)
- Automatic workspace bootstrap — PASS
- Standard chart of accounts bootstrap — PASS
- Cloud persistence across logout/login — PASS
- Account CRUD / safe archive-delete rules — PASS in Gate B-4 live
- Receipt / payment / transfer via controlled RPC — PASS in Gate B-4 live
- Manual Draft lifecycle — PASS in Gate B-4.1 live
- Draft may be incomplete/unbalanced — PASS
- Post requires balanced journal — PASS
- Posted journal is immutable — PASS
- Reversal workflow — PASS in Gate B-4 live
- Period lock — PASS in Gate B-4 live
- Journal / trial balance / account statement / P&L / balance sheet / cash-bank reports — PASS in Gate B-4 live
- Core integrity: unbalanced Posted = 0, orphan lines = 0 — PASS in Gate B-4 live
- Mobile manual-journal entry point — PASS in Gate B-4.1 live

## Static RC checks performed
- `app.js` syntax — PASS
- `cloud.js` syntax — PASS
- `sw.js` syntax — PASS
- Runtime contains no `service_role` or `sb_secret_` key — PASS
- Frontend uses `IRAN` font-family — PASS
- Direct browser mutations of journals/periods/financial transactions are not used by RC application code — PASS
- Service-worker cache bumped to `avan-core-1-0-rc1-v1` — PASS

## Pending before RC acceptance
- Two-user live RLS isolation test — PENDING (must run on real Supabase)
- Read-only `RC_DATABASE_VERIFY.sql` — PENDING on real Supabase

## Environment limitation
This build environment cannot resolve the user's Supabase hostname, so no claim is made that RC1 itself has directly executed the final two-user RLS test from this environment.
