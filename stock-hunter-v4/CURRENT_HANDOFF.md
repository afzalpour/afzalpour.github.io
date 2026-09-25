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


## No-data closure checkpoint — 2026-09-20

### Supabase data-plane incident
- A read-only external diagnostic reproduced the 4.1.6 browser failure against the canonical project.
- Diagnostic workflow run `35495501455`, attempt 1: both `stock_hunter_integrated_v1` and `stock_hunter_feed_health_v4` returned HTTP 503 / `PGRST002` (`Could not query the database for the schema cache. Retrying.`).
- Direct management SQL also showed connection refusal/timeouts during the incident.
- Diagnostic attempt 2 later returned HTTP 200 for both browser REST reads, confirming REST/Data API recovery.
- The latest persisted `local-agent` heartbeat observed after REST recovery was still `2026-09-19 16:26:36.56+00`, agent `4.0.5`, 500 symbols.
- Therefore the Supabase read outage recovered, but a fresh post-incident Feed Agent send remains unproven and requires the local Agent process to reconnect/restart.
- Incident audit: `feed-security/SUPABASE_DATA_PLANE_INCIDENT_AUDIT_2026-09-20.md`.
- Do not rotate the Feed key or modify 4.1.6 to compensate for this availability incident.

### 4.1.6 rollback identity refresh
- Drift found: preserved rollback metadata/source still referenced capture-v416 deployment v5 and the legacy auth contract while the live frozen Champion capture component is v6/HMAC+nonce.
- Live `stock-hunter-capture-v416`: ACTIVE, deployment version 6, SHA-256 `b483eb96911ebb938e87564fd75e8a6cbcbad7d5a4fb087b9eab5120dd7a75af`.
- Live source is byte-identical to `capture-security/stock-hunter-capture-v416/index.ts`.
- Rollback archive source and final-freeze rollback identity were refreshed to exact v6 + `VAULT_HMAC_NONCE_V2`.
- Live migration `stock_hunter_release_rollback_v6_sync_20260920`: PASS.
- Live final-freeze function verified to contain rollback deployment version 6, current v6 SHA-256 and HMAC+nonce contract.
- Post-migration state remained `CHAMPION_ONLY / 0% / kill switch ON / state_version=1`; no activation review, release manifest, freeze authorization or rollback archive was created.
- PR #224 merged; merge SHA `e1568febb79f9dafba0d9ec4a041de2317375ac7`.
- Post-merge Capture-v417 Dark Deploy Contract run `35498712244`: PASS.
- Post-merge Final Release Pinning Contract run `35498712240`: PASS.
- Audit: `release/rollback-v416/ROLLBACK_V416_V6_SYNC_AUDIT_2026-09-20.md`.

### FK performance hardening
- Supabase Performance Advisor reported four lifecycle/release foreign keys without covering indexes.
- Live migration `stock_hunter_performance_fk_indexes_20260920`: PASS.
- Added covering indexes for activation authorization consumption `review_id` and release-manifest `component_attestation_id`, `proposal_id`, and `activation_review_id`.
- Post-DDL Performance Advisor: `unindexed_foreign_keys` = 0.
- Remaining `unused_index` notices are INFO only and are expected for fail-closed/pre-activation lifecycle tables; do not delete those indexes merely because usage is currently zero.
- PR #225 merged; merge SHA `98b8f16b4c83ba995f772836199d518f947ed627`.
- Audit: `security/PERFORMANCE_FK_INDEX_AUDIT_2026-09-20.md`.

### Public deployment after no-data hardening
On main SHA `e1568febb79f9dafba0d9ec4a041de2317375ac7`:
- Public Production Smoke run `35498712230`: PASS.
- GitHub Pages build/deployment run `35498711586`: PASS.
- No production 4.1.6 scorer/formula/threshold asset was intentionally changed by these hardening steps.

### Security Advisor
After the rollback DDL, no new Stock Hunter WARN/ERROR was introduced.
Known remaining findings:
- INFO: RLS enabled with no policy on private/API-denied `private.stock_hunter_canary_expansion_authorizations_v417`; do not add a cosmetic allow policy.
- WARN: Supabase Leaked Password Protection disabled; hosted Pro-plan capability blocker.

### Read-only live snapshot PR
- PR #223 remains OPEN and must not be merged yet.
- The proposed snapshot remains aggregate-only and read-only, but live regression encountered database connect/statement timeouts during the Supabase instability window.
- The experimental bridge was rolled back after testing.
- Live `stock-hunter-ci-live-check-v417` is restored to exact `main` source as deployment version 7, SHA-256 `6716d469eb2d0ede5754bdfff06ba55f0116d251a7974aeb00848f66522d9044`.
- Revisit PR #223 only when the canonical verifier can complete reliably; snapshot functionality must never make or bypass a lifecycle decision.

### Remaining blockers / next eligible work
The no-data engineering/hardening items above are closed. Remaining meaningful work is blocked by one of:
1. fresh real market/feed evidence, including confirmation that the local Feed Agent reconnects after the incident;
2. the genuine three-future-session maturity horizon, earliest legitimate verifier deadline `2026-09-22 14:55 UTC`;
3. hosted Supabase Auth configuration / plan capability for redirect allow-list and Leaked Password Protection;
4. later lifecycle evidence and explicit authorization gates; no challenger traffic may be enabled early.

