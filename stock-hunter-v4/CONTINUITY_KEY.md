# Stock Hunter — Continuity Key

Canonical continuation keyword:

`SHIKAR-417-CONTINUE-CANONICAL`

When this exact keyword appears in a new project chat, do not rely on conversational memory. Before any mutation:
1. Read `PROJECT_CANONICAL_ARCHITECTURE.md`.
2. Read `NEW_CHAT_BOOTSTRAP.md`.
3. Read `AUTH_PROFILE_V417_ARCHITECTURE.md`.
4. Read the latest audits under `stock-hunter-v4/auth/`.
5. Inspect current GitHub `main`.
6. Verify live Supabase lifecycle, feed, Auth, routing, and security state.
7. Continue from the first incomplete canonical gate only.

Current checkpoint at creation:
- 4.1.6 remains production Champion.
- Action Now → Radar → Universe is frozen.
- 4.1.7 Auth/Profile foundation is implemented.
- project owner account is owner_admin.
- secure Admin Edge Function + staged Admin Console are implemented.
- two-user real-session RLS isolation self-test PASS.
- temporary self-test users were deleted.
- remaining Auth platform blockers include Supabase Site URL/redirect configuration and leaked-password protection, both requiring Auth Management configuration not exposed by the current connector.
- personal Watchlist/Preferences integration into the staged 4.1.7 market UI is implemented; next is post-deploy authenticated smoke plus remaining Auth platform gates and statistical lifecycle maturity.


Latest merged checkpoint:
- personal 4.1.7 market UI integration merged at `b0cce246fbcd5d4bbdfc9936908f0c0130cd999d`;
- Pages + Champion public smoke PASS;
- next incomplete gate is authenticated browser smoke / Auth platform configuration, followed by continued statistical lifecycle maturity.

- authenticated personal data-flow smoke PASS; Preferences + Watchlist backend paths verified with a real Auth session; client protected-column bug corrected; self-test function resealed.

- personal public Pages smoke now byte-compares the deployed 4.1.7 staging HTML/JS/CSS to repository bytes and guards the protected Preferences payload.

- first real EOD verifier LIVE PASS via credentialless GitHub OIDC → Supabase READ ONLY bridge; next statistical gate is the 2026-09-22 first maturity horizon.

- final Browser↔Backend Hunt parity PASS (workflow 35466587854).
- control-plane live atomicity/concurrency proof PASS: real START/ADVANCE/ROLLBACK rollback-only failpoint drills plus five real two-connection advisory-lock races; production returned to CHAMPION_ONLY / 0% / kill-switch ON / state_version=1.
- next fast-track engineering item: Capture Backend Security hardening.
