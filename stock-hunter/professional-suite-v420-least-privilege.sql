-- Stock Hunter Professional Suite v4.2.0 — least-privilege grant hardening
-- Applied live on 1405/07/05 (2026-09-27). RLS remains the row-level boundary.

revoke all on table public.stock_hunter_smart_watchlists_v420 from anon;
revoke all on table public.stock_hunter_decision_journal_v420 from anon;
revoke all on table public.stock_hunter_workspace_v420 from anon;
revoke all on table public.stock_hunter_push_subscriptions_v420 from anon;

revoke all on table public.stock_hunter_push_public_v420 from anon, authenticated;
grant select on table public.stock_hunter_push_public_v420 to anon, authenticated;

revoke all on table public.stock_hunter_smart_watchlists_v420 from authenticated;
grant select,insert,update,delete on table public.stock_hunter_smart_watchlists_v420 to authenticated;

revoke all on table public.stock_hunter_decision_journal_v420 from authenticated;
grant select,insert,update,delete on table public.stock_hunter_decision_journal_v420 to authenticated;

revoke all on table public.stock_hunter_workspace_v420 from authenticated;
grant select,insert,update,delete on table public.stock_hunter_workspace_v420 to authenticated;

revoke all on table public.stock_hunter_push_subscriptions_v420 from authenticated;
grant select,insert,update,delete on table public.stock_hunter_push_subscriptions_v420 to authenticated;