4.1.6 remains the frozen production Champion. 4.1.7 remains fail-closed.


## Data-plane recurrence — 2026-09-20 17:13–17:16 UTC

The earlier REST recovery was not stable.

Revalidation evidence:
- live OIDC bridge experimental attempt 7: canonical First-Day EOD verifier PASS, but optional snapshot timed out after verifier PASS; no lifecycle bypass occurred.
- live OIDC bridge experimental attempt 8: failed before verification with direct Postgres `CONNECT_TIMEOUT db.summnepwuziwulzvpcms.supabase.co:5432`.
- independent read-only public REST diagnostic run `35495501455`, attempt 3:
  - `stock_hunter_integrated_v1`: 30-second timeout, HTTP 000, zero response bytes;
  - `stock_hunter_feed_health_v4`: 30-second timeout, HTTP 000, zero response bytes.
- Supabase public status page at the same time reported API Gateway = Degraded Performance, while eu-central-1 and Database were reported Operational.
- management-plane project state may therefore appear healthy while the project data plane is intermittently unavailable.

Safety actions:
- experimental `stock-hunter-ci-live-check-v417` deployment rolled back immediately;
- live bridge is exact `main` source again as deployment version 10, SHA-256 `6716d469eb2d0ede5754bdfff06ba55f0116d251a7974aeb00848f66522d9044`;
- PR #223 remains HOLD and must not be merged until both the mandatory verifier and observational snapshot succeed in one stable window;
- no 4.1.6 scoring/routing/feed credential change was made as an outage workaround.

Operational conclusion:
- the current hard blocker is Supabase data-plane availability;
- the stale Feed Agent heartbeat cannot be interpreted until the ingest/data-plane path is stable;
- do not synthesize missing prospective data or advance maturity/lifecycle gates because of this outage.


## Data-plane recovery closure — 2026-09-20 20:42–20:50 UTC

The recurring Supabase data-plane incident recovered without using project pause/restore.

Actions executed through the connected Supabase management/database tooling:
- direct PostgreSQL connectivity revalidated successfully;
- official PostgREST reload signals executed:
  - `NOTIFY pgrst, 'reload schema'`;
  - `NOTIFY pgrst, 'reload config'`;
- independent public REST diagnostic run `35495501455`, attempt 4:
  - `stock_hunter_integrated_v1`: HTTP 200;
  - `stock_hunter_feed_health_v4`: HTTP 200.
- full project restart was not executed because the connected management tool exposes pause/restore but no true restart operation, and the data plane had already recovered. Pause/restore was intentionally not used as a restart substitute.

### Canonical read-only snapshot bridge
PR #223 was reworked to avoid heavyweight lifecycle-computation views and now reports sanitized operational base state/counts only.
Final live regression:
- Edge deployment version 14;
- SHA-256 `5b90c51a783f6d733ef361e4fdf035b4da235bd791e48d69ff08f1c4900e43d6`;
- workflow run `35465143770`, attempt 12, job `106146921421`;
- mandatory First-Day EOD verifier: PASS;
- OIDC safety contract: PASS;
- snapshot transaction: READ ONLY;
- snapshot_error: null.
PR #223 merged; merge SHA `1e15b7e754869d9407fd8d15a5b7fb32a87b8ecb`.
Live `stock-hunter-ci-live-check-v417` source is byte-identical to current `main`.

Post-merge on SHA `1e15b7e754869d9407fd8d15a5b7fb32a87b8ecb`:
- Public Production Smoke `35536790405`: PASS;
- First-Day EOD `35536790367`: PASS;
- First-Maturity contract `35536790363`: PASS;
- GitHub Pages `35536789463`: PASS.

### Current remaining feed condition
The Supabase data plane is responsive again, but local Feed Agent freshness is still not restored:
- last local-agent heartbeat: `2026-09-19 16:26:36.56+00`;
- latest signal update: `2026-09-19 16:26:34.718+00`;
- fresh 180-second signal rows at final snapshot: 0.

This is now a separate local-device/agent reconnection issue rather than an active Supabase REST outage. Do not rotate the Feed key and do not alter 4.1.6 provenance/scoring to compensate.

Production safety remains:
- 4.1.6 frozen Champion;
- CHAMPION_ONLY;
- challenger traffic 0%;
- kill switch ON;
- no OOS manifest, promotion, activation review or release pin created.


## Local Feed Agent UI repair — v4.0.6 prepared / client smoke pending — 2026-09-21

User-reported symptom:
- `Stock_Hunter_Feed_Agent_v4.0.5.exe` repeatedly enters Windows `Not Responding` after launch/click interaction, including after PC reboot.

Binary diagnosis:
- canonical v4.0.5 artifact recovered from project Library;
- PE32+ Windows GUI x86-64, Go 1.23.2, module `stockhunteragent`;
- native Win32 message loop exists but `main.main` did not call `runtime.LockOSThread`;
- network client already uses a 25-second timeout and scan work runs from a background goroutine;
- current local-ingest endpoint/header/credential contract in the binary still matches the hardened server contract.

