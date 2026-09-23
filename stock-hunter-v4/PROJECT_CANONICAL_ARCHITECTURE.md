# Stock Hunter — Canonical Architecture Freeze

Status: canonical
Date: 2026-09-19
Scope: Stock Hunter 4.1.6 champion + 4.1.7 challenger lifecycle

## 1. Product objective
The main screen is an operational hunting surface, not a market directory.

Canonical information architecture:
1. **Action Now** — default main table.
2. **Radar** — compact near-action queue.
3. **Universe** — full market access through search and explicit filters.

This contract applies to 4.1.6 and all later versions unless the user explicitly approves a replacement.

## 2. Action Now contract
Default main table shows only:
- `شکار ویژه`
- `هشدار فوری`

Additional mandatory gates:
- row data must be fresh (maximum age: 180 seconds);
- the instrument must be inside its valid hunt/session window;
- the setup must remain inside the 4.1.6 goal domain (`dayChange < +1%`).

Stale rows must NEVER appear as active Action Now alerts.

## 3. Radar contract
A compact **رادار نزدیک** section shows up to 8 best fresh `شکار زودهنگام` rows.
Sort priority:
1. Hunt Score
2. Today Opportunity
3. fast score

Radar is observational/pre-action. It does not change scoring or thresholds.

## 4. Universe contract
All search/filter capabilities remain.
- Universal search searches the complete `stock_hunter_universe_v4` catalog, independent of Hunt/session filters.
- Hunt dropdown preserves: active default, special, urgent, early, watch, normal, and explicit **همه نمادها**.
- Selecting **همه نمادها** shows the loaded market universe, including instruments not eligible for fast Hunt.
- Funds and other instruments must not disappear from Search/Universe just because they are not current Hunt candidates.

## 5. Eligibility vs visibility
Hunt eligibility and Universe visibility are separate.
Options, debt/fixed-income and other excluded instrument classes may be visible/searchable while remaining ineligible for the fast Hunt engine.
Never solve clutter by deleting instruments from the Universe.

## 6. 4.1.6 champion freeze
4.1.6 remains the production champion.
Frozen scoring engine: `4.1.6-hunt-v2`.
Do not change formulas, thresholds, model list, capture provenance, prospective boundaries, calibration criteria, or lifecycle gates without explicit user authorization.
UI bug fixes may be made only when they preserve this architecture and approved visual identity.

Approved visual identity remains frozen:
- IRAN font across all site text;
- Precision Optics dark palette;
- approved recolor of the original logo geometry;
- brass/orange numeric treatment;
- full explanatory text under Detail metrics;
- existing 5 forecast models and 10-day comparison.

## 7. 4.1.7 challenger contract
4.1.7 inherits the same Action Now → Radar → Universe UI contract.
Its runtime scorer may only affect rows routed to challenger after approved activation gates.
UI visibility rules are version-neutral and shared.
Current safety baseline until lifecycle advancement:
- champion only;
- challenger traffic 0%;
- kill switch engaged;
- capture-v417 dark/no active callers.

Do not activate 4.1.7 merely because implementation is complete. Continue prospective collection → maturity → calibration → robustness → candidate evaluation → OOS → promotion proposal → forward shadow → activation review → canary.

## 8. Feed/freshness contract
Primary live-market provenance is Local-First: `Stock_Hunter_Feed_Agent_v4.0.7_LocalFirst` sends the unchanged v4.0.6 market/scoring payload to `Stock_Hunter_Local_Bridge_v4.0.7` on `127.0.0.1:41716`; the browser reads the local REST-compatible bridge first. Supabase remains a cloud fallback/legacy evidence store and is no longer required for day-to-day live Hunt availability.
The local bridge binds loopback only, persists the latest snapshot locally, and archives one compressed point-in-time snapshot per 15-minute bucket.
Browser refresh interval: 15 seconds.
A stale feed can remain searchable but cannot create active Action Now/Radar alerts. The frozen <=180-second Action Now freshness gate is unchanged.



Quality-quarantine contract:
- prospective source rows are never deleted or synthetically repaired to hide a capture-quality incident;
- a known-invalid or conservatively unsafe Shadow Sample may be placed in the immutable `stock_hunter_shadow_sample_exclusions_v416` ledger;
- any sample in that ledger is permanently excluded from the live Calibration dataset before OOS freeze;
- quarantine must be evidence-backed and documented; it cannot be used to improve model metrics by selectively removing poor outcomes.

Prospective capture freshness is also per-row, not heartbeat-only:
- `stock-hunter-capture-v416` may evaluate/write prospective Hunt Events or Shadow Samples only from source rows whose `updated_at` age is at most 180 seconds at capture invocation time;
- a fresh global `stock_hunter_feed_health_v4` heartbeat is not sufficient if an individual symbol row is stale;
- source rows older than 180 seconds must be excluded before Hunt evaluation and before prospective writes.


## 9. New-chat continuity rule
This file is the architectural source of truth.
Any new project chat/agent must read this file BEFORE proposing or applying changes.
Then read `NEW_CHAT_BOOTSTRAP.md`, inspect current GitHub `main`, and verify live Supabase state.
Never reconstruct architecture only from conversational memory.

## 10. Change-control rule
Every explicitly approved architecture change must update this canonical file in the SAME PR/commit series.
If code and this document disagree, stop and reconcile before release.


## 11. 4.1.7 Auth / Profile contract
Authentication and personal profiles are mandatory release scope for 4.1.7.

### Identity
- Supabase Auth is the identity provider.
- The market application requires an authenticated session; only the login/recovery surface may be public.
- Initial sign-in scope: email + password, with email verification/recovery. Additional providers may be added later without changing the core authorization model.
- Authentication must remain logically separate from Hunt scoring, capture, calibration, OOS, promotion, and runtime routing.

