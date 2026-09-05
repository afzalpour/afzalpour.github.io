# RC1.3-MT-P1 — Platform Admin Control Plane Gate

## Purpose
Verify that Avan now has a separate SaaS operator plane for the owner/admin of the platform, distinct from Company Owner/Manager roles.

## Preconditions
- Hard Refresh staging.
- Use the designated Avan Platform Owner account for positive tests.
- Use a normal Company Owner/Manager account for negative authorization tests.

## Gate A — Platform Owner entry
1. Sign in with the Platform Owner account.
2. A button titled `مدیریت کل آوان` must appear in the application top bar.
3. Open `شرکت‌های من`; `کنترل‌پنل ادمین آوان` must also be available there.
4. Open the Control Plane.
5. Page title must be `مدیریت کل سامانه` and access state must say Platform Owner/Admin is authorized.

## Gate B — Metadata-only overview
The Control Plane must show:
- total Companies/Tenants
- active Companies
- total Auth users
- active Company memberships
- onboarding/suspended/archived counts
- active Platform Admin count

The Company table must show metadata only:
- Company/display name
- owner email when present
- active member count
- tenant status
- registry health
- created date

It must NOT expose:
- Journal entries or journal lines
- invoices or invoice lines
- accounting documents
- chart of accounts
- parties/customer balances
- Ledger amounts or financial reports

One legacy Company may currently show `مالک ثبت نشده`; this is an intentionally surfaced operational finding, not a hidden failure.

## Gate C — Normal Company Admin isolation
1. Sign out and sign in with a normal Company Owner/Manager account that is NOT Platform Admin.
2. `مدیریت کل آوان` must not appear.
3. If `platform-admin.html` is opened directly, it must display that the account has no Platform Admin access.
4. Company Owner/Manager privileges inside their own Company must still work normally.

## Gate D — Regression
- Company Portfolio still works.
- Company switching still works.
- accounting pages still load normally.
- Platform Admin page is a separate shell and does not replace Company App.
- iPhone/mobile can open the Control Plane and return to Avan.

## DB verification already completed before merge
- Platform Owner authorization: PASS.
- Normal Company Owner `platform_admin_me.authorized=false`: PASS.
- Normal Company Owner direct overview call: rejected with `PLATFORM_ADMIN_REQUIRED`.
- public `platform_admin_*` wrappers: SECURITY INVOKER, anon execute=false, authenticated execute=true.
- Control Plane function references to Ledger/Invoice/Documents/Accounts/Parties: 0.
- registry count and listed Companies both resolve to 5; 1 legacy registry finding is visible.

## PASS phrase
`Gate RC1.3-MT-P1 پاس شد`