Repair:
- prepared `Stock_Hunter_Feed_Agent_v4.0.6.exe`;
- input v4.0.5 SHA-256: `09ef9015c6370192b684d81a018eaac50ce49c4c16fd2ccb2a318777e8909211`;
- output v4.0.6 SHA-256: `a43ccddce0f71df02ddeea1f1d0efcd77a79727dcec0506ec8dcf30454d1c458`;
- exactly one existing no-arg/no-return startup callsite was retargeted from the initial cosmetic `main.refreshAutoButton` call to `runtime.LockOSThread`;
- embedded version marker changed from 4.0.5 to 4.0.6;
- total binary byte differences: 4;
- endpoint, X-Feed-Key contract, accepted credential bytes, market/scoring/feed serialization logic remain unchanged;
- reproducible patch script and audit live under `feed-agent-repair/`.

Distribution:
- v4.0.6 EXE and ZIP published to the project Library under `/نرم افزار شکار سهم/`.
- do not overwrite/delete v4.0.5 yet; retain it as rollback evidence.

Required next evidence:
- fully terminate v4.0.5 in Windows Task Manager;
- launch v4.0.6;
- verify UI remains responsive;
- verify live Supabase heartbeat advances and reports `agent_version=4.0.6`.

Until that client smoke passes, this repair remains PREPARED / CLIENT_SMOKE_PENDING. No 4.1.6 scoring/routing/lifecycle state changed.


## Market-open feed guard — 2026-09-21

Live session evidence:
- Feed Agent v4.0.6 produced one successful 500-symbol batch.
- server-reported agent version: `4.0.6`.
- last feed heartbeat: `2026-09-21 06:07:21.677+00`.
- latest signal update: `2026-09-21 06:07:18.232+00`.
- public REST/Data API is healthy: diagnostic run `35495501455`, attempt 5, integrated + feed-health HTTP 200.
- deployed Pages/runtime is healthy: Public Production Smoke `35538341215`, attempt 2 PASS.

Prospective integrity issue discovered while Feed was stale:
- today's Shadow samples joined to current source rows: 296;
- definitely stale-over-180 samples: 146;
- affected IDs: `1280..1425`;
- affected bucket: `585`;
- prior bucket `570`: 150 samples with max source age 46 seconds and zero proven stale-over-180.
- no rows were deleted, modified, fabricated or backfilled.

Temporary fail-closed action:
- `stock-hunter-capture-v416-mid` job id 16 was changed from active=true to active=false only.
- schedule remains `* 6-12 * * 0-3,6`.
- command remains `select private.invoke_stock_hunter_capture_v416();`.
- re-enable only after live Feed heartbeat and 180-second row freshness are restored.

Temporary local recovery helper:
- `Stock_Hunter_Feed_Watchdog_v4.0.7.zip`
- SHA-256 `b1ef976eaec3e8e471f7ef97024116835b22ebcf0fea43b49cf318bc38c12055`
- Library path `/نرم افزار شکار سهم/Stock_Hunter_Feed_Watchdog_v4.0.7.zip`.
- Watchdog contains no Feed secret; it only reads public feed-health and restarts the unchanged v4.0.6 executable when heartbeat remains stale.

Do not advance maturity or treat the 146 proven stale-over-180 rows as clean prospective evidence until the canonical maturity review resolves them.
4.1.6 remains Champion; routing remains CHAMPION_ONLY / 0% challenger / kill switch ON.


## Capture-v416 per-row freshness live closure — 2026-09-21

User explicitly authorized PR #231 and the per-row 180-second freshness guard.

Completed:
- PR #231 merged at `24a02d6e8178adf786b20d609b951439a6329c8a`.
- live `stock-hunter-capture-v416` deployed as version 7.
- live bundle SHA-256: `49f8a9a666b60801b670f4784404293bb3e0bbfee8b70d07a36a7d992fa31740`.
- live source is byte-identical to repository main.
- capture now selects source `updated_at` and queries only rows with `updated_at >= now - 180 seconds` before Hunt evaluation.
- HMAC timestamp+nonce authorization is unchanged.
- formulas, thresholds, score components, routing and 4.1.7 traffic are unchanged.

Live signed proof:
- request id 742 -> HTTP 200.
- scanned 752 fresh rows; 3 Hunt Events recorded; 218 Shadow rows recorded.
- stale-over-180 among new Shadow rows: 0.
- scheduled job 16 re-enabled with the exact existing schedule/command.
- first scheduled run after re-enable succeeded at 07:45 UTC.
- 245 new Shadow rows checked; stale-over-180: 0; capture last_error: null.

Pre-fix contaminated cohorts are preserved as evidence and are not silently clean:
- sample IDs 1280..1425: 146 rows proven stale-over-180.
- 07:34 pre-fix capture: 74 rows proven stale-over-180; observed stale ID range 2448..2732.
Do not fabricate/backfill replacements. Maturity review must explicitly account for these cohorts.

Safety remains:
- 4.1.6 frozen Champion.
- CHAMPION_ONLY / 0% challenger / kill switch ON / state_version 1.
- first maturity horizon remains time-gated; this fix does not advance lifecycle state.


## Capture-v416 v7 rollback identity sync — 2026-09-21

After live deployment of capture-v416 v7, the preserved rollback/future final-freeze identity was refreshed to avoid a stale v6 rollback package.

Live rollback identity:
- capture deployment version: 7
- capture bundle SHA-256: `49f8a9a666b60801b670f4784404293bb3e0bbfee8b70d07a36a7d992fa31740`
- capture auth contract: `VAULT_HMAC_NONCE_V2`
- archived rollback Edge source is exact v7 source and contains the per-row 180-second freshness guard.

