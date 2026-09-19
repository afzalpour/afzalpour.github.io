# Auth/Profile Foundation Audit — 2026-09-19

Status: PASS for foundation; owner bootstrap and two-user isolation tests pending.

## Live database state
Applied migrations:
- stock_hunter_auth_profile_foundation_v417
- stock_hunter_auth_foundation_hardening_v417

Created:
- stock_hunter_user_roles_v417
- stock_hunter_profiles_v417
- stock_hunter_user_preferences_v417
- stock_hunter_watchlists_v417
- stock_hunter_watchlist_items_v417
- auth.users provisioning trigger

## Security assertions verified
- RLS policies on all five user-facing tables.
- authenticated can SELECT its own role but has no UPDATE privilege on role table.
- anon has no SELECT access to profiles.
- no browser-callable SECURITY DEFINER Auth RPC remains.
- profile UPDATE is column-limited; account_status is not user-editable.
- role provisioning always defaults to user.
- owner_admin is not derived from signup metadata, email, or registration order.
- explicit authenticated grants are present; no reliance on automatic Data API exposure.
- watchlist composite FK has a covering child index.

## Advisor result
No new Auth/Profile security warning remains.
The remaining Security Advisor INFO is an older private Canary table and is outside this Auth scope.

## Pending before Auth release
- Create the real owner account.
- Explicitly bootstrap that UUID to owner_admin.
- Create at least two non-owner test accounts.
- Execute cross-user RLS negative tests.
- Add protected admin Edge Function / console.
- Test password recovery and session revocation.
- Enable the production login gate only after the above passes.
