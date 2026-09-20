# Stock Hunter — Current Handoff

Status date: 2026-09-20
Purpose: deterministic continuation across new chats.
This file is a rolling handoff, not the immutable architecture contract.

## Continuity trigger
Canonical:
`SHIKAR-417-CONTINUE-CANONICAL`

Legacy compatibility alias:
`ادامه پروژه شکار سهم — SHIKAR-417-CANONICAL-CONTINUE`

## Production / champion
- Production champion: Stock Hunter 4.1.6.
- Frozen scoring engine: `4.1.6-hunt-v2`.
- Main UX contract: Action Now → Radar → Universe.
- Default table: fresh `شکار ویژه` + `هشدار فوری`.
- Radar: up to 8 fresh `شکار زودهنگام`.
- Universe/search remains full-market and independent of Hunt eligibility.
- Approved visual identity remains frozen.
- Do not change 4.1.6 formulas/thresholds/lifecycle gates except explicit user authorization.

## 4.1.7 lifecycle safety
Live snapshot at 2026-09-19 17:18 UTC:
- prospective collection: COLLECTING;
- shadow samples: 12 total (5 reversal, 7 acceleration);
- calibration_ready: false;
- OOS unlock eligible: false;
- OOS unlocked: false;
- routing: CHAMPION_ONLY;
- challenger traffic: 0%;
- kill switch: engaged;
- active v417 capture callers: 0.

Do not activate challenger merely because UI/Auth implementation is complete.

## Auth / profile state
Implemented:
- Supabase Auth foundation;
- roles: owner_admin / admin / user;
- exactly one owner_admin guard;
- verified owner bootstrap completed;
- own-only Profile / Preferences / Watchlists;
- admin audit table;
- staged Auth/Profile pages;
- secure Edge Function `stock-hunter-admin-v417` with `verify_jwt=true`;
- staged admin console;
- server-side role changes and suspend/reactivate;
- owner protection;
- restrictive account-status RLS for suspended users.

Live Auth snapshot:
- Auth users: 1;
- owner_admin count: 1;
- suspended users: 0;
- admin audit rows: 1.

Do NOT store the owner's email or other personal identifiers in this public repository handoff.

## Auth tests completed
- Owner bootstrap: PASS.
- Database RLS cross-identity drill: PASS.
- Suspended-account restrictive RLS drill: PASS.
- Two-user real-session isolation self-test: PASS.
  - two temporary real Auth users were created;
  - two real sessions/JWTs were used;
  - cross-user Profile read/update blocked;
  - cross-user Watchlist read/insert blocked;
  - self role escalation blocked;
  - normal user Admin API access blocked;
  - suspended existing-JWT access blocked;
  - cleanup PASS; zero temporary test users remain.

## Personal application integration
Implemented on the 4.1.7 staging surface:
- authenticated `index-v417.html`;
- Profile identity shown in the market UI;
- Preferences hydrate/save page size, Hunt filter, decision filter, visible columns, theme and sound setting;
- personal Watchlist selector;
- create Watchlist from main UI;
- ☆/★ save/remove directly on market rows and mobile cards;
- optional "only Watchlist" market filter;
- Admin link exposed only for owner_admin/admin;
- 4.1.6 `index.html` remains unchanged and ungated.

## Known blockers / platform settings
1. Supabase Auth Site URL / Redirect allow-list remains a hosted-platform blocker; current connector does not expose Auth config mutation. The Management API workflow run `35455470843` failed because `SUPABASE_ACCESS_TOKEN` was unavailable.
2. Supabase Leaked Password Protection remains disabled. Current Supabase docs state it requires Pro plan or above; this project previously returned a platform error that Branching is unavailable because the plan is below Pro.
3. Password-recovery/public redirect smoke remains blocked until the hosted redirect configuration is corrected.
4. A pre-existing private Canary RLS/no-policy INFO finding is outside the Auth scope; do not casually mutate canary lifecycle infrastructure to silence it.

## Feed snapshot
At 2026-09-19 19:24 UTC:
- last feed heartbeat: 2026-09-19 16:26:36 UTC;
- integrated max updated_at: 2026-09-19 16:26:34 UTC.
The market/feed is no longer fresh at this late-evening snapshot; this is not an Auth failure.
Treat these as a timestamped snapshot only; always re-check live state.

## NEXT ACTION
Unless the user gives a newer instruction:
1. Continue genuine prospective collection toward the first maturity horizon after sessions 2026-09-20/21/22; do not advance routing before real maturity evidence.
2. Keep Auth Site URL/redirect and Leaked Password Protection explicitly platform-blocked until a legitimate Management API/Dashboard + plan-capability path is available.
3. After redirect configuration is corrected, run password-recovery/public Auth smoke.
4. Historical robustness/backtests may be prepared or rerun only as supporting analysis; they must never substitute for prospective maturity/OOS evidence.