Live final-freeze function definition now pins the same v7 identity.
No final-freeze invocation occurred.
No release manifest, freeze authorization or rollback archive was created.
Routing remains `CHAMPION_ONLY / 0% challenger / kill switch ON / state_version 1`.

The v4.1.7 capture remains dark and was not deployed or activated by this sync.


## Shadow Sample quality quarantine — 2026-09-21

Live non-destructive quarantine applied before future maturity/calibration can consume the known pre-v7 incident data.

Ledger:
- `public.stock_hunter_shadow_sample_exclusions_v416`
- immutable after insert; RLS enabled
- total exclusions: 438
- 146 rows from the 06:15:06 UTC burst: all proven >180s stale
- 292 rows from the 07:34:39 UTC pre-v7 mixed burst: conservatively quarantined because 74/292 were proven stale but the exact stale IDs were not durably retained

Calibration:
- live `stock_hunter_calibration_dataset_v416` now excludes ledger samples
- quarantined rows currently visible in Calibration: 0
- OOS frozen snapshot rows: 0, so quarantine is in force before any one-shot OOS freeze
- no source Shadow Sample was deleted, overwritten, fabricated or backfilled

Maturity:
- first maturity on 2026-09-22 concerns the 2026-09-19 cohort and is not numerically altered by the 2026-09-21 quarantine
- first/rolling maturity verifiers now explicitly fail if a quarantined sample leaks into Calibration
- direct full-verifier execution immediately after DDL encountered Postgres connection timeouts; classify as data-plane availability, not verifier failure

Safety remains 4.1.6 Champion / CHAMPION_ONLY / 0% challenger / kill switch ON / state_version 1.


Quarantine verifier closure:
- first-maturity verifier: PASS
- rolling-maturity verifier: PASS
- the earlier connection timeout was transient and did not represent a maturity/quarantine invariant failure.


## Pre-first-maturity readiness — 2026-09-21

- first cohort 2026-09-19: 12 Shadow Samples / 8 eligible.
- all 8 eligible samples are missing a 2026-09-20 outcome observation; 2 are also missing 2026-09-21 observation.
- no backfill/fabrication is permitted.
- current Calibration rows: 0.
- required downstream cron coverage:
  - 2026-09-20: 5/5 successful job names.
  - 2026-09-21: repaired to 5/5 after candidate evaluator `job startup timeout`.
- candidate evaluator recovery run succeeded at 2026-09-21 14:55 UTC; canonical schedule restored immediately.
- candidate evaluation runs remain 0 because calibration is not ready.
- first-maturity verifier and rolling-maturity verifier both PASS pre-horizon with the quality-quarantine contract active.
- tomorrow's first-horizon verifier may legitimately PASS with zero mature rows; this must not be interpreted as Calibration readiness or lifecycle advancement.


## Search responsiveness + typeahead — 2026-09-21

PR #235 prepares one shared Search UX fix for both 4.1.6 public and 4.1.7 personal surfaces.

Implementation:
- removed synchronous full `render()` from search input events;
- 110 ms debounced result rendering;
- local full-Universe typeahead with up to 10 symbol/company suggestions;
- exact/prefix matches rank ahead of contains matches;
- Persian/Arabic normalization;
- pointer/touch + Arrow Up/Down + Enter + Escape support;
- ARIA combobox/listbox semantics;
- server Universe search retained only as fallback while the local catalog is unavailable;
- periodic market refresh avoids competing with an immediately active keystroke;
- modified shared assets use cache-buster `4.1.6-search1`.

No Hunt score/formula/threshold, routing, lifecycle, Feed or Auth write behavior is changed.


## Local-First recovery checkpoint — 2026-09-23
- User priority: finish as quickly as possible with zero paid dependency.
- Supabase project management plane reports ACTIVE_HEALTHY while PostgreSQL still returns TCP ECONNREFUSED; support tickets SU-482131 / SU-482142 are open.
- Free-plan overage is Egress with grace period through 2026-10-22; that is separate from the current Postgres process outage.
- New primary live path: patched Agent v4.0.7 LocalFirst -> loopback bridge 127.0.0.1:41716 -> browser local-first REST.
- Supabase is retained only as fallback/legacy evidence until recovery; it is no longer required for live 4.1.6 market availability.
- Frozen 4.1.6 Hunt formulas/thresholds/routing/lifecycle remain unchanged.
- Local bridge archives one compressed point-in-time snapshot per 15-minute bucket for future empirical validation; no synthetic/backfilled prospective rows are created.


## Eco feed recovery checkpoint — 2026-09-23
- v4.0.7 Local-First Agent+Bridge is DEPRECATED after a real client run showed unacceptable bandwidth/CPU pressure and a misleading 500-live-row ceiling.
- Root cause: legacy Agent architecture repeatedly fetched full MarketWatch plus many concurrent per-symbol enrichment calls and a hot-symbol loop; live MarketWatch rows were also conflated with the complete Universe.
- Replacement: single-process `Stock_Hunter_Eco_Bridge_v4.0.8.exe`, loopback-only on 127.0.0.1:41716.
- Eco cadence: bulk MarketWatch /30s, bulk ClientTypeAll /120s, bounded per-symbol fallback, cached history, GOMAXPROCS=2, BelowNormal launcher priority.
- Full instrument Universe is independent from live rows, cached locally, refreshed at low frequency, and exposed through paginated local REST.
- Browser fixes: preserve `snapshots` for frozen 4.1.6 Delta, make explicit All Symbols use the full Universe catalog, and route Detail/Search hotfixes through the active local-first base.
- 4.1.6 Hunt formulas/thresholds/models/routing/lifecycle remain unchanged.


