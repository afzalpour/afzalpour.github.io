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
