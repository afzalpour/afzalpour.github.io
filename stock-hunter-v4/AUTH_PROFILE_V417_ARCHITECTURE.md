# Stock Hunter 4.1.7 — Auth & Personal Profile Architecture

Status: approved architecture / implementation pending
Date: 2026-09-19

## Objective
Add secure multi-user access to Stock Hunter without changing the frozen Hunt analytics lifecycle.

The user experience becomes:
1. login / account recovery;
2. authenticated Stock Hunter application;
3. personal profile and preferences;
4. personal watchlists and alerts;
5. owner-admin console for account administration.

## Current baseline
At architecture approval time the live Supabase project has:
- 0 Auth users;
- no profile table;
- no user-role table;
- no profile/role RLS policies;
- no Auth provisioning trigger.

Therefore Auth/Profile is a clean 4.1.7 addition and is not a migration of an existing user system.

## Proposed data model
Naming is versioned to avoid accidental collision with future generations.

### public.stock_hunter_profiles_v417
- user_id uuid primary key references auth.users(id) on delete cascade
- display_name text
- avatar_url text
- account_status text
- created_at timestamptz
- updated_at timestamptz
- last_seen_at timestamptz

RLS: own row only for ordinary users.

### public.stock_hunter_user_preferences_v417
- user_id uuid primary key
- theme
- page_size
- visible_columns jsonb
- hunt_filter
- decision_filter
- notification_settings jsonb
- updated_at

RLS: own row only.

### public.stock_hunter_watchlists_v417
- watchlist_id uuid
- user_id uuid
- name
- created_at / updated_at

### public.stock_hunter_watchlist_items_v417
- watchlist_id uuid
- user_id uuid
- symbol_id/text reference
- created_at
Unique per watchlist + symbol.

RLS for watchlists/items: own rows only.

### private role state
Canonical authorization role is privileged state, not user-editable profile metadata.
Roles: owner_admin / admin / user.

The browser may receive a minimal role claim in trusted app_metadata for UI rendering, but server/RLS remains authoritative. Role changes require token/session refresh before elevated UI is considered active.

### public.stock_hunter_admin_audit_v417
Append-only administrative audit:
- actor_user_id
- action
- target_user_id
- structured details
- created_at

No client-side insert path for ordinary users.

## Account provisioning
A new Auth user receives:
- default role = user;
- profile row;
- preferences row.

Provisioning must be atomic/retry-safe. Failure must not create an elevated role.

## Owner bootstrap
There is no "first user becomes admin" behavior.
After the project owner creates and verifies their account, the account UUID is explicitly promoted once through a privileged deployment/admin procedure to `owner_admin`.
Transfer of ownership requires a separate controlled operation with audit evidence.

## Auth flows
Initial release:
- signup with email/password;
- email verification where configured;
- sign in;
- sign out;
- forgot/reset password;
- session restore/refresh;
- protected-route redirect.

Optional later:
- passkeys/social login/OIDC only after base flows are stable.

## Security contract
- Publishable browser key only.
- Never expose service_role/secret keys.
- RLS on every public user-owned table.
- Explicit SELECT policy required for UPDATE behavior.
- UPDATE policies use both USING and WITH CHECK.
- Authorization is never based on raw_user_meta_data/user_metadata.
- No broad `TO authenticated USING(true)` access to private user data.
- Admin mutations use a protected server-side function/Edge Function boundary.
- Security advisors run after schema/policy changes.

## Separation from market engine
Auth state may control whether a human can view/persist personal UI state.
It must not modify:
- 4.1.6 Hunt formulas/thresholds;
- prospective capture;
- calibration samples;
- OOS datasets;
- promotion decisions;
- 4.1.7 routing/canary state.

## Release tests
1. User A cannot read/update User B profile.
2. User A cannot read User B watchlist/preferences.
3. User cannot self-promote via profile/user metadata.
4. User cannot call admin mutations.
5. Owner admin can perform explicitly supported admin actions.
6. Signed-out browser cannot access protected personal endpoints.
7. Browser bundle contains no secret/service-role credential.
8. Account suspension/revocation test blocks new privileged access.
9. Auth failure does not break Feed/Capture infrastructure.
10. 4.1.6 champion remains functional throughout 4.1.7 Auth development.