## Eco Detail fallback checkpoint — 2026-09-24
- Real client confirmed Eco Bridge v4.0.8 starts quickly and without the v4.0.7 resource freeze.
- Remaining UI bug: complete-Universe symbols could open with no analytical record when live-feed ID differed from Universe ins_code or the symbol had no current live row.
- Repair: exact-ID + normalized-symbol live matching, then one-symbol daily-history fallback if no genuine live analytical row exists.
- Historical-only Detail never fabricates Hunt Score/QI/OFI/entry/stop.
- Eco scan cadence and frozen 4.1.6 Hunt formulas remain unchanged.


## Eco Governor v4.0.9 checkpoint — 2026-09-24
- Real client v4.0.8 status: Universe 4267 (full-catalog repair confirmed), rows 0 outside trading hours, 36 MarketWatch scans, last decoded MarketWatch payload 3,574,135 bytes.
- rows=0 outside market is expected; the remaining defect was unnecessary 30-second MarketWatch polling while all configured sessions were closed.
- v4.0.9 Governor keeps active Eco v4.0.8 only Sat-Wed 08:20-17:05 Tehran and otherwise serves Universe from a passive localhost cache bridge with zero external MarketWatch/ClientType polling.
- Passive mode deliberately exposes no live rows, so stale off-hours data cannot become actionable.
- Package SHA-256: 39c7640a9a754b2e3fd37d49aa27ce76d7e1175417a560b3b239eb3e0a029991.
- Frozen 4.1.6 Hunt formulas/thresholds/routing/lifecycle remain unchanged.


## Replay Backtest v4.1.0 checkpoint — 2026-09-24
- Added a standalone Windows replay/backtest package that scans genuine local point-in-time archives from LocalFirst/Eco/Replay directories.
- It reports DIAGNOSTIC_REPLAY_OK / LIMITED / INSUFFICIENT_SINGLE_POINT / NO_DATA and never fabricates missing intraday data.
- Diagnostic same-day outcomes: reversal later reaches >=0%; acceleration later reaches >=+1%; these do not replace prospective OOS/lift validation.
- Added localhost-only 15-minute recorder for future complete-session replay; it skips when Live rows=0 and makes no external request itself.
- Package SHA-256: b3077fe1ef4f4b5353576a5f595bc715938b55e1d06d5baae8a616b13af14da5.


## Replay Diagnostics v4.1.2 checkpoint — 2026-09-24
- First real replay found 4 archives / 3 distinct times / 523 symbols but 0 candidates.
- v4.1.0 quality labeling was too permissive because it did not require in-session/Delta-ready/Huntable observations.
- v4.1.2 now reports exact Tehran archive times, in-session/off-hours counts, valid price-volume, Delta-ready, Huntable, mode counts and gate/rejection distributions.
- Zero candidates is interpretable only after those data-quality gates pass.
- Package SHA-256: 77fa9a628bd34cce77cfe3515fbe684d53f79473421ee86ff2d8580e4f08e6f0.


## Historical Cache/Resume v4.1.8 checkpoint — 2026-09-24
- First real 2026-09-23 historical objective run: 2294 daily rows, 957 shortlist, 300 trade requests, 211 success, 89 failed, 208 reversal + 199 acceleration events, 42,702,776 decoded bytes.
- v4.1.8 persists gzip cache + resumable ledger under %LOCALAPPDATA%\StockHunterHistorical.
- Bootstrap imports all 407 prior objective events and marks 209 event-bearing prior symbols covered; 91 first-300 items remain targeted-retry candidates.
- Continue mode starts after prior slot 300 in 75-symbol batches; retry-first mode handles unresolved first-300 items in 40-symbol batches.
- ClientTypeHistory is not used in point-in-time scoring because it is day-level and would risk look-ahead.
- Historical BestLimits is deferred to a separate stateful delta carry-forward reconstruction after trade-history coverage.
- ZIP SHA-256: d4914650bf8c46d94279b33c2e568e8622fa59c006c509789724345614f8635b.
- Frozen production 4.1.6 Hunt formulas/thresholds/routing/lifecycle unchanged.


## Historical Cache/Resume v4.1.9 checkpoint — 2026-09-24
- Real v4.1.8 batch: 75 candidates, 71 success, 4 failed, 7,636,441 network bytes; ledger resolved 280/957; accumulated 277 reversal + 263 acceleration.
- Identified starvation risk: failed post-300 symbols could be reselected before unseen symbols in normal continue mode.
- v4.1.9 separates queues: continue=fresh-only post-300; retry-first=unresolved first 300; retry-post=failed post-300.
- Added AUTO_CONTINUE_3_BATCHES_20260923 with max 3 fresh batches and 15-second cooldown.
- Persistent ledger/cache remains under %LOCALAPPDATA%\StockHunterHistorical.
- ZIP SHA-256: 558f35a039e366116db9cd13af24c7189e9fffb9d3f3459ccf31419cff215075.
- Frozen production 4.1.6 Hunt formulas/thresholds/routing/lifecycle unchanged.


