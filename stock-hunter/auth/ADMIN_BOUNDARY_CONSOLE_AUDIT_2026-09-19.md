# Admin Boundary / Console Audit — 2026-09-19

Status: IMPLEMENTED / RELEASE GATE PARTIAL

## Implemented
- Edge Function `stock-hunter-admin-v417` deployed with `verify_jwt=true`.
- Function validates the calling Auth user and authoritative role before privileged operations.
- Browser never receives service-role/secret credentials.
- Supported server-side actions:
  - minimal user listing;
  - owner-only role changes between `admin` and `user`;
  - suspend/reactivate with owner protection;
  - owner-only admin audit listing.
- Sole `owner_admin` cannot be suspended or demoted through the API.
- Delegated `admin` cannot manage another admin.
- Every role/suspend/reactivate mutation writes an admin audit event.
- Suspension uses Supabase Auth ban plus `account_status=suspended`.
- Restrictive RLS policies deny suspended accounts access to Role/Profile/Preferences/Watchlists immediately even while an already-issued access JWT is still within its expiry window.
- Staged `admin-v417.html` console added. It is not a production login gate for 4.1.6.

## Still required before 4.1.7 Auth release
- Correct Supabase Auth Site URL / Redirect allow-list (Management API token currently unavailable to connected tooling).
- Create at least two distinct non-owner Auth test users.
- Execute cross-user RLS negative tests and admin authorization negative tests with real sessions.
- Exercise suspend/reactivate against a non-owner test user and verify refresh/sign-in denial.
- Password recovery end-to-end after redirect configuration is corrected.
- Public-production Auth smoke.
