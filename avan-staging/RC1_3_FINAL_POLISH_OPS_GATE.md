# RC1.3 — Final Accounting Polish + Operational/Security Gate

Date: 2026-09-06

## FINAL STATUS
- Accounting / UX polish: **PASS**.
- User Live Gate: **PASS** through explicit `Gate RC1.3-D پاس شد` confirmation, which included the remaining Final Polish checks.
- Operational/Security free-scope hardening: **COMPLETE**.
- Free Transactional Recovery Rehearsal: **PASS**.
- Full external logical dump + Storage isolated restore: **OPEN / NOT FULL PASS**.
- Current phase: **RC1.3-RC / Feature Freeze**.

## A. Accounting / UX polish — PASS
Accepted behavior includes:
- Active Company card uses non-action `شرکت انتخاب‌شده`; misplaced active-card return action removed.
- Company switching works; owner/admin card action layout polished.
- Journal detail includes debit/credit `جمع کل` and balanced/unbalanced state.
- Print/PDF for journal/invoice lists and single details works.
- `واحد مبالغ: تومان/ریال` and money-header unit presentation works and follows Company preference.
- Printed list action column is removed where not useful.
- Journal/invoice list alignment polish accepted.
- Technical lifecycle subtitles removed from user/print output.
- Standard chart exists through level `معین`; exactly 52 system level-2 headings per Company and standard headings are non-postable/raw.
- New Company initialization receives the same standard chart.

## B. Session security
Stable accepted RC behavior:
- Existing-user login works.
- Signup/password-recovery UI enforces minimum 12 characters + letter + number + symbol and local weak-password denylist.
- Application guard remains 60-minute inactivity / 12-hour maximum browser session with clock-skew protection.

A later attempt to add revoked-session auto-recovery caused an RC startup blocker and was fully rolled back before final PASS. Stable Auth/Session files were restored; no experimental session-recovery change remains in the accepted RC.

## C. Final accounting/server baseline — 2026-09-06
- Workspaces: 6.
- Accounts: 393.
- Journal entries: 30.
- Journal lines: 67.
- Invoices: 11.
- Ledger debit = credit = **201581351** canonical Toman.
- Orphan journal lines = 0.
- Unbalanced Posted/Reversed journals = 0.
- Reversed invoices with invalid/missing reversal link = 0.
- Companies without exactly 52 system level-2 headings = 0.
- Critical public tables without RLS = 0.
- `public` SECURITY DEFINER executable by `authenticated` = 0.

## D. SECURITY DEFINER hardening — COMPLETE FOR CURRENT BROWSER BOUNDARY
- Browser-facing public privileged RPCs use SECURITY INVOKER wrappers.
- Privileged implementation functions remain in `private` where required for atomic accounting/tenant operations.
- `public.has_workspace_access` and `public.workspace_role` are SECURITY INVOKER.
- Current authenticated-executable public SECURITY DEFINER count = **0**.

## E. Leaked Password Protection — TRACKED FREE-TIER LIMITATION
Supabase Security Advisor still reports `Leaked Password Protection Disabled`.

Under the project's standing **zero-charge policy**:
- this provider control is **not** a current release dependency;
- no paid upgrade/branch/project is part of the release path;
- Avan keeps its application-level password-strength/common-password compensation;
- this limitation remains documented accurately rather than being mislabeled as fixed.

If the project cost policy is explicitly changed in the future, provider controls can be reassessed then; no upgrade is assumed or planned here.

## F. Backup / Restore
See `BACKUP_RESTORE_RUNBOOK.md`.

- Recovery strategy/runbook: COMPLETE.
- Free Transactional Recovery Rehearsal: PASS.
- True external logical dump + Storage-byte restore into isolated target: **OPEN / NOT RUN** because no genuinely free isolated target is currently available.
- Never execute a restore drill against `Avan-production` itself.
- Never use a paid Supabase branch/project workaround under the current policy.

## G. Security Advisor baseline
- No new public authenticated SECURITY DEFINER warning.
- INFO-only RLS-no-policy notices on private control-plane tables and `workspace_invitations` are intentional deny-by-default / controlled-RPC boundaries.
- Only WARN remains provider leaked-password protection disabled.

## Release transition
Final Polish is closed. Continue only under:

`avan-staging/RC1_3_RC_PROMOTION_GATE.md`

No new features are permitted during RC1.3-RC; only Blocker/Critical fixes may change the accepted candidate before Production promotion.