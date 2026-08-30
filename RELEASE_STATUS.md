# Avan Core 1.0 — Final / Production Candidate

## Status
Accounting Core is release-candidate complete based on the live Gate B-4.1 and RC1 validation.

Passed live on the connected Supabase project:
- Email/password Auth
- Workspace bootstrap
- RLS workspace isolation with two independent users
- Cloud persistence across logout/login
- Chart of accounts CRUD/archiving rules
- Receipt / payment / transfer / opening operations
- Manual journal Draft save/edit/delete
- Balanced Post enforcement
- Posted journal immutability
- Reversal flow
- Fiscal period lock/reopen
- Journal, trial balance, account statement, P&L, balance sheet, cash/bank reports
- Core health/integrity checks
- Mobile navigation and manual-journal access

## Production-candidate changes vs RC1
No accounting/domain logic was changed.
Only release-facing changes were made:
- Removed RC1 label from UI/title
- `environment` changed from `staging` to `production`
- Production PWA cache namespace introduced
- Service Worker cache cleanup restricted to Avan Production caches only
- Public production page no longer carries `noindex,nofollow`

`app.js`, `cloud.js`, and `styles.css` are byte-identical to the live-tested RC1 build.

## No database migration required
If RC1 and the two-user RLS test passed on the current Supabase project, there is no new SQL migration for this package.

## Operational items before a public commercial launch
These do not block an employer/demo delivery of Core 1.0, but should be completed before broad public signup:
- Configure a custom SMTP provider in Supabase.
- Re-enable email confirmation after SMTP is verified, or otherwise restrict public signup.
- Set final Site URL / Auth redirect URLs for the production domain.
- Define backup/restore and retention procedures.
- Add legal/privacy/support material appropriate to the final service.

Current known temporary setting: Confirm Email was disabled for Gate testing because custom SMTP was not configured.