## Personal UI merge checkpoint
- PR #207 merged to main.
- main commit: `b0cce246fbcd5d4bbdfc9936908f0c0130cd999d`.
- GitHub Pages build/deploy: PASS.
- Public Production Smoke for 4.1.6 Champion: PASS.
- 4.1.6 `index.html` blob remains `ea833fe20a75e11bb71bcf52abeaafeed46dec0a` (unchanged by this step).
- `index-v417.html` is the authenticated personal staging surface.
- Remaining validation for this step: authenticated browser smoke using a real human session; current tooling cannot reproduce the owner's password/session and must not fabricate one.


## Authenticated personal data-flow smoke
- PASS on 2026-09-19 with a temporary real Auth user and real session.
- Preferences create/read/update path: PASS.
- Protected preference timestamp client-write denial: PASS.
- Watchlist create/add/read/delete path: PASS.
- Profile last_seen update: PASS.
- Cleanup: PASS; zero temporary users remain.
- Self-test Edge Function resealed with verify_jwt=true.
- Client bug fixed: browser no longer sends protected `updated_at` in Preferences writes.
- Authenticated deployed browser/DOM smoke is now PASS.


## Personal public deployment smoke
- Public smoke workflow extended to fetch and byte-compare `index-v417.html`, `app-personal-v417.js`, and `personal-v417.css` from GitHub Pages.
- It explicitly rejects a browser Preferences payload that writes protected `updated_at`.
- Workflow remains read-only.
- Live Supabase SQL EOD verification was attempted after market close, but the connected SQL tool was unavailable due connection timeout; do not interpret that as an EOD quality failure.


## First real EOD live closure
- Official `verify-first-day-eod-quality-v416.sql`: LIVE PASS after the 2026-09-19 EOD deadline.
- Execution path: GitHub OIDC → `stock-hunter-ci-live-check-v417` → direct Postgres, READ ONLY.
- Workflow run: `35465143770`.
- No EOD invariant violation was found.
- This PASS does not unlock Calibration/OOS/Promotion/Activation.
- Next statistical gate: first maturity horizon after the three future sessions 2026-09-20, 2026-09-21, 2026-09-22; verifier deadline 2026-09-22 14:55 UTC.


## Final Hunt parity / control-plane proof
- Browser ↔ deployed `stock-hunter-capture-v416` final parity revalidation: PASS.
- Parity workflow run: `35466587854`.
- Current deployed capture backend version: 6.
- Control-plane START atomicity on real transition function: PASS.
- Control-plane ADVANCE atomicity on real transition function: PASS.
- Control-plane ROLLBACK atomicity on real transition function: PASS.
- Real two-connection advisory-lock/state-version contention races: PASS (5/5).
- Isolated race schema and one-time Vault token deleted.
- Race self-test Edge Function resealed with `verify_jwt=true`.
- production_state_after_cleanup: CHAMPION_ONLY / 0% / kill-switch ON / state_version=1.
- Next engineering hardening item: Capture Backend Security hardening without changing 4.1.6 Hunt formulas or prospective provenance.


## Capture backend HMAC hardening
- Status: DONE / PASS.
- Active Edge Function `stock-hunter-capture-v416`: version 6.
- Auth contract: `VAULT_HMAC_NONCE_V2`.
- Static capture secret is no longer sent on the wire.
- pg_cron signs each request with timestamp + UUID nonce + HMAC-SHA256 using the Vault key.
- timestamp freshness window: ±180 seconds.
- nonce ledger rejects replay atomically.
- live signed invocation: HTTP 200 / outside-market-window.
- replay validator drill: PASS.
- cron jobs 15/16/17 preserve schedules and now invoke only `private.invoke_stock_hunter_capture_v416()`.
- raw-secret cron commands: 0.
- external deployed security/parity workflow run `35467654427`: PASS.
- Main Integration run `35467690043`: PASS.
- Security Advisor: no Capture finding.
- `verify_jwt=false` remains intentional for this pg_net service-to-service endpoint; in-code HMAC authorization is mandatory before claim/scan/write.


