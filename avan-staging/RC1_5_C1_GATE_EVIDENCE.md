# RC1.5-C.1 — Tax Admin, Persian UX & Custom Reports

Status: **Engineering PASS / Live PASS pending**

Applied database migration:
- `rc1_5_c1_tax_admin_rules_and_custom_reports`

## Tax architecture
- Standard VAT profile is no longer year-coded; active Company profiles use `VAT_STD`.
- Standard VAT profiles use `rate_mode='rule'` and `rule_code='IR_GENERAL_VAT'`.
- Exempt / zero-rate profiles are fixed zero-rate profiles and are not tied to a yearly rule version.
- `public.resolve_tax_rule(rule_code, date)` resolves the effective active version by document date.
- `private.apply_invoice_tax_snapshot` resolves the effective rule using invoice date before snapshotting rate/rule/amount.
- Existing invoice snapshots remain historical source of truth; published/reversed documents are not recalculated from current rules.
- Browser users cannot insert/update/delete `tax_rule_versions` directly.

### Platform tax rule center
- Platform Admin may create a Draft rule version.
- Only `platform_owner` may publish a Draft rule.
- Publishing a newer version may close the prior open/overlapping effective interval at the day before the new version starts; it never overwrites the prior rate or historical invoice snapshots.
- Platform audit records Draft creation and publication.

### Future-year transactional rehearsal
A synthetic future rule was inserted only inside a transaction and rolled back:
- 1405 date (`2026-09-08`) resolved to **10%**.
- synthetic 1406 date (`2027-04-01`) resolved to **7%**.
- synthetic rule rows retained after rollback: **0**.

## Persian-only UX
- Platform Admin page rewritten with Persian user-facing terminology.
- Runtime Persian guard translates known legacy/backend English summaries before rendering.
- Known examples covered: Journal posted/reversed, Document uploaded/status transitions, Inventory financial bridge events, Invoice draft/post events, Workspace/Core/Posting/Database/Session/Support/Platform Admin terminology.
- Unknown technical details remain console-only rather than intentionally exposed as user copy.

## Tax settings singleton
- C.1 runtime keeps only one Tax/VAT settings card and removes duplicate async-render instances.
- Company settings show the rule effective today rather than treating a mutable single rate as canonical.

## Custom report builder v1
New Company-scoped table:
- `public.custom_reports`

RLS:
- report is always scoped to a Company the user can access;
- private reports are visible to their creator;
- Company reports are visible to authorized Company members;
- creator or Company owner/manager may update/delete as allowed by policy.

Safe semantic report sources in v1:
- Invoices
- Journal entries
- Receipts / payments / transfers
- Parties

`public.run_custom_report(...)` is SECURITY INVOKER and only exposes predefined fields. No arbitrary SQL is accepted from the browser.

Authenticated rehearsal (transaction + rollback):
- authenticated Company member could create a private custom report under RLS: PASS.
- temporary custom reports retained after rollback: **0**.

## Integrity after C.1
- Ledger debit = **4,073,481,351 Toman**.
- Ledger credit = **4,073,481,351 Toman**.
- orphan journal lines = **0**.
- unbalanced Posted/Reversed journals = **0**.
- Companies with Tax enabled = **0**.

## Frontend/PWA
- `src/ui/tax/tax-date-aware.js`
- `src/ui/localization/persian-runtime-guard.js`
- `src/ui/reports/custom-report-builder.js`
- `platform-tax-rules.js`
- `rc15-c1-bootstrap.js`
- `rc15-c1.css`
- Staging Service Worker cache bumped to `avan-staging-rc1-v68-c1`.

Production-root application runtime is not promoted by this gate. Live acceptance must be done in Staging before Production promotion.
