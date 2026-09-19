-- Live migration: stock_hunter_admin_audit_client_deny_v417
-- Explicit browser deny policy for defense in depth. The table also has no
-- authenticated grants; server-side admin Edge Function reads it via service role.
create policy stock_hunter_admin_audit_client_deny_v417
on public.stock_hunter_admin_audit_v417
as restrictive
for all
to authenticated
using (false)
with check (false);
