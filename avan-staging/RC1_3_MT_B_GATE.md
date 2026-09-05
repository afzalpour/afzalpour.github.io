# RC1.3-MT-B — Company Lifecycle / Onboarding Gate

## Purpose
Validate that Avan can create a real independent Company tenant through the Company Portfolio, with Owner assignment, fiscal setup, standard Core accounts, Company profile and immediate CompanyContext selection.

## Pre-check
- Hard Refresh so PWA cache v36 is active.
- Use the second test user (already Owner of one Company and Accountant of another).

## MT-B-1 — Create Company
1. Open **شرکت‌های من**.
2. Confirm **＋ ایجاد شرکت جدید** exists.
3. Create a new Company with a distinctive name, for example `شرکت تست MT-B`.
4. Fill optional legal name / entity type / province / city.
5. Keep or set fiscal year name/date range and money display unit.
6. Submit **ایجاد و ورود به شرکت**.

Expected:
- no browser SQL or manual database action is needed.
- Company is created once and the app reloads into that Company.
- current user's role is **مالک**.
- Company appears as an independent item in **شرکت‌های من**.

## MT-B-2 — Fresh Tenant Core
Inside the new Company verify:
- Dashboard loads.
- Settings shows the new Company identity.
- fiscal year exists and is open.
- standard chart of accounts exists.
- Cash and Bank financial accounts exist.
- no Journals, Invoices, Parties or Smart Documents from old Companies are visible.

Any old-Company financial data in the new Company = FAIL / BLOCKER.

## MT-B-3 — Company identity/profile
1. Open Settings → مشخصات شرکت و چاپ.
2. Confirm onboarding values (display/legal name and supplied operational fields) belong to the new Company.
3. Change one optional Company profile field and save.
4. Return to **شرکت‌های من**.

Expected:
- only the active Company's profile changes.
- other Companies remain unchanged.

## MT-B-4 — Rename
1. In **شرکت‌های من**, for a Company where the current user is Owner/Manager, click **تغییر نام**.
2. Rename the newly created test Company.

Expected:
- Portfolio name changes.
- active Company selector uses the new name.
- Company display identity remains synchronized.
- Accountant-only Company must not expose rename action to this user.

## MT-B-5 — Company switching regression
Switch among:
- the new Owner Company,
- the user's prior Owner Company,
- the Company where the user is Accountant.

Expected for every switch:
- Company name + role change together.
- Ledger/Invoices/Documents/Accounts/Parties/Reports remain scoped only to active Company.
- Company admin controls appear only where role allows.
- no stale rows/cards remain from another Company.

## MT-B-6 — iPhone
On iPhone web mode:
- Company Portfolio opens normally.
- Create Company button is usable.
- onboarding form fits viewport and fields are touch-friendly.
- Company switching remains usable after creation.
- bottom navigation still works.

## Backend checks completed before Live Gate
- `create_avan_company`: PUBLIC=false, anon=false, authenticated=true.
- `rename_avan_company`: PUBLIC=false, anon=false, authenticated=true.
- private core initializer: PUBLIC=false, anon=false, authenticated=false.
- transaction test created and rolled back a temporary tenant with:
  - 1 active Owner
  - 1 fiscal year
  - 19 standard accounts
  - 2 financial accounts
  - independent Company profile
- no test tenant persisted after rollback.
- PWA cache: v36.

## PASS phrase
`Gate RC1.3-MT-B پاس شد`
