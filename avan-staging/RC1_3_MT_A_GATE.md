# RC1.3-MT-A — Multi-tenant Application Architecture Gate

## Purpose
Validate that Avan now has one authoritative CompanyContext for the whole browser application instead of multiple modules independently selecting the first Workspace.

This Gate is architectural. A visually correct Company selector is not enough: Company-scoped modules must change together and no data from the previous Company may remain mixed into the active one.

## MT-A-1 — Company Portfolio
Using the second user who is Owner of one Company and Accountant of another:

1. Hard Refresh.
2. In the topbar click **`شرکت‌های من`**.
3. Confirm the Portfolio lists every Company available to that User.
4. Each card must show:
   - Company display name
   - the User's role in that Company
   - which Company is currently active
5. Enter the Company where the User is Owner.
6. The app reloads and that Company becomes the single active context.

Expected:
- Portfolio is a level above the accounting Company app.
- It must not show journals/invoices from multiple Companies together.

## MT-A-2 — Synchronized Company switch
While the Owner Company is active, record a few identifying values:
- Company name in Settings
- role
- journal/invoice counts or recognizable records
- Activity Log rows
- Company Profile editability

Switch to the Company where the same User is Accountant.

Expected after reload:
- topbar Company and role change together
- Journals/Invoices/Documents/Accounts/Parties belong only to the newly active Company
- Reports belong only to the newly active Company
- Company Profile becomes read-only for Accountant
- Activity Log changes to the newly active Company
- User/access admin card is absent for Accountant
- no card/table from the previous Company remains stale

Any mixed Company state = FAIL / BLOCKER.

## MT-A-3 — Preference Context proof
This validates an old `limit=1 workspace` dependency no longer overrides the active Company.

1. In a Company where you may change Settings, set display unit to one value (for example Rial).
2. Switch to the other Company and use a different display unit (for example Toman), if your role allows changing it there. If not, simply verify the unit shown there matches that Company's existing preference.
3. Switch back and forth once.

Expected:
- money display preference follows the active Company/User context
- switching Company must never reset to the oldest/first Workspace merely because a legacy module used `limit=1`
- historical Ledger values are unchanged

## MT-A-4 — Profile + Audit share the same Provider
For the Owner Company:
- `مشخصات شرکت و چاپ` is editable
- Activity Log belongs to that Company

For the Accountant Company:
- Profile is read-only
- Activity Log excludes Company-admin/access events according to C1.1

Expected:
Both modules must follow the same Company shown in the topbar without independent Company selection.

## MT-A-5 — Session and access validation
1. Select one Company and Hard Refresh: it remains active in the same browser tab/session.
2. Logout and login with the other test User.

Expected:
- a stored Company id is never trusted if the newly logged-in User cannot access it
- only Companies authorized for the current User are listed
- no unauthorized Company data becomes visible even momentarily as an interactive screen

## MT-A-6 — iPhone / Mobile
On iPhone web mode:
- topbar Company selector remains usable
- `شرکت‌های من` opens Portfolio as a mobile bottom-sheet style surface
- all Company cards are touch usable
- no horizontal page drift
- Company switch reloads into the correct Company
- bottom navigation remains usable after selection

## MT-A-7 — Core regression
Inside at least one Company:
- Dashboard loads
- Journals load
- Invoices load
- Reports load
- Settings load
- Smart Documents page opens

No change was made to:
- canonical Toman storage
- Draft → Posted → Reversed lifecycle
- Posted immutability
- invoice posting semantics
- OCR freeze
- Company RLS schema from C1.2

## Architecture checks already completed in code
- one `AvanCloud` singleton per page
- one `cloud.companyContext` provider per page
- active Company validated only against the complete authorized Company list
- partial/`limit=1` legacy queries cannot clear or invent Company selection
- legacy single-workspace queries are scoped to active Company when one is selected
- User money preference resolver no longer picks the first Workspace independently
- Audit Log resolves active Company from CompanyContext
- Portfolio and topbar selector use the same Provider
- PWA cache: v35

## PASS phrase
`Gate RC1.3-MT-A پاس شد`