## Historical Cache/Resume v4.2.1 checkpoint — 2026-09-24
- v4.2.0 classified all 15 post-300 unresolved symbols as terminal NO_TRADES, then failed only during HTML rendering because Report lacked LedgerNoTrades.
- Ledger is saved after every symbol; the classifications should persist despite the report error.
- v4.2.1 fixes the struct/template mismatch, adds offline report rebuild mode, and adds a report-smoke selftest.
- ZIP SHA-256: 843b3c394a2a11fd7308d5cd8d0988982e051f07fcd5c20862f04d579a76f9bb.
- Frozen production Hunt 4.1.6 remains unchanged.


## Cloud-first production superseding checkpoint — 2026-09-24

This checkpoint supersedes older feed-topology recommendations while preserving all frozen Hunt/lifecycle invariants.

Canonical architecture document:
`CLOUD_PRODUCTION_ARCHITECTURE_CANONICAL.md`

Continuity ID:
`SHIKAR-CLOUD-IRAN-EGRESS-V1`

### Confirmed production requirements
- Owner PC must not be required for production.
- Mobile and multiple public users must work independently of the owner's computer.
- Treat TSETMC as Iran-egress-only.
- Foreign cloud must never directly depend on TSETMC.
- Production live path becomes Iran Collector -> signed cloud ingest -> shared cloud state/scoring -> PWA/users.
- Collector sends market facts only; it does not calculate Hunt.
- Exact Frozen Hunt 4.1.6 must be reused in cloud only after browser/server parity proof.
- All storage layers have hard caps; no unbounded database or local archive.

### Supabase incident / architectural consequence
Project `summnepwuziwulzvpcms` entered a PostgreSQL restart loop with `pg_wal/xlogtemp...: No space left on device`.
- public Data API returned PGRST000/PGRST002 / 503;
- direct SQL returned connection refused;
- project Restart did not recover PostgreSQL;
- Pause failed because the pre-pause backup could not complete;
- Table Editor could not load schemas/tables;
- Supabase recovery is a side track and is no longer a blocker for Stock Hunter production architecture.

### New implementation branch
`stock-hunter-cloud-architecture-v1`

Implemented scaffold:
- Iran collector protocol v1;
- Python MarketWatch/ClientType facts collector;
- bounded local spool;
- HMAC transport;
- Cloudflare ingest verifier;
- Durable Object sequence/replay coordination;
- R2 latest snapshot;
- cloud health/latest API;
- cross-runtime protocol self-tests;
- CI guard preventing TSETMC references in foreign cloud runtime;
- CI guard preserving frozen Hunt/session assets.

### Historical checkpoint remains valid
- TradeHistory 2026-09-23: CLOSED, 957/957 resolved.
- BestLimits reconstruction: CLOSED for eligible coverage; no v4.3.x reruns.
- 26 incomplete depth snapshots remain quality-excluded, never backfilled.
- v4.4.0 PIT/provenance work remains scientifically relevant, but target execution architecture becomes bounded cloud archive + GitHub Actions rather than owner-PC production dependency.

### Next engineering sequence
1. Make cloud-v1 contract CI green.
2. Create/deploy Cloudflare resources when account access is available.
3. Run one signed `--once` probe from a real Iran-egress host.
4. Verify cloud freshness/latest path.
5. Extract exact frozen 4.1.6 shared runtime and pass parity before cloud scoring.
6. Add WebSocket fan-out and switch production frontend from localhost/Supabase feed to cloud API.
7. Add bounded R2 feature/provenance archive and move PIT jobs to GitHub Actions.
8. Add PWA/Web Push and later a second Iran collector for redundancy.

Do not resume the old personal-PC-as-primary-feed architecture.


## Cloud provenance recovery checkpoint — 2026-09-24

Continuity ID: `SHIKAR-CLOUD-IRAN-EGRESS-V1`.

Recovered:
- exact session rules are already preserved in committed `app-session-v413.js` and the parity-approved frozen server runtime;
- Git history commit `7e4772bf86cc50e15c59d7369824fff609362a3e` preserves the documented v4.1.0 integrated-engine formulas/decision thresholds;
- live Supabase management-plane Edge sources remain readable even while PostgreSQL is down.

Still unresolved for an **exact** production parity claim:
1. original SQL definition/dependencies of `public.stock_hunter_integrated_v1`;
2. exact old Eco Bridge derivation of descriptive `asset_type` / `market` labels from the Universe source.

The cloud readiness blocker name was corrected from the over-broad `asset_session_classification_provenance_unresolved` to:
`asset_type_market_derivation_provenance_unresolved`.

Do not infer that session logic is missing. Do not fabricate/default the unresolved integrated fields. See:
`cloud-v1/live-features/INTEGRATED_V410_PROVENANCE_RECOVERY_AUDIT_2026-09-24.md`.


## Bounded cloud archive checkpoint — 2026-09-24

Architecture remains `SHIKAR-CLOUD-IRAN-EGRESS-V1`.

Prepared on branch `stock-hunter-cloud-r2-archive-v1`:
- each accepted signed collector snapshot can be retained as short-lived R2 raw evidence under `raw/v1/YYYY-MM-DD/...`;
- raw archive is bounded to 1 GB and 1,500 objects per Tehran date;
- raw lifecycle target is 3 days;
- live latest-state availability does not fail if archival storage is saturated/unavailable; archive gaps remain explicit in health metadata;
- deterministic daily cross-snapshot gzip pack + manifest compactor records source hashes, counts and sequence gaps and never fills missing observations;
- daily pack upload is capped at 200 MB and lifecycle target is 15 days;
- foreign GitHub Actions consumes R2 only and never TSETMC.

