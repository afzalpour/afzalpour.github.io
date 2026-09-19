-- Live migration: stock_hunter_suspended_account_rls_hardening_v417
-- Suspended users must lose browser Data API access even if an already-issued
-- access token has not reached exp yet.

create policy stock_hunter_roles_active_account_v417
on public.stock_hunter_user_roles_v417
as restrictive
for select
to authenticated
using (
  exists (
    select 1 from public.stock_hunter_profiles_v417 p
    where p.user_id=(select auth.uid()) and p.account_status='active'
  )
);

create policy stock_hunter_profiles_active_account_v417
on public.stock_hunter_profiles_v417
as restrictive
for all
to authenticated
using (account_status='active')
with check (account_status='active');

create policy stock_hunter_preferences_active_account_v417
on public.stock_hunter_user_preferences_v417
as restrictive
for all
to authenticated
using (
  exists (
    select 1 from public.stock_hunter_profiles_v417 p
    where p.user_id=(select auth.uid()) and p.account_status='active'
  )
)
with check (
  exists (
    select 1 from public.stock_hunter_profiles_v417 p
    where p.user_id=(select auth.uid()) and p.account_status='active'
  )
);

create policy stock_hunter_watchlists_active_account_v417
on public.stock_hunter_watchlists_v417
as restrictive
for all
to authenticated
using (
  exists (
    select 1 from public.stock_hunter_profiles_v417 p
    where p.user_id=(select auth.uid()) and p.account_status='active'
  )
)
with check (
  exists (
    select 1 from public.stock_hunter_profiles_v417 p
    where p.user_id=(select auth.uid()) and p.account_status='active'
  )
);

create policy stock_hunter_watchlist_items_active_account_v417
on public.stock_hunter_watchlist_items_v417
as restrictive
for all
to authenticated
using (
  exists (
    select 1 from public.stock_hunter_profiles_v417 p
    where p.user_id=(select auth.uid()) and p.account_status='active'
  )
)
with check (
  exists (
    select 1 from public.stock_hunter_profiles_v417 p
    where p.user_id=(select auth.uid()) and p.account_status='active'
  )
);
