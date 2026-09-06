# Avan — RC1.3-RC Feature Freeze / Production Promotion Gate

Date: 2026-09-06

## RC STATUS
- RC1.3-D Automated/Server Regression: **PASS**.
- RC1.3-D User Live Gate: **PASS**.
- Final Accounting Polish Live Gate: **PASS**.
- Current phase: **RC1.3-RC / FEATURE FREEZE**.

## Freeze rule
Until the first Production promotion decision:
- **No new features.**
- Only **Blocker/Critical** fixes are permitted.
- Any Blocker/Critical change that touches accounting, RLS, Auth, print/PWA or Company boundary must re-run the relevant focused regression before promotion.

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

## Security Advisor baseline
- No authenticated-public-SECURITY-DEFINER warning.
- INFO-only no-policy notices remain intentionally deny-by-default for private control-plane tables and `public.workspace_invitations`.
- Only WARN: **Leaked Password Protection Disabled**.
  - This is a tracked provider limitation on the current Free plan.
  - Avan retains its application password-strength/common-password compensation.
  - **No paid upgrade is part of the current release path under the zero-charge policy.**

## Backup / Restore release note
- Free Transactional Recovery Rehearsal: **PASS**.
- Full external logical dump + Storage-byte restore into an isolated target: **OPEN / NOT FULL PASS**.
- This limitation stays explicitly documented; no paid Supabase branch/project is permitted as a workaround under the current policy.

---

# Production promotion plan

Current repository model:
- repository root = **Production**.
- `avan-staging/` = **accepted RC candidate**.

Current Production root is materially older than the accepted Staging RC:
- root `index.html` loads only the old core shell/runtime;
- root Service Worker baseline is `avan-prod-core-1-0-v11`;
- accepted Staging contains the RC1.3 multi-company/security/print/mobile/platform/support runtime.

Therefore Promotion is a controlled **Staging runtime → root runtime** sync, not a database migration.

## Promotion rules
1. Capture the exact pre-promotion root commit SHA as rollback anchor.
2. Do **not** modify Supabase schema/data during frontend promotion.
3. Copy the accepted runtime files referenced by the Staging Service Worker from `avan-staging/` to root.
4. Do **not** blindly copy Staging environment configuration:
   - root `config.js` must keep `environment: 'production'`;
   - root `authRedirectUrl` must be `https://afzalpour.github.io/`;
   - same approved Supabase project/publishable key is retained.
5. Root `sw.js` must use a **Production cache namespace/version**, not `avan-staging-*`.
6. Root `index.html` must use the accepted Staging runtime/script order, with root-relative assets.
7. `manifest.webmanifest`, icons, platform-admin/support pages, CSS, JS and `src/` runtime modules required by the accepted Staging Service Worker must exist at root.
8. Do not promote gate/runbook/SQL evidence files as browser runtime dependencies; they may remain under `avan-staging/` as release evidence.
9. Do not expose service-role/secret keys. Only the existing publishable frontend key is allowed in browser config.
10. Do not alter Production data to manufacture a smoke-test result.

## Production Service Worker target
Use a new root production cache version, for example:

`avan-prod-core-1-0-rc13-v1`

The exact asset inventory must match the accepted Staging runtime inventory, but all paths are root-relative and the cache prefix stays production-specific.

## Pre-promotion static checks
Before modifying root:
- Staging `index.html` references only files present in the accepted runtime.
- Staging Service Worker runtime inventory is internally complete.
- Production `config.js` transformation is prepared separately from Staging config.
- No `service_role`, `sb_secret_`, JWT secret or private credential exists in promoted frontend files.
- Auth rollback commits that restored startup behavior remain present in the accepted RC.
- Company Portfolio layout polish remains present.
- PWA cache has been bumped after the final accepted RC blocker fix.

## Promotion execution
When explicitly approved:
1. Record root rollback SHA.
2. Sync accepted Staging runtime files to root.
3. Write Production `config.js` transformation.
4. Write Production `sw.js` with new production cache version.
5. Verify root `index.html` + `config.js` + `sw.js` and several critical module SHAs/content after writes.
6. Verify GitHub Pages/root serves the new runtime.
7. Perform Production smoke gate only; no feature changes during smoke.

## Production smoke gate
User checks only the minimum release-critical paths:
1. Login opens normally on desktop and iPhone.
2. Active Company / Company switch works.
3. Dashboard loads without error.
4. Open one journal and one invoice detail.
5. Print one detail and confirm Company identity + unit.
6. Open reports and settings.
7. iPhone `بیشتر` / modal / bottom navigation are usable.

Server-side after promotion:
- ledger still balanced;
- orphan lines = 0;
- unbalanced Posted/Reversed = 0;
- invalid invoice reversal links = 0;
- public authenticated SECURITY DEFINER = 0.

## Rollback condition
Immediately rollback frontend root to the recorded pre-promotion commit if any of these occur:
- login/startup is blocked;
- cross-Company leakage/access anomaly;
- accounting detail/list is unusable;
- PWA enters reload/wait loop;
- critical mobile navigation failure;
- Production-only config/redirect error.

Database rollback is **not** part of normal frontend rollback because this promotion contains no database DDL/data change.

## Promotion approval phrase
Passing RC1.3-D does not itself authorize root changes.

Proceed with root Production promotion only after an explicit user instruction equivalent to:

`Production را منتشر کن`

After successful Production smoke, mark the first Production release complete and keep Feature Freeze until that smoke gate is explicitly accepted.