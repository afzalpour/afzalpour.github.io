# RC1.3-MT-P2 — SaaS Operations Live Gate

## Purpose
Verify the separation between **Platform Admin** and **Company Admin**, and verify that Tenant operational controls are enforced in PostgreSQL/RLS rather than only in the UI.

## A. Platform Admin operations
Using the Avan Platform Owner account:
1. Hard Refresh Staging.
2. Open **مدیریت سامانه آوان**.
3. Confirm each Tenant shows service status, plan, active members/member limit, onboarding state, support state and Registry health.
4. On a safe test Company, change plan/support/onboarding or member limit, enter a reason (minimum 5 characters), and save.
5. Refresh the Control Plane: the change must persist and a new Control Plane Audit event must appear.

## B. Suspend / Reactivate enforcement
Use only a safe test Company for this check.
1. In Platform Admin, set Tenant status to `تعلیق` with a clear reason and save.
2. Sign in as an Owner/Accountant of that Company.
3. The Company must remain visible in **شرکت‌های من** as suspended, but **ورود بسته است** must be disabled.
4. The suspended Company must not expose accounts, journals, invoices, documents or financial reports through the app.
5. The app must not silently bootstrap/create a replacement Company because the suspended Tenant is unavailable.
6. Return to Platform Admin and set the Tenant back to `فعال`, again with a reason.
7. Sign in as the Company user again: the same Company must be enterable and its pre-existing accounting data must return unchanged.

## C. Member limit enforcement
On a safe test Company:
1. Set Member Limit equal to its current active-member count.
2. As Company Owner/Manager, attempt to add/reactivate one more member.
3. The operation must be rejected; no extra active membership may be created.
4. Restore the desired Member Limit from Platform Admin.

## D. Authority separation
1. A normal Company Owner/Manager must not see **مدیریت سامانه آوان**.
2. Directly opening `platform-admin.html` as a normal Company user must show unauthorized state.
3. Platform Admin operations must not expose Ledger, invoice, document, account, party or financial-report data.
4. Company Owner/Manager continues to manage only the active Company's financial settings/users/data.

## E. Mobile
On iPhone/mobile:
- Platform Admin operations table remains usable with horizontal scrolling.
- Company Portfolio clearly shows suspended status and disabled entry.
- Reactivation restores normal Company entry.

## Expected confirmation
`Gate RC1.3-MT-P2 پاس شد`
