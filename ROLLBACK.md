# Rollback procedure

If the root deployment has a blocking UI/runtime problem:

1. Do NOT alter or rollback the Supabase schema. RC1 and Final Candidate use the same validated database contract.
2. Restore the previous root static files from the Git/GitHub commit immediately preceding the Avan Core 1.0 deployment.
3. Hard refresh or open an Incognito window.
4. If the issue is only stale PWA assets, unregister the site Service Worker in browser developer/application settings and reload.
5. Keep `/avan-staging/` available until the production deployment passes the smoke test.

Accounting data remains in Supabase and is independent of reverting the static GitHub frontend.
