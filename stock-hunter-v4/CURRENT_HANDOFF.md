# Stock Hunter — Current Handoff

Status date: 2026-09-19
Purpose: deterministic continuation across new chats.
This file is a rolling handoff, not the immutable architecture contract.

## Continuity trigger
Use:
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
Live snapshot at 2026-09-19 16:54 UTC:
- prospective collection: COLLECTING;
- shadow samples: 12 total (5 reversal, 7 acceleration);
- calibration mature samples: 0;
- calibration_ready: false;
- OOS unlock: false;
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
- RLS cross-identity drill using authenticated-role JWT-claim simulation: PASS.
  - other identity could see 0 owner Profile rows;
  - 0 owner Role rows;
  - 0 owner Watchlist rows;
  - UPDATE owner Watchlist: 0 rows;
  - DELETE owner Watchlist: 0 rows.
- Temporary Watchlist fixture cleanup: PASS, 0 remaining.
- Suspended-account restrictive RLS drill: PASS.
  - Profile visible: 0;
  - Role visible: 0;
  - Preferences visible: 0.
  - test was transactional and rolled back.

Important: these are database-level authenticated-role isolation drills. The release gate still requires at least two distinct real Auth sessions before final Auth release.

## Known blockers / platform settings
1. Supabase Auth Site URL / Redirect allow-list is still incorrect (localhost redirect can occur).
2. Connected Supabase tooling does not expose Auth URL config mutation.
3. GitHub fallback workflow was attempted but repository has no `SUPABASE_ACCESS_TOKEN`; do not assume this path works until such a management credential is legitimately available.
4. Supabase Security Advisor reports Leaked Password Protection disabled. This is an Auth platform configuration item and remains pending.
5. A pre-existing private Canary RLS/no-policy INFO finding is outside the Auth scope; do not casually mutate canary lifecycle infrastructure to silence it.

## Feed snapshot
At 2026-09-19 16:54 UTC:
- last feed heartbeat: 2026-09-19 16:26:36 UTC;
- integrated max updated_at: 2026-09-19 16:26:34 UTC.
Treat these as a timestamped snapshot only; always re-check live state.

## NEXT ACTION
Unless the user gives a newer instruction:
1. Continue 4.1.7 personal application integration:
   - connect signed-in Profile/Preferences to the staged 4.1.7 application surface;
   - connect personal Watchlists/saved symbols to market rows;
   - keep 4.1.6 production ungated and unchanged.
2. When a second and third real non-owner Auth account can be created/confirmed, run real-session two-user RLS negative tests.
3. Test admin negative authorization and suspend/reactivate end-to-end with a non-owner account.
4. Fix Auth redirect configuration and Leaked Password Protection as soon as a Management API-capable path is available.
5. Only after Auth gates and statistical lifecycle gates pass may 4.1.7 proceed toward activation/canary.