### Roles
Canonical roles:
- `owner_admin` — exactly the project owner / primary administrator.
- `admin` — optional delegated administrator.
- `user` — normal application user.

The first `owner_admin` assignment is a one-time privileged bootstrap after the owner's Auth account exists. It must NEVER be claimable from browser UI, signup metadata, `user_metadata`, email text matching, or "first registered user" logic.

Authorization data must not be trusted from user-editable metadata. Sensitive administrative operations must use protected role state and/or trusted `app_metadata`, with server-side enforcement and RLS.

### Personal profile
Each authenticated user receives an own-only profile containing at minimum:
- display name;
- avatar reference;
- account status;
- created / updated / last-seen timestamps;
- UI preferences;
- saved columns / filters;
- alert preferences.

Personal features are part of 4.1.7:
- personal watchlists;
- saved symbols;
- personal alert settings;
- saved display/filter preferences.

### Privacy and RLS
- Every user-owned table exposed through the Data API must have RLS enabled.
- Users can read/update only their own profile and personal objects.
- Admin access is explicit and least-privilege; no broad browser service key exists.
- `service_role` / secret keys must never be exposed to the browser.
- Administrative mutations run through a protected server-side/Edge Function boundary and must be audited.
- User deletion/suspension must account for active sessions/token lifetime; access revocation is not implemented as a UI-only flag.

### Admin console
The owner admin receives an admin-only surface for:
- user list and account status;
- role management except transfer/removal of the sole owner without a controlled owner-transfer procedure;
- suspend/reactivate;
- audit trail;
- aggregate usage/health information.

The admin console must not silently expose a user's private personal data beyond what is required for administration.

### Release gating
4.1.7 cannot be declared final until Auth/Profile passes:
- signup/login/logout/recovery verification;
- owner bootstrap verification;
- RLS isolation tests with at least two distinct test users;
- admin authorization negative tests;
- session expiry/revocation tests;
- no-secret-in-browser verification;
- security advisor review;
- public-production auth smoke.

See `AUTH_PROFILE_V417_ARCHITECTURE.md` for the implementation contract.


### Auth implementation status
Admin boundary status (2026-09-19): `stock-hunter-admin-v417` is deployed with `verify_jwt=true`; the staged admin console is implemented; suspension combines Auth ban with restrictive account-status RLS. Two-user real-session isolation and admin-negative tests PASS.


## 12. Continuity and current Auth checkpoint
Canonical continuation keyword: `SHIKAR-417-CONTINUE-CANONICAL`.

The older phrase `ادامه پروژه شکار سهم — SHIKAR-417-CANONICAL-CONTINUE` is a compatibility alias only. New chats must normalize it to the canonical keyword above.

When the canonical keyword appears:
- read `CURRENT_HANDOFF.md`, `NEW_CHAT_BOOTSTRAP.md`, this architecture, Auth architecture, and latest audits;
- verify current GitHub `main` and live Supabase state before mutation;
- continue from the first incomplete gate without asking the user to reconstruct prior history.

Auth/RLS two-user real-session isolation self-test: PASS (2026-09-19).
Admin boundary and console: implemented.
Authenticated 4.1.7 personal app surface: implemented as a staging surface; Profile/Preferences/Watchlists are connected to the market UI.
4.1.6 remains production Champion and is not login-gated.


### Engineering proof status
As of 2026-09-19:
- 4.1.6 Browser ↔ deployed capture Hunt parity final revalidation: PASS on the frozen deterministic fixture protocol.
- 4.1.7 control-plane crash/partial-failure proof: PASS on real START/ADVANCE/ROLLBACK transition functions using rollback-only live PostgreSQL failpoints.
- 4.1.7 advisory-lock + state_version contention proof: PASS with real independent PostgreSQL connections.
- 4.1.7 authenticated deployed Chromium smoke: PASS for login, personal Preferences persistence, Watchlists, normal-user Admin isolation and logout; temporary user cleanup PASS.
These proofs do not authorize challenger activation; statistical maturity/OOS/promotion/activation gates remain independent.


### Capture service authentication
As of 2026-09-19 the active 4.1.6 prospective capture boundary is `VAULT_HMAC_NONCE_V2`.
- `verify_jwt=false` is intentional for the database-cron/service-to-service endpoint; it is not browser-authenticated.
- the Vault capture secret is an HMAC key and must never be transmitted on the request;
- every production capture request requires a fresh timestamp, UUID nonce and HMAC-SHA256 signature;
- timestamp window is ±180 seconds;
- nonce reuse is denied atomically by a private ledger;
- the legacy static capture-token header is rejected by the active Edge source;
- only the private postgres cron signer may construct valid capture requests;
- Hunt formulas, capture provenance and prospective semantics are unchanged.
Capture security hardening live + deployed regression status: PASS.


### Legacy market-scan compatibility hardening
The non-canonical legacy `stock-hunter-market-scan-v4` endpoint must not be confused with the 4.1.6 prospective capture service.
As of 2026-09-20 its raw embedded caller credential has been removed from source and replaced by digest-only validation while preserving the existing `x-scan-secret` caller contract. No repo/pg_cron caller was found, but an external caller may exist, so caller transport/secret rotation requires separate evidence.

### Hosted Auth platform blockers
The deployed 4.1.7 browser/login/personal/Admin-isolation smoke is PASS, but final Auth/Profile release gating still requires:
- correcting hosted Site URL / redirect allow-list through a legitimate Dashboard or Management API path;
- Leaked Password Protection when the project plan supports the Pro-only feature;
- password-recovery/public redirect smoke after URL configuration is corrected.
These platform blockers must not be bypassed with browser-side redirect weakening or fake HIBP logic.
