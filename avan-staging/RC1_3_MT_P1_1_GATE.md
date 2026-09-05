# RC1.3-MT-P1.1 — Platform Admin Entry Session Revalidation Gate

## Regression fixed
The Platform Admin entry previously checked authorization only once on DOMContentLoaded. If the page initially held a normal-user or logged-out session and the Platform Owner logged in later on the same page, the entry was never revalidated.

## Gate
1. Hard refresh while logged out.
2. Login as Platform Owner. `مدیریت کل آوان` must appear without another hard refresh.
3. Logout and login as a normal Company Owner/Accountant. The Platform Admin entry must not appear.
4. Logout again and login as Platform Owner. The entry must reappear in the same browser tab/session flow.
5. Open `platform-admin.html` and confirm Control Plane still loads for Platform Owner.
6. Direct `platform-admin.html` as normal user must remain unauthorized.

PASS only after explicit user confirmation.