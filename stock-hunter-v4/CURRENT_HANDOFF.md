# Stock Hunter — Current Handoff

Status date: 2026-09-19
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
1. Supabase Auth Site URL / Redirect allow-list is still incorrect (localhost redirect can occur).
2. Connected Supabase tooling does not expose Auth URL config mutation.
3. GitHub fallback workflow was attempted but repository has no `SUPABASE_ACCESS_TOKEN`; do not assume this path works until such a management credential is legitimately available.
4. Supabase Security Advisor reports Leaked Password Protection disabled. This is an Auth platform configuration item and remains pending.
5. A pre-existing private Canary RLS/no-policy INFO finding is outside the Auth scope; do not casually mutate canary lifecycle infrastructure to silence it.

## Feed snapshot
At 2026-09-19 17:18 UTC:
- last feed heartbeat: 2026-09-19 16:26:36 UTC;
- integrated max updated_at: 2026-09-19 16:26:34 UTC.
Treat these as a timestamped snapshot only; always re-check live state.

## NEXT ACTION
Unless the user gives a newer instruction:
1. Validate the staged 4.1.7 personal surface after merge/Pages deployment:
   - authenticated redirect behavior;
   - preference hydration/save;
   - Watchlist create/add/remove/filter;
   - owner Admin link;
   - no regression in 4.1.6.
2. Fix Supabase Auth Site URL / Redirect allow-list and Leaked Password Protection as soon as a Management API-capable path is available.
3. Run password-recovery/public Auth smoke after redirect configuration is corrected.
4. Continue statistical lifecycle collection; do not advance 4.1.7 routing until calibration/OOS/promotion/activation gates mature and pass.


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
- Remaining browser-specific validation is a human authenticated DOM smoke on `index-v417.html`.
