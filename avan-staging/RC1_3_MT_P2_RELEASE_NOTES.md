# RC1.3-MT-P2 — Release Notes

## Authority planes
- **Platform Admin / Platform Owner** operates Avan SaaS through the separate Control Plane.
- **Company Owner / Manager** operates only the active Company's financial/users/settings plane.
- Holding both roles does not merge their permissions.

## SaaS Operations
Platform Admin can manage Tenant metadata and service controls:
- service status: onboarding / active / suspended / archived
- plan: trial / core / pro / enterprise / custom
- active-member limit
- onboarding state
- support state
- mandatory reason for every update
- platform-level audit trail with before/after values

## Enforcement
- Suspended/archived Tenant access is enforced by `has_workspace_access` / `workspace_role` and RLS-dependent financial access.
- Suspended/archived Tenant membership remains intact and Tenant stays visible in Company Portfolio, but entry is blocked.
- Reactivation restores the same Tenant/data; no financial data is deleted.
- Member limit is enforced by a database trigger on active membership insertion/reactivation.
- Platform Admin mutation does not query tenant Ledger/Invoice/Document/Account/Party tables.

## Verification before merge
- Transactional suspend test: access=false, role=NULL, visible accounts=0, visible journals=0, portfolio blocked row=1; ROLLBACK.
- Normal Company Owner mutation: rejected with `PLATFORM_ADMIN_REQUIRED`.
- Member limit test: rejected with `TENANT_MEMBER_LIMIT_REACHED`; no persistent change.
- All 5 current Tenant registry rows remained `active`, `core`, limit=10, onboarding=completed, support=none after tests.
- `platform_admin_update_tenant` and `my_company_portfolio` are SECURITY INVOKER, anon EXECUTE=false, authenticated EXECUTE=true.
- Platform Admin functions contain 0 references to financial Ledger/Invoice/Document/Account/Party tables.
- PWA staging cache: v39.