This archive work does not clear `frozen_hunt_input_ready=false` and does not authorize production frontend cutover.


## Cloud ingest atomicity checkpoint — 2026-09-24

A concurrency audit found that Durable Object requests may interleave during external R2 awaits. The cloud Market Coordinator was hardened with a durable transactional global ingest lease:
- per-stream replay remains rejected;
- concurrent collector ingest fails closed with `409 ingest_busy` and is retried/spooled by the collector;
- stale lease recovery window: 300 seconds;
- old observations cannot regress `live/latest`;
- identical same-time snapshots do not rewrite latest;
- failed live R2 writes release the lease so the same sequence can retry;
- archive budget access is serialized by the same lease.

This is cloud transport/state hardening only. Frozen Hunt 4.1.6 is unchanged and `frozen_hunt_input_ready` remains false until provenance gates close.


## Mobile cloud staging checkpoint — 2026-09-24

Prepared an isolated public staging probe at `stock-hunter-v4/cloud-v1/staging/`.
- accepts only an HTTPS Cloud API base;
- checks health/latest/WebSocket from mobile or desktop;
- displays freshness, age, sequence, row count and a small raw snapshot sample;
- performs no Hunt scoring;
- contains no secret and no direct TSETMC reference;
- Production `index.html` remains explicitly isolated from this staging surface.

After a real Cloudflare deploy, use the staging page for phone/browser live validation before any production source switch.


## Iran Collector deployment checkpoint — 2026-09-24

Prepared provider-neutral Iran-egress deployment assets:
- source-only `collector.py --source-probe` proves TSETMC reachability without requiring/sending Cloud credentials;
- fail-closed systemd installer installs/enables but does not start;
- one-command activator runs source-probe, one signed `--once`, then starts the loop only after both succeed;
- Docker image runs non-root;
- Docker/compose explicitly require persistent state volume for stream ID, sequence and bounded spool;
- ephemeral free PaaS without persistent volume is probe-only, not production-ready.

No secret is committed and no Hunt behavior is changed.


## Cloud bootstrap v2 checkpoint — 2026-09-24

Deployment prerequisites are now normalized in `cloud-v1/DEPLOYMENT_BOOTSTRAP.md`.

External credentials:
- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `STOCK_HUNTER_COLLECTOR_KEYS_JSON`;
- `R2_ACCESS_KEY_ID`;
- `R2_SECRET_ACCESS_KEY`.

The first three deploy Worker/DO/R2/lifecycle/collector secret. The last two are bucket-scoped S3 credentials for the deterministic daily raw-pack workflow.

After deploy, the canonical live validation order is:
Iran `--source-probe` -> one signed `--once` -> cloud `/v1/health` + `/v1/latest` -> mobile staging WebSocket smoke -> only then long-running collector.

This still does not authorize production Hunt source cutover while exact integrated-view and asset-label provenance remain unresolved.


## Eco label provenance recovered from canonical binary — 2026-09-24

Architecture remains `SHIKAR-CLOUD-IRAN-EGRESS-V1`.

Recovered canonical artifact:
- Library ZIP: `Stock_Hunter_Eco_v4.0.8.zip`;
- ZIP SHA-256: `0d6ed1bbd11398f79a4568acd4d4f6f920d1f7fb985382a938be5408654c1139`;
- EXE SHA-256: `0b80d20a349ca5d92acb7c61f4f23ab6a4dd747f33b1509f2fdf3d6f40abb8b4`.

Go 1.23 pclntab + x86-64 assembly recovered the exact Eco v4.0.8 descriptive label logic:
- `asset_type`: exact YVal fallback + symbol/company classifier;
- `market`: exact raw `flow` mapping (1 بورس, 2 فرابورس, 4 بازار پایه, 6 بورس کالا, 7 بورس انرژی, default بازار سرمایه).

The Iran collector already parsed raw `yval`; signed payload serialization now preserves it.
Cloud feature builder derives labels from raw `symbol/company_name/yval/flow` using `recovered-eco-labels-v408.ts`.

Closed blocker:
`asset_type_market_derivation_provenance_unresolved`.

Remaining exact Frozen Hunt live-input blocker:
`integrated_view_provenance_unresolved`.

`frozen_hunt_input_ready` remains false; production cloud Hunt/source cutover is still not authorized.


## Model Validation Gate v4.5.0 checkpoint — 2026-09-25

User explicitly prioritized validating Frozen Hunt 4.1.6 before completing the remaining cloud-production rollout.

Production infrastructure work is paused at its current safe checkpoint. The next primary gate is model validation:

- G0 mechanical/formula invariants;
- G1 PIT historical evidence quality;
- G2 2026-09-23 historical gross-error diagnostic;
- G3 exact prospective shadow validation;
- G4 production readiness.

Package:
`Stock_Hunter_Model_Validation_Gate_v4.5.0.zip`

SHA-256:
`7b63e48e6b9a9444740e0b11dc2e8928404c41f558deff86b9311ed983c43e3f`

The 2026-09-23 run is diagnostic only. It must never be represented as prospective/OOS proof, and missing PIT realFlow/integrated inputs must never be fabricated. Production cloud cutover remains blocked until this validation sequence is resolved.