## Authenticated deployed browser smoke
- Status: DONE / PASS.
- Main workflow run: `35469683809`.
- Browser job: `105968270925`.
- Public Pages bytes matched repository before test execution.
- Real temporary Auth user + Chromium: login PASS.
- Personal identity/role hydration: PASS.
- Preferences save/reload persistence: PASS.
- Watchlist create/add/filter/reload/remove: PASS.
- Normal-user Admin link hidden: PASS.
- Direct Admin URL denial: PASS.
- Logout/session removal: PASS.
- Cleanup: PASS; live temporary browser user count = 0.
- Two UI defects discovered by the smoke were fixed in PR #216 and PR #217.
- Production routing remained CHAMPION_ONLY / 0% / kill-switch ON / state_version=1.
- Remaining Auth platform blockers: Site URL/redirect allow-list, Leaked Password Protection, then password-recovery/public Auth smoke.


## Legacy market-scan source hardening
- `stock-hunter-market-scan-v4` deployed version 2.
- `verify_jwt=false` retained with the existing custom `x-scan-secret` caller contract.
- raw 64-character caller secret removed from deployed source.
- source now stores only SHA-256 digest and hashes the supplied header before comparison.
- caller transport and accepted secret value were intentionally preserved because an external caller may exist.
- repository search: no caller found.
- pg_cron search: no caller found.
- live negative auth: missing secret 401; wrong secret 401.
- positive external caller activity was not independently observed.


## Live lifecycle snapshot — 2026-09-20
- prospective state: COLLECTING.
- shadow samples: 12 total (5 reversal / 7 acceleration).
- mature calibration samples: 0.
- calibration_ready: false; reason: نمونه بالغ ۳ جلسه‌ای کافی نیست.
- OOS can_unlock: false; OOS unlocked: false.
- activation: CHAMPION_ONLY / 0% challenger / kill switch ON / state_version=1.
- latest integrated market update observed: 2026-09-19 16:26:34 UTC.
- Do not substitute historical backtests for the required prospective three-session maturity evidence.


## Live first maturity gate
- OIDC read-only bridge upgraded to deployed version 2.
- Original First-Day EOD path regression-tested on bridge v2: PASS (run `35465143770`, re-run job `105974476473`).
- Missing/invalid OIDC requests are rejected with 401.
- New purpose `first-maturity-horizon-v416` is bound to exact main workflow and hard-blocked before `2026-09-22 14:55 UTC`.
- Scheduled operational attempt: 2026-09-22 15:05 UTC, with historical-date guard.
- No lifecycle/routing mutation is performed by this bridge.
- First maturity result remains PENDING until the actual horizon.


## Canonical/Auth document repair — 2026-09-20
- PR #221 restored `AUTH_PROFILE_V417_ARCHITECTURE.md` as the dedicated Auth/Profile implementation contract after the accidental PR #200 overwrite.
- Main Integration Gate: PASS.
- Merge SHA: `f46a99cde9795fbef80405345a0a0650587b954f`.
- Documentation-only repair; no runtime, scoring, routing, lifecycle or Supabase state changed.

## Edge Auth hardening — 2026-09-20
- Status: LIVE_HARDENING_PASS.
- `stock-hunter-local-ingest-v4` deployed version 3.
- Local Feed caller contract remains `x-feed-key`, but the plaintext accepted key is no longer embedded in deployed source; only a SHA-256 digest is stored and the presented header is hashed before comparison.
- Local ingest deployed SHA-256: `ec28a00699ebd33546b7f91b74950ad95716df0e5d205c6eb3cfc46f11068974`.
- `stock-hunter-capture-v417` deployed version 2.
- Dark v417 Capture now rejects the legacy static-token header and uses the existing replay-resistant HMAC timestamp + nonce validator `stock_hunter_validate_capture_request_v416`.
- v417 Capture deployed SHA-256: `066cc265d990a9673aff0d755acebe142a89170e0479616ea2fc76fe4974a543`.
- Deployed sources exactly match the reviewed repository sources.
- Post-deploy workflow `35492777241`: contract PASS and live-negative PASS.
- v417 parity remains PASS on 9 frozen fixtures.
- Missing/legacy/forged v417 Capture callers return 401.
- Missing/wrong Local Feed callers return 401.
- Main Integration run `35492777243`: PASS.
- 4.1.6 scorer/formulas/thresholds and production routing were not changed.
- 4.1.7 remains dark/no-traffic; this security repair does not authorize lifecycle advancement.

## Immediate continuation checkpoint — 2026-09-20
- First genuine statistical gate remains the 4.1.6 first maturity horizon.
- Earliest legitimate verifier deadline: `2026-09-22 14:55 UTC`.
- Canonical scheduled operational workflow: `2026-09-22 15:05 UTC`.
- Until then, keep 4.1.6 as frozen Champion and keep 4.1.7 fail-closed.
- In parallel, Auth hosted blockers remain Site URL/redirect allow-list, Free-plan Leaked Password Protection limitation, then password-recovery/public redirect smoke.
