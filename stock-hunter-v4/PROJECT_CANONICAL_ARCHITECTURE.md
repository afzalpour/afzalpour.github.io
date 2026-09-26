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
Primary live-market provenance is the approved PC Eco architecture `SHIKAR-PC-ECO-GITHUB-V1`.

Canonical path:
- the owner's Windows PC reads TSETMC bulk MarketWatch every 30 seconds and ClientType every 120 seconds;
- `Stock_Hunter_PC_Eco_Bridge_v4.1.1.exe` processes the full eligible MarketWatch universe for flows 1/2/4;
- no local Top-N transport prefilter may prevent an eligible symbol from reaching Frozen Hunt;
- upload remains low-bandwidth through gzip batches of at most 250 rows;
- Supabase Edge Function `stock-hunter-pc-ingest-v410` is the ingest boundary and writes the existing signal/universe/feed-health tables;
- GitHub Pages remains the public UI;
- the browser remains the authoritative `4.1.6-hunt-v2` scorer.

The earlier v4.0.8/v4.0.9 loopback-controller path and the Iran-VPS/Cloudflare architecture are retained only as legacy/optional redundancy designs. They are not the primary feed prerequisite.

No fixed Iranian IP, VPS, Cloudflare credential, Python runtime, or Windows service is required for the primary path.

Browser refresh interval remains 15 seconds. A stale feed can remain searchable but cannot create active Action Now/Radar alerts. The frozen <=180-second Action Now freshness gate is unchanged. Feed snapshots must be preserved into browser normalization because the frozen 4.1.6 Delta logic consumes them.


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


## 13. Frozen Hunt 4.1.6 prospective effectiveness tracking
Primary model validation is outcome-based and prospective.

Canonical tracker objects:
- `stock_hunter_hunt_market_tape_v416`: bounded narrow market tape only for symbols with a real Hunt alert;
- `stock_hunter_hunt_effectiveness_v416`: permanent deduplicated alert-outcome ledger;
- `stock_hunter_hunt_effectiveness_summary_v416`: aggregate effectiveness view;
- `stock_hunter_hunt_effectiveness_control_v416`: prospective boundary and operational status.

Prospective D+1 tracking begins on **2026-09-26**. Older missing sessions or queue state must never be synthetically backfilled from later market state.

Two channels are measured independently:
- **ACTION_NOW**: first actual `شکار ویژه` / `هشدار فوری` event per symbol/day;
- **RADAR**: first non-quarantined `شکار زودهنگام` Shadow Sample per symbol/day.

Permanent outcomes include:
- same-day cross of 0%;
- same-day +1/+2/+3 reach;
- same-day mode target reach/close;
- same-day canonical buy queue any-time / close;
- next observed market-session (D+1) positive close;
- D+1 +1/+2/+3 reach;
- D+1 canonical buy queue any-time / close;
- MFE/MAE and return from the original alert price.

Canonical buy queue is the existing feed `buy_queue` feature (level-1 best bid approximately equals `max_allowed` with positive bid quantity). The effectiveness layer must not substitute a price-change proxy for queue state.

The narrow tape has 30-day retention; permanent alert outcomes remain after tape cleanup.

Missing/unmatured D+1 evidence is excluded from denominators and is never counted as failure.

This tracking layer is observational only. It does **not** modify Frozen Hunt `4.1.6-hunt-v2` formulas, thresholds, state classification, Action Now/Radar visibility, calibration gates, or production routing.


## 14. Personal account entry and own-profile landing contract
The public 4.1.6 market surface remains ungated, but it may expose a visible **حساب من** entry to the authenticated personal surface.

Canonical account flow:
1. public user chooses `حساب من`;
2. `profile-v417.html` protects itself and redirects signed-out users to `auth-v417.html?next=profile-v417.html`;
3. successful login validates the Supabase Auth user and lands on the user's own profile by default;
4. profile data are loaded only through own-row RLS;
5. the profile page provides the explicit entry to the authenticated personal market `index-v417.html`.

Allowed post-auth destinations are restricted to the internal allow-list:
- `profile-v417.html`
- `index-v417.html`
- `admin-v417.html`

An inactive or missing profile must never be treated as active by browser fallback logic.

This UX contract is independent from Frozen Hunt scoring and does not gate the public 4.1.6 Champion.


## 15. AI assistance, Jalali calendar and research export contract — 2026-09-26
User-approved AI capabilities are an explanatory/research layer only and MUST NOT mutate Frozen Hunt `4.1.6-hunt-v2` formulas, thresholds, lifecycle gates, routing, capture provenance or activation state.

Approved AI surfaces:
- symbol-detail Hunt assistant grounded only in the current signal/journey data;
- Persian natural-language strategy translation into visible, editable Strategy Builder rules;
- end-of-market daily report built from Hunt Journey, missed opportunities, backtest summaries and reliability evidence;
- historical similar-Hunt retrieval based on recorded feature distance and observed outcomes;
- reliability diagnostic assistant that distinguishes feed/capture issues from model-outcome evidence.

Security and reliability rules:
- browser code never contains an OpenAI secret;
- optional generative enhancement runs only through the Supabase Edge Function `stock-hunter-ai-v417`, which validates the Supabase user session in server code;
- the external model secret is read only from Edge Function environment variables;
- if generative inference is unavailable, deterministic local data-grounded analysis remains functional;
- AI output must not invent missing observations, promise returns, issue a definitive buy/sell instruction, or change Frozen Hunt scoring.

Date selection contract:
- every current user-selectable date in Stock Hunter uses the shared Persian/Jalali calendar grid;
- date fields are read-only and are selected from the calendar rather than typed manually;
- future date-selection UI must reuse the same calendar contract.

Research export contract:
- every page under the Hunt Analysis research family exposes `چاپ / ذخیره PDF`;
- print styling removes interactive controls and expands tables for browser Print / Save as PDF.
