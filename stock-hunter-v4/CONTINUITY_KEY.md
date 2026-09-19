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
