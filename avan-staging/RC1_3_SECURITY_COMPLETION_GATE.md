# Avan — RC1.3 Security Completion Gate

Date: 2026-09-06

## Scope
This gate closes the currently actionable parts of:
- Backup / Restore strategy and restore-drill readiness
- Session Security
- Leaked Password Protection compensating controls
- remaining `SECURITY DEFINER` hardening

It does **not** falsely mark provider-gated items as complete.

## 1. Backup / Restore
### Implemented
- `BACKUP_RESTORE_RUNBOOK.md` defines the complete recovery set: PostgreSQL logical dump, Storage object bytes + manifests/checksums, exact release SHA/migrations, and external operational configuration.
- Restore validation includes Company/member/account counts, journal/line counts, debit=credit, orphan checks, Posted/Reversed integrity, Storage checksums and cross-company authorization tests.
- Current pre-drill baseline recorded on 2026-09-06:
  - database size: 14,167,187 bytes (~13.5 MiB)
  - Companies: 6
  - memberships: 6
  - accounts: 393
  - journal entries: 29
  - journal lines: 65
  - invoices: 11
  - Storage objects: 23
  - total debit = total credit = 201,101,351
  - orphan journal lines: 0
  - unbalanced Posted/Reversed journals: 0
  - Posted/Reversed invoices without linked journal: 0

### Restore drill status — BLOCKED, not PASS
A real restore drill must run only on an isolated Supabase scratch target. The connected project is on Free, and this workflow has neither a materialized logical backup artifact nor an approved no-cost isolated target. A chargeable target has not been authorized. Do **not** run a destructive restore against `Avan-production`.

Required unblock: provision/approve an isolated target and provide a real logical dump + Storage backup, then execute `BACKUP_RESTORE_RUNBOOK.md` end-to-end.

## 2. Session Security
### Implemented application-level compensating control
- 60-minute inactivity timeout.
- 12-hour absolute browser-session lifetime.
- 60-second heartbeat.
- Re-check on visibility return, window focus, `pageshow`, reconnect/online and cross-tab security-marker changes.
- Suspicious clock rollback/future timestamp drift beyond the configured tolerance forces re-authentication.
- Forced logout clears the active-company session context.
- Only security timestamps/user marker are stored by this guard; financial records are not stored there.

### Provider-native status
Hosted Supabase time-box/inactivity/single-session controls are plan-gated on supported paid tiers. Therefore the application guard is a compensating control, not a replacement for provider-native server-side session invalidation.

## 3. Leaked Password Protection
### Current status — provider blocker remains
Supabase Security Advisor still reports `Leaked Password Protection Disabled`. Built-in leaked-password screening is available on supported paid tiers.

### Strengthened compensating control
Signup and password recovery now require:
- minimum 12 characters;
- at least one letter;
- at least one number;
- at least one symbol;
- rejection of a small local denylist of very common weak patterns.

This local policy is **not equivalent** to HaveIBeenPwned-backed leaked-password screening. Existing sign-in is intentionally not rejected by this UI-only policy.

### Completion criterion
After plan upgrade, enable Supabase Auth leaked-password protection and re-run Security Advisor. Do not mark this item provider-PASS while the Advisor warning remains.

## 4. `SECURITY DEFINER` hardening
### Layer A — financial-writer role enforcement
Migration: `RC1_3_SECURITY_DEFINER_ROLE_HARDENING.sql`

The schema supports role `viewer`. Journal mutation paths are protected by server-side financial-writer checks so `viewer` cannot create/save/post/reverse/delete journal documents through privileged RPC boundaries.

The migration also:
- pins intentional browser-facing SECURITY DEFINER search paths to trusted schemas, with `pg_temp` last where required;
- keeps `PUBLIC` and `anon` execution revoked;
- explicitly grants `authenticated` only to intended RPC boundaries;
- keeps the private writer-role helper non-executable by browser roles.

Transactional verification previously passed: a temporary Viewer probe received `ROLE_NOT_ALLOWED` and the role change was rolled back.

### Layer B — minimize Definer where privilege is unnecessary
Migration: `RC1_3_SECURITY_INVOKER_HARDENING.sql`

The following low-risk configuration/read paths were converted to `SECURITY INVOKER` and backed by explicit RLS:
- `get_money_display_unit(uuid)`
- `get_my_money_display_unit(uuid)`
- `set_my_money_display_unit(uuid,text)`
- `get_workspace_print_profile(uuid)`

Additional access hardening:
- broad `workspace_settings` browser `ALL` access replaced with authenticated member `SELECT` only; direct browser DML revoked;
- `workspace_user_preferences` now has own-user + authorized-Company RLS for SELECT/INSERT/UPDATE;
- `workspace_print_profiles` now has authorized-member SELECT RLS; direct browser writes remain revoked;
- public/anon EXECUTE remains revoked on the converted RPCs.

RLS smoke verification under an authenticated actor:
- other users' preference rows visible: 0;
- visible print profiles: 1;
- authorized Companies for the actor: 1;
- the converted money-unit/profile getters returned successfully.

### Remaining intentional Definer surface
Current database verification after Layer B:
- browser-executable `public` SECURITY DEFINER RPCs for `authenticated`: **22**;
- `anon`-executable SECURITY DEFINER functions: **0**.

The remaining 22 are intentional privileged boundaries for atomic journal/invoice posting, Company/tenant lifecycle, invitation/member management, fiscal close/reopen, guarded Company settings, RLS access helpers, or privileged joins. Supabase Advisor will continue to list them because that lint is exposure-based. They must be regression-tested and minimized individually rather than blindly changed to INVOKER or revoked.

## 5. Accounting-polish security-adjacent corrections
The same release also:
- removed the active-Company `بازگشت به شرکت` action at the rendering source;
- made journal debit/credit totals and balance status deterministic;
- guarantees the active money unit is prepared before print/PDF/CSV output;
- expanded every current Company to 52 system level-2 (`معین`) headings without artificial balances/postings;
- corrected system contra-account natures: accumulated depreciation/amortization = credit, treasury interests = debit.

Post-migration accounting integrity:
- 6 Companies / 393 accounts / 312 system level-2 headings = 52 per Company;
- journal lines: 65;
- level-2 journal postings: 0;
- total debit = total credit = 201,101,351;
- contra-account validation failures: 0.

## Final RC1.3 Gate before Production promotion
1. Run the accounting-polish Live Gate after deployment: Company card state, journal total/balance indicator, print/export unit on financial outputs, and standard account chart.
2. Run two-user / multi-company RLS regression.
3. Verify Owner/Manager/Accountant journal create/save/post/reverse still works.
4. Verify Viewer cannot create/save/post/reverse/delete journal documents.
5. Smoke-test signup and password recovery with weak/strong passwords.
6. Re-run Supabase Security Advisor.
7. Keep built-in Leaked Password Protection and isolated Restore Drill marked BLOCKED until their provider/environment prerequisites are actually satisfied.

`RC1.3-FINAL-POLISH` must not be marked PASS until the post-deploy live UI/print/session checks have actually passed.