See:
`model-validation-v416/MODEL_VALIDATION_GATE_V416.md`.


## Model Validation v4.5.1 daily-reference repair — 2026-09-25

First real v4.5.0 run:
- all mechanical Hunt 4.1.6 checks PASS;
- historical stage could not find the daily reference at the single hard-coded path `cache\\bulk\\20260923.json.gz`.

This is not a model failure.

v4.5.1 keeps all validation criteria unchanged and adds bounded deterministic discovery of existing local daily/bulk caches, including gzip magic-byte detection. No network request and no TradeHistory/BestLimits re-download is allowed.

Package SHA-256:
`0f61f1c39ff0af25ea5c57a44529593ce18cbbea9f522d89a9c8b900157ccbdd`

Primary next action: run `RUN_MODEL_VALIDATION_20260923.cmd` from v4.5.1 and analyze its full final output before resuming production infrastructure work.


## Model Validation v4.5.2 evidence-reader repair — 2026-09-25

v4.5.1 mechanical checks all PASS, but its historical verdict is NOT a model result because `TradeParsed=0` and `DailyReference=0`. The canonical v4.2.1 executable exposes cache naming `trade_%s_%s.json.gz` and `bulk_daily.json.gz`; v4.5.2 repairs discovery accordingly. It may recover only the missing official daily reference with one network request; TradeHistory/BestLimits remain cache-only.

Package SHA-256: `dcd0ae9e844fc6bf098a7b59f60f6a0bc83d3d70356cb656b2e2420f2d7a2f99`

Next primary action: run v4.5.2 and require nonzero `TradeParsed` and `DailyReference` before interpreting any Hunt quality verdict.


## Model Validation v4.5.3 fast precheck — 2026-09-25

Use v4.5.3 instead of v4.5.1/v4.5.2. It repairs canonical TradeHistory/daily cache names and adds a fast precheck so unreadable historical evidence exits quickly instead of running the full replay. Package SHA-256: `1ba10a6bdd487671cbcfed8270ce95d52dcf6b9bff04bff92d3a745e5844a88c`.

Do not interpret v4.5.1's `HISTORICAL_DATA_INADEQUATE` as a Hunt-model result because `TradeParsed=0` and `DailyReference=0`.


## Model Validation v4.5.4 canonical TradeHistory cache repair — 2026-09-25

Real v4.5.3 run proved daily-reference recovery is correct (`2294` rows) but TradeHistory discovery still returned `cache-found=0`. v4.5.4 now uses the canonical cache layout `<InsCode>_grouped_true.json.gz` / `_grouped_false.json.gz` and builds a bounded recursive cache index as fallback. It prints real TradeHistory sample paths before any heavy replay.

Package SHA-256: `b484cbe708a3f6e4f455d46ab3aff9b1ab58663a6c757c9ca84baa19554f9f64`.

Do not interpret v4.5.1/v4.5.3 historical verdicts as Hunt-model results. Require positive TradeHistory precheck first.


## Model Validation v4.5.5 ledger-first cache locator — 2026-09-25

Real v4.5.4 confirmed daily reference is valid (2294 rows), but its Trade cache root assumptions still found zero roots. v4.5.5 removes path guessing: it reads recorded cache paths from the real historical ledger first, then resolves moved basenames and finally performs a bounded read-only StockHunter state inventory. No TradeHistory/BestLimits redownload is allowed.

Package SHA-256: `39cdedc894b1003311b4e603d252674a6c4b6b3d55839dda8e96cf9b49f66f27`.

Do not interpret prior historical verdicts as Hunt-model quality. Require positive TradeHistory precheck first.


## v4.5.5 real validation findings — 2026-09-25

G0 mechanical validation PASS. Historical evidence reader is now working on real caches. Real run: eligible 948, BestLimits 948, TradeParsed 684, DailyReference 684, temporal-reliable 114, unreliable 570, missing raw trade cache 209, parse-fail 55, ground truth 1316. Verdict HISTORICAL_DATA_INADEQUATE is evidence-quality only, not a Hunt quality verdict. Across six polling phases robustTP/robustFP/robustSignals are zero because historical PIT envelopes are too wide; phase-local hardMiss counts are ~17–22 per objective and require cross-phase intersection + binding-gate diagnosis before any production rollout resumes. Do not tune Frozen thresholds from this day.


## Model Validation v4.5.6 hard-miss diagnosis — 2026-09-25

Real v4.5.5 JSON was analyzed in full. Dominant temporal-completeness failure is `grouped=true`: 569/570 temporal-unreliable parsed symbols use that variant, while 39/40 `grouped=false` symbols are temporally reliable. This is an evidence-source limitation, not a demonstrated Hunt failure.

A validator-universe defect was also found: 17/35 persistent Hard-Miss findings begin with `ض`; recovered Eco v4.0.8 classifies that prefix as `اختیار معامله`, which Frozen Hunt excludes. v4.5.6 fixes the diagnostic universe and adds per-Hard-Miss binding-gate diagnostics without changing Frozen Hunt.

Package SHA-256: `6b6bb4850ecbe9a3c1d802435783d534e2410aca3b010c7e20bfeb9fca2125f6`.

Primary next action: run v4.5.6 once and analyze the remaining eligible Hard-Miss blocker lines. Do not resume production infrastructure or tune thresholds before that result.
