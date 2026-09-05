# RC1.3 — Final Accounting Polish + Operational/Security Gate

## A. Accounting / UX polish
1. Hard Refresh and open `شرکت‌های من`.
   - Active Company must show the non-clickable `شرکت انتخاب‌شده` indicator.
   - The old/misplaced `بازگشت به شرکت` action must not be rendered for the active Company.
   - Normal Company entry buttons still work for other Companies.
2. Open an existing accounting journal detail.
   - End of table must show `جمع کل` debit and credit.
   - Balanced document must show `✓ سند تراز است`.
   - An unbalanced draft must show the difference and must not be presented as balanced.
3. Print/save PDF for:
   - تراز آزمایشی / ترازنامه / سود و زیان or another financial report,
   - journal list and journal detail,
   - invoice list and invoice detail.
   `واحد مبالغ: تومان/ریال` and the unit on monetary table headers must be visible and match the active Company display preference.
4. Export a report CSV and verify monetary table headers include the active unit.
5. Switch Company display unit Toman ↔ Rial and repeat one print; unit must follow the active Company.
6. Open `حساب‌ها`.
   - Standard raw chart through level `معین` must exist across Assets/Liabilities/Equity/Income/Expenses.
   - Every current Company now has 52 system level-2 headings.
   - New headings must have no opening balance or artificial journal posting.
   - Existing custom accounts must remain unchanged.
   - Standard contra headings must carry the correct nature: accumulated depreciation/amortization = credit; treasury interests = debit.
7. A newly created Company must receive the same standard chart automatically through `private.ensure_standard_account_chart`.

## B. Session security smoke test
- Existing users must still be able to login normally.
- New Signup and password recovery must reject passwords that are under 12 characters or do not include letter + number + symbol.
- Very common local weak patterns in the Avan denylist must be rejected.
- Session guard is configured for 60-minute inactivity and 12-hour maximum browser session lifetime.
- Guard re-checks on focus, page restore, reconnect, visibility return and cross-tab security-marker change.
- Suspicious clock rollback/future timestamp drift beyond the configured tolerance forces re-authentication.

These controls are an application-level compensation. They are not a substitute for Supabase hosted advanced session controls when the project is moved to a plan that supports those controls.

## C. Database/accounting checks performed server-side — 2026-09-06
- Companies/Workspaces: 6.
- Accounts after standard-chart expansion: 393.
- System level-2 (`معین`) headings: 312 total = 52 per Company.
- Journal entries: 29.
- Journal lines: 65, unchanged by chart migration.
- Total debit = total credit = `201101351` canonical ledger amount at verification point.
- Level-2 headings referenced by journal lines = 0.
- Standard contra-account nature exceptions failing validation = 0.
- Orphan journal lines = 0.
- Unbalanced Posted/Reversed journals = 0.
- Posted/Reversed invoices without linked journal = 0.
- Storage objects baseline: 23.

## D. SECURITY DEFINER hardening performed
The goal is not to remove `SECURITY DEFINER` from functions that require privileged atomic accounting/tenant operations. The goal is to minimize it and surround retained functions with explicit authorization controls.

Completed in this pass:
- `get_money_display_unit(uuid)` → `SECURITY INVOKER`.
- `get_my_money_display_unit(uuid)` → `SECURITY INVOKER`.
- `set_my_money_display_unit(uuid,text)` → `SECURITY INVOKER`.
- `get_workspace_print_profile(uuid)` → `SECURITY INVOKER`.
- Added owner-scoped RLS for `workspace_user_preferences`.
- Added member-read RLS for `workspace_print_profiles`; direct browser writes remain revoked.
- Replaced broad `workspace_settings` ALL policy with authenticated member SELECT only; browser DML is revoked and guarded write RPCs remain the mutation boundary.
- Public/anon execution remains revoked on the converted RPCs; only `authenticated` receives EXECUTE.
- Public/auth schemas were verified non-creatable by `anon`, `authenticated` and `PUBLIC`, reducing search-path injection risk on retained legacy functions while they are reviewed individually.

Retained `SECURITY DEFINER` functions shown by Security Advisor are intentional privileged boundaries for one of these reasons: atomic journal/invoice posting, tenant creation/lifecycle, invitation/member management, fiscal close/reopen, guarded Company changes, RLS helper semantics or privileged read joins. They remain on the hardening allowlist until individually migrated without breaking RLS/ledger guarantees.

## E. Leaked Password Protection
- Supabase Security Advisor still reports `Leaked Password Protection Disabled`.
- Current built-in Supabase leaked-password screening is a paid-plan capability according to current Supabase Auth documentation.
- It has therefore **not** been falsely marked complete on the current Free tier.
- Compensation added now: signup + password-recovery minimum 12 characters, letter + number + symbol, plus rejection of a small local common-password denylist.
- This local rule is not equivalent to HIBP leaked-password screening and must be replaced/supplemented by the provider control after plan upgrade.

## F. Backup / Restore strategy and drill
See `BACKUP_RESTORE_RUNBOOK.md`.

Current status:
- Recovery strategy/runbook: UPDATED.
- Live pre-drill data/accounting baseline: PASS.
- True isolated restore drill: **BLOCKED / NOT RUN** because no no-cost isolated restore target + materialized logical dump is available through the current connected environment and no chargeable target has been authorized.
- Never run the drill against `Avan-production`.

The restore gate remains open until an actual dump + Storage backup is restored into an isolated target and the restore validation checklist passes.

## G. Provider limitations / remaining operational blockers
The current Supabase organization/project is recorded on **Free** tier. Therefore this Gate does **not** claim these provider controls are complete:
1. Supabase built-in Leaked Password Protection.
2. Hosted advanced session controls (time-box, inactivity timeout, single-session) — Avan currently has an application-level browser guard as compensation.
3. Production-grade managed backup/PITR configuration appropriate to the final RPO/RTO.
4. A true isolated restore drill.

## PASS phrase for the user-visible polish
`Gate RC1.3-FINAL-POLISH پاس شد`

Do not use the PASS phrase until the live staging UI/print checks in section A and the session smoke checks in section B have actually been executed after deployment. Operational/Security Completion must not be marked fully complete while the provider/restore blockers in sections E–G remain unresolved.
