# Personal 4.1.7 Authenticated Data-Flow Smoke — 2026-09-19

Status: PASS

Test id: `17c6a673-31fa-4448-9a2a-cc8b0161169c`

A temporary real Supabase Auth user was created and signed in with a real password session. The test exercised the same RLS/column-privilege paths used by the staged 4.1.7 personal market surface.

PASS assertions:
- temporary Auth user created;
- real authenticated session created;
- Profile auto-provisioned and active;
- default Role = user;
- Preferences auto-provisioned;
- allowed Preferences update succeeded:
  - theme;
  - page size;
  - visible columns;
  - Hunt filter;
  - decision filter;
  - sound preference;
- direct client write to protected `updated_at` was denied;
- personal Watchlist created;
- real market symbol added using `ins_code`;
- Watchlist item read back through the same user session;
- Watchlist item/list deleted;
- Profile `last_seen_at` update succeeded.

Cleanup:
- test user deleted;
- zero temporary personal-smoke users remain;
- self-test control disabled;
- `stock-hunter-auth-selftest-v417` redeployed sealed with `verify_jwt=true`.

Implementation correction discovered before smoke:
- `app-personal-v417.js` was sending `updated_at` in the Preferences browser update even though that column is intentionally not client-writable.
- The client payload was corrected to only send explicitly granted fields. Security permissions were not weakened.

Remaining browser-specific validation:
- interactive DOM smoke with a human authenticated session on GitHub Pages.
This cannot be fabricated without a real browser session/password and is distinct from the now-PASS authenticated backend/data-flow smoke.
