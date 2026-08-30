# Production smoke test — Avan Core 1.0

Run after uploading the Final Candidate to the GitHub Pages root.

1. Open the root URL in Incognito/Private mode.
2. Confirm title/branding is `آوان` and the sidebar shows `Core 1.0` (no RC/Staging label).
3. Login with the already-tested primary user.
4. Confirm Dashboard loads without an error toast.
5. Open Accounts and confirm the existing account tree is visible.
6. Open Reports and load:
   - Journal
   - Trial balance
   - Account statement
   - Profit & loss
   - Balance sheet
   - Cash/bank balances
7. Open Settings → Core health and verify:
   - Unbalanced Posted journals = 0
   - Orphan lines = 0
   - Visible Workspace = 1
8. Create one temporary manual Draft, save it, edit it, then delete the Draft before posting. This checks write access without adding a permanent accounting transaction.
9. Logout and login again. Existing production data must still be present.
10. On mobile width, open `＋ ثبت` and confirm `سند دستی` is available.

PASS criteria: all ten steps succeed and no data from the second RLS test user is visible.
