# Avan — RC1.3-D Full Regression Live Gate

Date: 2026-09-06

## FINAL STATUS — PASS
User explicitly confirmed:

`Gate RC1.3-D پاس شد`

Therefore:
- **RC1.3-D Automated / Server Regression = PASS**.
- **RC1.3-D User Live UI Gate = PASS**.
- **RC1.3 Final Accounting Polish visual gate = PASS**.
- Project phase moves to **RC1.3-RC / Feature Freeze**.
- No new feature work is permitted before the first Production promotion; only Blocker/Critical fixes are allowed.

## Automated / server-side regression evidence
- Multi-company/two-user RLS and multi-table isolation: PASS.
- Private Storage tenant isolation: PASS.
- Platform Admin / Company Admin / read-only Support separation: PASS.
- Company suspend/reactivate lifecycle: PASS.
- New Company onboarding/standard-chart initialization: PASS.
- Journal Draft → Posted → Reversed lifecycle: PASS.
- Invoice Draft → Posted → Reversed lifecycle: PASS after reversal-link integrity fix.
- Reports/runtime RPCs: PASS.
- Money display unit toggle: PASS.
- Fiscal period close/reopen: PASS.
- public SECURITY DEFINER executable by authenticated: 0.

## Final pre-RC verification — 2026-09-06
- Workspaces: 6.
- Accounts: 393.
- Journal entries: 30.
- Journal lines: 67.
- Invoices: 11.
- Ledger debit = credit = **201581351** canonical Toman.
- Orphan journal lines = 0.
- Unbalanced Posted/Reversed journals = 0.
- Reversed invoices with invalid/missing reversal journal link = 0.
- Companies without exactly 52 system level-2 (`معین`) headings = 0.
- Critical public tables without RLS = 0.
- `public` SECURITY DEFINER executable by `authenticated` = 0.

## Live UI evidence accepted by user
- Company Portfolio active-company behavior and switching: PASS.
- Company Portfolio action-layout correction: accepted within final Gate PASS.
- Journal detail totals/balanced presentation: accepted within final Gate PASS.
- Print layout corrections: PASS.
- List print/PDF: PASS.
- Single journal print/PDF: PASS.
- Single invoice print/PDF: PASS.
- Toman/Rial presentation and printed unit: PASS.
- iPhone/mobile behavior: accepted within final Gate PASS.
- Auth smoke: accepted within final Gate PASS after the temporary Auth regression was rolled back.

## Important RC blocker history
A Session-recovery change introduced a startup wait regression on desktop and iPhone. It was treated as an RC Blocker and rolled back before the final PASS.

Rollback commits:
- `38500077cc2fb9c3a055c4d53f4f69e0f20ac21e` — restore stable `supabase-auth.js`.
- `c8f1f13004d1e4a41bb4bf4c73b298f847026140` — restore stable `rc13-session-security.js`.

The Company Portfolio layout polish was retained because it is independent of Auth.

## Security Advisor
The only WARN remains **Leaked Password Protection Disabled**. This provider feature is not enabled on the current Free plan. Under the project's zero-charge policy this remains a documented provider limitation with application-level password-strength/denylist compensation; no paid upgrade is part of the current release path.

INFO-only RLS-no-policy notices on private control-plane tables and `workspace_invitations` are intentional deny-by-default / controlled-RPC boundaries.

## Backup / Restore distinction
- Free Transactional Recovery Rehearsal: **PASS**.
- Full external logical dump + Storage-byte restore into an isolated target: **OPEN / NOT FULL PASS** because no genuinely free isolated target is currently available.
- Never use a paid Supabase branch/project workaround under the current project cost policy.

## Next phase
See `avan-staging/RC1_3_RC_PROMOTION_GATE.md`.

Production/root promotion requires a separate explicit promotion decision. Passing RC1.3-D does **not** itself modify Production.