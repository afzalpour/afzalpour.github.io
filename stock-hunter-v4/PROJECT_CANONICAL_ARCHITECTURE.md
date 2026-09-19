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
Current market feed provenance depends on `Stock_Hunter_Feed_Agent_v4.0.5` populating `stock_hunter_integrated_v1` and `stock_hunter_feed_health_v4`.
Browser refresh interval: 15 seconds.
A stale feed can remain searchable but cannot create active Action Now/Radar alerts.

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
Admin boundary status (2026-09-19): `stock-hunter-admin-v417` is deployed with `verify_jwt=true`; the staged admin console is implemented; suspension combines Auth ban with restrictive account-status RLS. Two-user isolation/negative-session tests remain release gates.


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
