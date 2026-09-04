# Avan Core 1.0 — RC1.1-E Refinements Gate

## E0 — Migration
Run `avan-staging/RC1_1_USER_PREFS_PATCH.sql` once in Supabase SQL Editor.
Expected: no error.

## E1 — Deploy secure password function
Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor.
Function name must be exactly:

`owner-set-user-password`

Paste the complete contents of:

`supabase/functions/owner-set-user-password/index.ts`

Deploy with JWT verification enabled (default). Do not put service-role or secret keys in the browser/config.js.

## E2 — Owner password management
1. Sign in as Workspace Owner.
2. Settings → Users & Access.
3. Active Admin/Accountant rows should have `تغییر رمز`.
4. Current Owner row must not have that button.
5. Other Owner rows must not have that button.
6. Set a new password (minimum 8 characters) for User B.
7. Sign out User B and verify login succeeds with the new password and fails with the old password.

## E3 — Accountant personal money unit
1. User A (Owner) choose Toman.
2. User B (Accountant) choose Rial in the same Workspace.
3. Refresh both sessions.
4. User A must remain Toman.
5. User B must remain Rial.
6. Switch User B back to Toman and confirm User A is unaffected.
7. If User B has multiple Workspaces, unit preference must stay independent per Workspace.

## E4 — Workspace duplicate labels
For a user with two Workspaces that have the same name (for example both `فضای مالی من`):
- the selector must disambiguate them with role suffixes, e.g. `فضای مالی من — مالک` and `فضای مالی من — حسابدار`.
- switching must still load the correct Ledger/data.

## E5 — Copy cleanup
Confirm these UI texts are no longer visible:
- Reports: Persian free-SQL explanatory sentence.
- Reports: `منبع معتبر: report_trial_balance`.
- Settings: Database posting sentence.
- Settings: PostgreSQL/LocalStorage sentence.
- Accounts: `کل / معین / تفصیلی — حساب دارای گردش حذف نمی‌شود.`
- Journal: `Draft → Posted → Reversed...` sentence.
- Invoices: direct double-entry Ledger explanatory sentence.

Do not expect any underlying validation/security behavior to change.

## E6 — Regression
- Dashboard opens.
- Draft journal save/delete works.
- Invoice draft works.
- Reports work.
- Rial/Toman conversion still preserves canonical values.
- Health orphan lines = 0.
- RLS cross-Workspace isolation remains intact.
- iPhone/mobile layout remains usable.

## PASS
`Gate RC1.1-E پاس شد`
