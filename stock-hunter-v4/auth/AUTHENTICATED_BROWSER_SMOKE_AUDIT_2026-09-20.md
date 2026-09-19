# Stock Hunter 4.1.7 — Authenticated Browser / DOM Smoke

DATE: 2026-09-20
STATUS: LIVE_DEPLOYED_BROWSER_PASS

## Purpose

Validate the real published GitHub Pages 4.1.7 personal market surface with Chromium and a temporary real Supabase Auth user.

## Pre-smoke defect found

The first DOM audit found that `app-personal-v417.js` required personal account/watchlist controls that were missing from `index-v417.html`. This would cause authenticated startup to fail before Preferences or Watchlists could initialize.

The 4.1.7 staging HTML now restores the required personal bar:
- personal identity + role;
- Watchlist selector/count/create/filter;
- sync state;
- Profile/Admin navigation;
- Sign out.

4.1.6 `index.html` is unchanged.

## Browser path

The main-only workflow must:
1. wait until published `index-v417.html` bytes match the merged repository bytes;
2. obtain a GitHub Actions OIDC token scoped to the exact repository/workflow/main ref;
3. provision a temporary confirmed Auth user through the restricted self-test Edge Function;
4. launch Chromium against the public Pages URL;
5. verify unauthenticated redirect to the login page;
6. sign in with the temporary real user;
7. verify personal identity and normal-user role;
8. verify Admin link is hidden;
9. save page size / Hunt filter / decision filter and verify persistence after reload;
10. create a personal Watchlist;
11. add a real integrated-market symbol and verify persistence after reload;
12. verify Watchlist-only filtering;
13. directly open the Admin URL and verify normal-user denial;
14. remove the saved symbol;
15. sign out and verify the session is gone;
16. delete the temporary Auth user in an `always()` cleanup step using a fresh OIDC token.

## Self-test admin boundary

`stock-hunter-browser-smoke-admin-v417` is not a general Admin API. It accepts only GitHub OIDC from:
- repository `afzalpour/afzalpour.github.io`;
- repository id `1350071624`;
- owner id `221893601`;
- main ref;
- exact browser-smoke workflow ref.

Provisioning accepts only `stock-hunter-browser-smoke-<run>-<attempt>@example.invalid` addresses.
Cleanup refuses to delete any account whose email is outside that test-only pattern.

## Exit criteria

This audit becomes PASS only after the main-branch browser workflow succeeds against deployed Pages and cleanup succeeds.


## Live closure — 2026-09-20

Main run: `35469683809`
Browser job: `105968270925`
Merged main SHA under test: `d3ec56b8bbd37bca9575f69cd0e161731f509612`

Published-byte gate:
- full Auth/Personal/Admin Pages byte set matched repository bytes: PASS.

Real Chromium result:
- unauthenticated 4.1.7 redirect to login: PASS;
- password sign-in with temporary real Auth user: PASS;
- personal identity / role hydration: PASS;
- normal-user Admin link hidden: PASS;
- Preferences save + reload persistence: PASS;
- Watchlist create: PASS;
- add real integrated-market symbol: PASS;
- Watchlist-only filter: PASS;
- Watchlist item persistence after reload: PASS;
- direct Admin URL denied to normal user: PASS;
- saved-symbol removal: PASS;
- logout/session removal: PASS.

Machine result:
`{"result":"stock-hunter-v417-authenticated-browser-smoke: PASS","preference_persistence":true,"watchlist_create_add_reload_remove":true,"admin_isolation":true,"logout":true}`

Cleanup:
- workflow `always()` cleanup: PASS;
- post-run live DB count for `stock-hunter-browser-smoke-%@example.invalid`: 0.

## Defects found and fixed by the smoke

1. Missing personal controls in `index-v417.html` caused `app-personal-v417.js` startup failure risk.
   - fixed in PR #216.
2. `.admin-grid{display:grid}` overrode the HTML `hidden` attribute after a correct normal-user admin denial.
   - fixed with `.admin-grid[hidden]{display:none}` in PR #217.

The second defect was presentation-only: authorization was already denied before any admin data load.

## Final exit status

Authenticated Browser / DOM Smoke is **DONE / PASS** against the deployed public 4.1.7 staging surface.
