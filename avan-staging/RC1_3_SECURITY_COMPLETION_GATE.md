# Avan — RC1.3 Security Completion Gate

Date: 2026-09-06

## Scope
This gate closes the actionable parts of:
- Backup / Restore strategy and restore-drill readiness
- Session Security
- Leaked Password Protection
- remaining `SECURITY DEFINER` hardening

It does **not** falsely mark provider-gated items as complete.

## 1. Backup / Restore
### Implemented
- `BACKUP_RESTORE_RUNBOOK.md` defines the complete backup set: PostgreSQL logical dump, Storage object bytes + manifest/checksums, exact release SHA/migrations, and external operational configuration.
- Restore validation includes Company/member counts, journal/line counts, debit=credit, orphan checks, posted/reversed integrity, account-role integrity, Storage checksums and cross-company authorization tests.
- Current post-hardening live baseline: database 14 MB, Storage objects 23, orphan journal lines 0, Posted/Reversed invoices without linked journal 0, unbalanced Posted/Reversed journals 0.

### Restore drill status — BLOCKED, not PASS
A real restore drill must run only on an isolated Supabase scratch target. The connected project is on Free, and this workflow has neither a downloadable backup artifact nor an approved no-cost isolated target. Do **not** run a destructive restore against `Avan-production`.

Required unblock: provision/approve an isolated target and provide a real logical dump + Storage backup, then execute the existing runbook end-to-end.

## 2. Session Security
### Implemented compensating control on Free plan
- 60-minute inactivity timeout.
- 12-hour maximum browser session lifetime.
- 60-second heartbeat and visibility re-check.
- Activity timestamps only; no financial data is stored in local/session storage.
- Forced logout clears active-company session context.

### Provider-native status
Hosted Supabase time-box/inactivity session controls are plan-gated on Pro and above. Therefore the application guard is a compensating control, not a replacement for provider-native session invalidation.

## 3. Leaked Password Protection
### Current status — provider blocker remains
Supabase Security Advisor still reports `Leaked Password Protection Disabled`. Built-in leaked-password screening is available on Pro and above.

### Existing compensating control
New signup UI requires at least 10 characters containing a letter and a digit. Existing sign-in is intentionally not rejected by this UI-only rule.

### Completion criterion
After plan upgrade, enable Supabase Auth leaked-password protection and re-run Security Advisor. Do not mark this item PASS while the Advisor warning remains.

## 4. `SECURITY DEFINER` hardening
### New migration
`rc1_3_security_definer_role_hardening`

### Security issue closed
The schema supports role `viewer`. Six journal mutation paths previously depended on Company membership but did not all enforce a financial-writer role directly. A future Viewer could therefore reach journal mutation through exposed SECURITY DEFINER RPC boundaries.

The migration adds private `assert_financial_write_access()` and enforces `owner | manager | accountant` at the central journal-posting boundary plus draft-save/delete boundaries. Higher-level posting functions inherit the central check transactionally.

### Search-path / ACL hardening
- Intentional browser-facing SECURITY DEFINER RPCs are pinned to `pg_catalog, public, auth, pg_temp` with `pg_temp` last.
- `PUBLIC` and `anon` execute remain revoked.
- `authenticated` execute is explicitly granted only for intended RPC boundaries.
- The new private writer-role helper is not executable by browser roles.
- Existing `search_path=''` access-boundary functions remain unchanged.

### Verification
Transactional probe (rolled back):
- temporarily changed an authorized member to `viewer`;
- `save_draft_journal` returned `ROLE_NOT_ALLOWED`;
- restored the original role within the same transaction;
- authorized writer check passed;
- transaction rolled back.

Post-migration integrity snapshot:
- Workspaces: 6
- Accounts: 393
- Journal entries: 29
- Journal lines: 65
- Total debit: 201,101,351 Toman
- Total credit: 201,101,351 Toman
- Unbalanced Posted/Reversed journals: 0
- Browser-executable SECURITY DEFINER RPCs: 26 (intentional boundaries)
- `anon`-executable SECURITY DEFINER functions: 0
- `PUBLIC`-executable SECURITY DEFINER functions: 0

The Advisor will still list the 26 intentional authenticated SECURITY DEFINER RPCs because the lint is exposure-based. This is not by itself a vulnerability; each remaining endpoint must stay guarded and regression-tested rather than blindly converted to INVOKER or revoked.

## Final RC1.3 Gate before Production promotion
1. Run the existing accounting polish Live Gate: Company card state, journal totals/balance indicator, print unit on all financial outputs, and standard account chart.
2. Run two-user / multi-company RLS regression.
3. Verify normal Owner/Manager/Accountant journal create/save/post/reverse still works.
4. Verify Viewer cannot create/save/post/reverse/delete journal documents.
5. Re-run Supabase Security Advisor.
6. Keep Leaked Password Protection and isolated Restore Drill marked BLOCKED until their provider/environment prerequisites are actually satisfied.
