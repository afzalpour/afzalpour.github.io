# RC1.3-C1.2 — Company Context & Settings UX Gate

## Purpose
Validate ADR-0014 in the live Staging UI: a user may belong to multiple independent companies, one Company is explicitly active at a time, same-company financial records are shared by authorized members, and cross-company data never leaks.

## C1.2-1 — Active Company selector
Using the second user who is Accountant in one Company and Owner in another:
- Hard Refresh / reopen the web app.
- Confirm topbar shows `شرکت فعال`.
- Confirm both authorized Companies are available in the selector.
- Each option shows Company display name and the user's role in that Company.
- Switching Company reloads the app and keeps the chosen Company active.

## C1.2-2 — Same-company shared ledger is intentional
Select the Company where the second user is `حسابدار`:
- Journals/invoices/documents created by the Owner/Admin of that same Company are visible.
- This is expected: financial records belong to Company, not to the creator user.
- Accountant must not gain Company-admin actions merely because records are visible.

## C1.2-3 — Cross-company isolation
Switch the same user to the Company where they are `مالک`:
- Journals from the other Company are absent.
- Invoices from the other Company are absent.
- Smart Documents from the other Company are absent.
- Parties/accounts are the active Company's own data.
- Reports only reflect the active Company.

Any record from Company A visible while Company B is active = BLOCKER / FAIL.

## C1.2-4 — Company Profile ownership
On the Company where the user is Owner:
- Settings → `مشخصات شرکت و چاپ` is editable.
- Change `نام نمایشی شرکت`, save, and confirm the selector uses the new display name.

Switch to a Company where the same user is Accountant:
- `مشخصات شرکت و چاپ` is read-only.

## C1.2-5 — Settings order
Settings top section must appear in this order:
1. `حساب کاربری`
2. `مشخصات شرکت و چاپ`
3. `کاربران و دسترسی‌ها` when the active role may manage users
4. `واحد پول`

Other operational cards follow below. No flicker/re-render loop.

## C1.2-6 — Mobile / iPhone
- `شرکت فعال` fits the topbar without horizontal page drift.
- Selector is usable with touch and does not trigger Safari focus zoom.
- Company switching works from iPhone web mode.
- Settings cards remain usable after switching.

## Database verification already completed
- `journal_lines` Company-parent mismatch before migration: 0.
- Composite Company FKs added for journal/account/party relationships.
- Legacy tautological RLS condition fixed for insert/update/delete Draft policies.
- Post-migration mismatch counts remain 0.

## PASS phrase
`Gate RC1.3-C1.2 پاس شد`
