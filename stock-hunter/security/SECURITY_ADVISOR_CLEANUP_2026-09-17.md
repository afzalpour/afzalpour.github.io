# Stock Hunter 4.1.7 — Security Advisor Cleanup Verification

STATUS: PASS
DDL_APPLIED_IN_THIS_STEP: NO
LIVE_VERIFICATION: PASS

## Target findings

Roadmap item #4 tracked three historical Supabase security findings:

1. `public.stock_hunter_normalize_fa_v4(text)` had a mutable/unpinned `search_path`.
2. `public.stock_hunter_feed_status_v4()` was a `SECURITY DEFINER` function directly executable by public application roles.
3. `public.stock_hunter_sync_signal_to_universe_v4()` was a `SECURITY DEFINER` trigger function directly executable by public application roles.

## Existing remediation discovered

The live migration history already contains:

- version: `20260917171731`
- name: `stock_hunter_security_advisor_cleanup_20260917`

That migration:

- sets `search_path = pg_catalog` on `stock_hunter_normalize_fa_v4(text)`;
- sets `search_path = pg_catalog` on `stock_hunter_feed_status_v4()`;
- sets `search_path = pg_catalog` on `stock_hunter_sync_signal_to_universe_v4()`;
- revokes `EXECUTE` on the two `SECURITY DEFINER` functions from `PUBLIC`, `anon`, and `authenticated`;
- grants `EXECUTE` on those functions to `service_role`.

Because the migration was already applied and the live catalog matches the intended state, this verification step intentionally performs no duplicate DDL.

## Dependency audit

`stock_hunter_sync_signal_to_universe_v4()` remains attached to the internal trigger:

- trigger: `trg_stock_hunter_sync_signal_to_universe_v4`
- table: `public.stock_hunter_signals_v4`
- timing: `AFTER INSERT OR UPDATE OF symbol, company_name, updated_at`

The trigger dependency does not require direct `EXECUTE` permission for `anon` or `authenticated`, so revoking those grants does not break the internal trigger path.

No other database function was found to call any of the three target functions by name.

Repository search also found no application source caller for `stock_hunter_feed_status_v4` or `stock_hunter_normalize_fa_v4` on the default branch. This is supporting evidence only; live PostgreSQL catalog state is the authority for privileges.

## Live privilege verification

At verification time:

- `stock_hunter_normalize_fa_v4(text)` is `SECURITY INVOKER` and has `search_path=pg_catalog`.
- `anon` cannot execute `stock_hunter_feed_status_v4()`.
- `authenticated` cannot execute `stock_hunter_feed_status_v4()`.
- `anon` cannot execute `stock_hunter_sync_signal_to_universe_v4()`.
- `authenticated` cannot execute `stock_hunter_sync_signal_to_universe_v4()`.
- `service_role` retains execute permission on both internal functions.
- no `public.stock_hunter%` `SECURITY DEFINER` function is executable by `anon` or `authenticated`.

The versioned assertion script `verify-security-advisor-cleanup-v417.sql` was executed against the live project and returned:

`stock-hunter-security-advisor-cleanup-v417: PASS`

## Security Advisor result

After verification, Supabase Security Advisor no longer reports the three target findings.

The only remaining security advisor item at verification time is an INFO-level `RLS Enabled No Policy` finding on `private.stock_hunter_canary_expansion_authorizations_v417`. It is outside this roadmap item. Because the table is in a private schema, it must be assessed according to its intended service-only access model instead of adding a cosmetic policy solely to silence the advisor.

## Regression contract

Future releases should run `stock-hunter-v4/security/verify-security-advisor-cleanup-v417.sql` after any migration that changes Stock Hunter functions, grants, or triggers.

A regression exists if any public `stock_hunter%` `SECURITY DEFINER` function becomes executable by `anon` or `authenticated`, if the normalize function loses its pinned search path, or if the signal-to-universe trigger dependency disappears.
