# Stock Hunter — Search Neutral Skin + Personal Profile Login Flow Audit

Date: 2026-09-25  
Scope: public 4.1.6 search presentation + 4.1.7 authenticated personal account surface

## User requests

1. Remove the blue background from the symbol-search combobox and match the neutral gray Precision Optics main surface.
2. Finalize the per-user profile flow so each user can log in and land on their own profile page.

## Search presentation

A dedicated presentation-only asset `search-neutral-v416.css` overrides the dark-theme combobox:

- dropdown background: `#131519`
- active/hover row: `#191c21`
- borders: `#25282e`
- secondary text: `#8d9096`

The old blue active background `#10243a` is not used by the override.

Search ranking, Universe scope, keyboard behavior and Frozen Hunt logic are unchanged.

The neutral skin is loaded by both:
- `index.html`
- `index-v417.html`

## Account entry and profile routing

The public main page now exposes a visible `حساب من` entry.

Flow:
1. signed-out user opens `profile-v417.html`;
2. profile guard redirects to `auth-v417.html?next=profile-v417.html`;
3. successful email/password sign-in validates the session with Supabase Auth and redirects only to an allow-listed internal destination;
4. default destination is `profile-v417.html`;
5. profile page loads only the authenticated user's own Profile / Role / Preferences / Watchlists through RLS;
6. the user can enter `index-v417.html` from the profile page as their personal market surface.

Allowed post-auth destinations are limited to:
- `profile-v417.html`
- `index-v417.html`
- `admin-v417.html`

This prevents arbitrary redirect targets.

## Profile page

The profile page now presents:
- personal display name and avatar/initial;
- own email and account identifier;
- role and account status;
- watchlist count;
- profile editing;
- theme/page-size preferences;
- own watchlist creation;
- direct entry to the authenticated personal market;
- admin console link only for owner_admin/admin.

An inactive account is not silently treated as active. The profile requires an active own profile row and a verified Auth user.

## Live Supabase verification before release

Observed live foundation:
- Auth users: 1
- Profile rows: 1
- Role rows: 1
- Preference rows: 1

Provisioning trigger:
- `auth.users AFTER INSERT -> private.stock_hunter_provision_user_v417()`

RLS review:
- own SELECT/UPDATE/INSERT/DELETE policies remain scoped by `auth.uid()`;
- active-account policies are RESTRICTIVE;
- no user-editable metadata is used as an authorization source.

No Hunt formula, lifecycle gate, feed path, capture path or production scoring behavior is changed by this work.

## Browser smoke contract

The authenticated browser smoke is extended to prove the real flow:

public index -> حساب من -> login -> own profile -> personal market -> preferences/watchlist persistence -> admin isolation -> logout.

The temporary smoke user is provisioned and cleaned up through the existing OIDC-protected smoke boundary.
