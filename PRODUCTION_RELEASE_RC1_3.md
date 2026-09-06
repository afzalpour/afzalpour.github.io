# Avan — Production Release RC1.3

Date: 2026-09-06

## Release status
**PRODUCTION PASS / RELEASE COMPLETE**

User authorization received explicitly:
- `Production را منتشر کن`
- `Production پاس شد`

Accepted release source:
- RC1.3-D Automated/Server Regression: **PASS**
- RC1.3-D User Live Gate: **PASS**
- Final Accounting Polish Live Gate: **PASS**
- Production Smoke Gate: **PASS** — user-confirmed 2026-09-06
- Source runtime: accepted `avan-staging/` RC

The first RC1.3 Production release is therefore formally complete.

## Production commit
- Production runtime commit: `4bcf0d00538486ba610c179d123c6a7b0ae6b0c2`
- Commit message: `Promote accepted RC1.3 staging runtime to production`
- Production branch: `main`
- Promotion was a fast-forward (`force=false`).

## Rollback anchors
- Pre-promotion backup branch: `prod-backup-20260906-rc1-3-pre`
- Validation/promotion branch: `prod-promotion-rc1-3`
- Pre-promotion main anchor: `0a451dfe27a6da65bc28167087dbcb8ac1d03369`

Frontend rollback does not require a database rollback because this release contained no database DDL/data migration.

## Promotion integrity
The Production runtime uses accepted Staging blobs/tree wherever possible instead of re-created copies.

Critical verified Production objects:
- `index.html` SHA: `b7264c3760c3a1dfe7dde53ce0a8bb07c0e28698`
- accepted `src` tree SHA: `755a60cb7c6f7d20dc6810e62d2f49c974b07d76`
- `src/infrastructure/supabase/avan-cloud-bootstrap.js`: `b1b1b760d34aacaf22d95a7fc484d37721c4bc73`
- `src/infrastructure/supabase/supabase-auth.js`: `be6e263696fdbf0afcc996c82b67bf85d335ba4b`
- `src/ui/components/modal.js`: `c814ba5ddfef33f2fe595d8867ff5387b0db24ab`
- `rc13-final-polish.css`: `55709d8e32538f76a09c41e2f690a3052f59db27`
- `rc13-print-controls-recovery.js`: `36494f8aebc7977a2227f1d5672c08db3f5d17ce`
- `rc13-session-security.js`: `ff27f1422482e6ea636245bd33e74634d68df720`

Production-only configuration:
- `config.js` remains `environment: 'production'`.
- Auth redirect remains `https://afzalpour.github.io/`.
- Browser config contains the publishable key only; no service-role/secret key is introduced.

## Production PWA
- Service Worker SHA: `82d081c9134605fcfb279feb1a1f1cdf18aa4d6b`
- Cache prefix: `avan-prod-`
- Cache version: `avan-prod-rc1-3-v1`

The broad Production prefix intentionally removes prior Production caches such as `avan-prod-core-1-0-v11` during Service Worker activation.

## GitHub Pages deployment
GitHub Pages workflow for production runtime commit:
- Workflow: `pages build and deployment`
- Run ID: `34034831152`
- Head SHA: `4bcf0d00538486ba610c179d123c6a7b0ae6b0c2`
- Status: `completed`
- Conclusion: `success`

Release-record deployment also completed successfully:
- Run ID: `34034994373`
- Conclusion: `success`

## Post-deploy database baseline
Read-only verification after publication:
- Workspaces: 6
- Accounts: 393
- Journal entries: 30
- Journal lines: 67
- Invoices: 11
- Total debit: `201581351`
- Total credit: `201581351`
- Orphan journal lines: 0
- Unbalanced Posted/Reversed journals: 0
- Reversed invoices with invalid/missing reversal link: 0

No financial mutation was performed for the deployment verification.

## Production smoke — USER PASS
User explicitly confirmed `Production پاس شد` after the minimum release-critical smoke covering:
- desktop/iPhone startup/login,
- dashboard/active Company,
- Company switching,
- journal/invoice detail,
- detail printing with Company identity/unit,
- mobile navigation/modal behavior.

This closes RC1.3-RC Feature Freeze for the first Production release.

## Current operating mode
- RC1.3 first Production release: **COMPLETE**.
- Release-specific Feature Freeze: **ENDED**.
- Production remains protected by normal change discipline: new work starts in Staging/new release cycle; Production changes require their own gate/promotion.
- Blocker/Critical production defects still take priority over feature work.

## Security / operational limitations retained accurately
- `public` SECURITY DEFINER executable by `authenticated` remains 0 at RC baseline.
- Supabase Leaked Password Protection remains a tracked Free-plan provider limitation; no paid upgrade is part of this release path.
- Free Transactional Recovery Rehearsal: **PASS**.
- Full external logical dump + Storage-byte restore into a genuinely isolated target: **OPEN / NOT FULL PASS** under the zero-charge policy.

These open provider/DR limitations are tracked explicitly and do not get re-labelled as PASS by the Production smoke result.
