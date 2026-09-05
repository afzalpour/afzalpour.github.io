# RC1.3 — Final Accounting Polish + Operational/Security Gate

## A. Accounting / UX polish
1. Hard Refresh and open `شرکت‌های من`.
   - Active Company must show `شرکت انتخاب‌شده`, not the misplaced `بازگشت به شرکت` action.
   - Normal Company entry buttons still work for other Companies.
2. Open an existing accounting journal detail.
   - End of table must show `جمع کل` debit and credit.
   - Balanced document must show `✓ سند تراز است`.
3. Print/save PDF for:
   - تراز آزمایشی / ترازنامه / سود و زیان or another financial report,
   - journal list and journal detail,
   - invoice list and invoice detail.
   `واحد مبالغ: تومان/ریال` and the unit on monetary table headers must be visible and match the active Company display preference.
4. Switch Company currency Toman ↔ Rial and repeat one print; unit must follow the active Company.
5. Open `حساب‌ها`.
   - Standard raw chart through level `معین` must exist across Assets/Liabilities/Equity/Income/Expenses.
   - New headings must have no opening balance or artificial journal posting.
   - Existing custom accounts must remain unchanged.
6. Create one temporary Company from `شرکت‌های من` and inspect Accounts.
   - It must receive the same standard chart automatically.
   - Delete/archive the test Company afterward according to normal test procedure if it is not needed.

## B. Session security smoke test
- Existing users must still be able to login normally.
- New Signup weak password (<10 characters or without both letters and digits) must be rejected by Avan UI.
- Session guard is configured for 60-minute inactivity and 12-hour maximum browser session lifetime. These long-duration timers do not need to be waited out during the Live Gate; their configuration is code-reviewed and exposed as `window.AvanSessionSecurity`.

## C. Database/security checks already performed server-side
- Journal count: unchanged at migration verification point.
- Journal-line count: unchanged.
- Total debit = total credit = `201101351` canonical Toman at migration verification point.
- broken account roles = 0.
- newly inserted standard level-2 headings referenced by journal lines = 0.
- New Company transactional test: 46 total accounts / 33 system level-2 / 8 account roles / 2 financial accounts; transaction rolled back.
- Authorized report under `authenticated` returned rows; unrelated Company report returned zero rows.
- Internal trigger/helper SECURITY DEFINER functions are no longer executable by authenticated Browser users.
- Read-only report/integrity functions were changed to SECURITY INVOKER.
- Legacy direct `bootstrap_avan_workspace` and `create_workspace` browser execution was closed.

## D. Platform limitations / release blockers
The current Supabase organization is on **Free** plan.
Therefore this Gate does **not** claim these provider controls are complete:
1. Supabase built-in Leaked Password Protection — requires supported paid plan capability; current advisor still reports it disabled.
2. Hosted advanced session controls (inactivity/time-box/single-session) — paid-plan capability; Avan currently has an application-level browser guard as compensation.
3. Managed daily production database backup retention — Free project must use off-site logical `db dump`; Pro+ supplies managed daily backups.
4. A true restore drill is still pending until a dump is restored into an isolated project/approved target. Never run a restore drill on the live database.

See `BACKUP_RESTORE_RUNBOOK.md`.

## PASS phrase for the user-visible polish
`Gate RC1.3-FINAL-POLISH پاس شد`

Operational/Security Completion must not be marked fully complete while the provider/restore blockers in section D remain unresolved.
