# Avan — RC1.3-RC Production Promotion Gate

Date: 2026-09-06

## FINAL STATUS
**PASS / CLOSED**

- RC1.3-D Automated/Server Regression: **PASS**.
- RC1.3-D User Live Gate: **PASS**.
- Final Accounting Polish Live Gate: **PASS**.
- Production promotion authorization: **RECEIVED** (`Production را منتشر کن`).
- Production runtime deployment: **PASS**.
- GitHub Pages deployment: **PASS**.
- Production Smoke Gate: **PASS** (`Production پاس شد`, user-confirmed 2026-09-06).
- RC1.3 first Production release: **COMPLETE**.
- RC1.3 release-specific Feature Freeze: **ENDED after Production Smoke PASS**.

## Final server baseline — 2026-09-06
- Workspaces: 6.
- Accounts: 393.
- Journal entries: 30.
- Journal lines: 67.
- Invoices: 11.
- Ledger debit = credit = **201581351** canonical Toman.
- Orphan journal lines = 0.
- Unbalanced Posted/Reversed journals = 0.
- Reversed invoices with invalid/missing reversal link = 0.
- Companies with incorrect standard level-2 chart count = 0.
- Critical public tables without RLS = 0.
- `public` SECURITY DEFINER executable by `authenticated` = 0.

## Security / operational retained limitations
- Supabase Leaked Password Protection remains disabled as a tracked Free-plan provider limitation.
- No paid upgrade is part of the project path under the zero-charge policy.
- Free Transactional Recovery Rehearsal: **PASS**.
- Full external logical dump + Storage-byte restore into a genuinely isolated target: **OPEN / NOT FULL PASS**.

## Production promotion record
Repository model:
- repository root = **Production**.
- `avan-staging/` = staging / release evidence / future candidate workspace.

Promotion execution:
- Pre-promotion main anchor: `0a451dfe27a6da65bc28167087dbcb8ac1d03369`.
- Rollback branch: `prod-backup-20260906-rc1-3-pre`.
- Validation/promotion branch: `prod-promotion-rc1-3`.
- Production runtime commit: `4bcf0d00538486ba610c179d123c6a7b0ae6b0c2`.
- Promotion was a fast-forward; no force update.
- No Production DB DDL/data migration was part of frontend promotion.

Production-specific transformations:
- root `config.js`: `environment: 'production'`.
- root `authRedirectUrl`: `https://afzalpour.github.io/`.
- root Service Worker cache: `avan-prod-rc1-3-v1`.
- accepted Staging runtime blobs/tree were reused wherever possible.

Critical Production objects:
- `index.html`: `b7264c3760c3a1dfe7dde53ce0a8bb07c0e28698`.
- `src` tree: `755a60cb7c6f7d20dc6810e62d2f49c974b07d76`.
- `src/infrastructure/supabase/avan-cloud-bootstrap.js`: `b1b1b760d34aacaf22d95a7fc484d37721c4bc73`.
- `src/infrastructure/supabase/supabase-auth.js`: `be6e263696fdbf0afcc996c82b67bf85d335ba4b`.
- `src/ui/components/modal.js`: `c814ba5ddfef33f2fe595d8867ff5387b0db24ab`.
- `rc13-print-controls-recovery.js`: `36494f8aebc7977a2227f1d5672c08db3f5d17ce`.
- `rc13-session-security.js`: `ff27f1422482e6ea636245bd33e74634d68df720`.
- Production `sw.js`: `82d081c9134605fcfb279feb1a1f1cdf18aa4d6b`.

## GitHub Pages
Production runtime deployment:
- workflow: `pages build and deployment`.
- run: `34034831152`.
- conclusion: **success**.

Release-record deployment:
- run: `34034994373`.
- conclusion: **success**.

## Production Smoke — PASS
The user accepted the minimum release-critical paths:
1. Login/startup on desktop and iPhone.
2. Active Company and Company switch.
3. Dashboard load.
4. Journal and invoice detail.
5. Detail print with Company identity and money unit.
6. Reports/settings path.
7. iPhone More/modal/bottom navigation.

## Post-release rule
This gate is historical and closed.

Future feature work must begin in Staging/a new release cycle. Production must not become the development workspace. Any Production promotion in the next cycle requires its own relevant regression and explicit release gate.
