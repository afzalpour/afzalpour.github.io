# Avan — Production Release RC1.3

Date: 2026-09-06

## Release status
**PUBLISHED / DEPLOYED**

User authorization received explicitly:
`Production را منتشر کن`

Accepted release source:
- RC1.3-D Automated/Server Regression: PASS
- RC1.3-D User Live Gate: PASS
- Final Accounting Polish Live Gate: PASS
- Source runtime: accepted `avan-staging/` RC

## Production commit
- Production commit: `4bcf0d00538486ba610c179d123c6a7b0ae6b0c2`
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
GitHub Pages workflow for production commit:
- Workflow: `pages build and deployment`
- Run ID: `34034831152`
- Head SHA: `4bcf0d00538486ba610c179d123c6a7b0ae6b0c2`
- Status: `completed`
- Conclusion: `success`

Therefore the repository promotion and GitHub Pages deployment are both complete.

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

## Security / operational limitations retained accurately
- `public` SECURITY DEFINER executable by `authenticated` remains 0 at RC baseline.
- Supabase Leaked Password Protection remains a tracked Free-plan provider limitation; no paid upgrade is part of this release path.
- Free Transactional Recovery Rehearsal: PASS.
- Full external logical dump + Storage-byte restore into a genuinely isolated target: OPEN / NOT FULL PASS under the zero-charge policy.

## Production smoke gate
Only a minimal end-user Production smoke remains:
1. Root login opens normally on desktop and iPhone.
2. Dashboard and active Company load.
3. Company switch works.
4. One journal and one invoice detail open.
5. One detail print includes Company identity and correct money unit.
6. iPhone `بیشتر`, modal and bottom navigation remain usable.

No full RC1.3-D re-test is required unless a Blocker/Critical defect appears.
