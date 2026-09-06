# Avan — Backup / Restore Runbook

## Current platform state
- Supabase project: `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Current organization/project tier recorded for this gate: **Free**.
- Project operating constraint: use **zero-charge paths only**; do not provision paid Supabase projects/branches or depend on paid-only controls unless this policy is explicitly changed in the future.
- Managed downloadable database backups / advanced recovery features must not be assumed on the current tier.
- Avan therefore requires an operator-controlled logical database backup plus a separate Storage-object backup until a genuinely free external recovery workflow is available.
- Database backup and Storage object bytes are separate recovery assets; a complete recovery set must contain both.

## Recovery objectives for Core 1.0
Until real production usage supports tighter measured objectives, use these operational targets:
- Database logical backup: at least daily, and additionally before every production migration/release.
- Storage object backup: at least daily, and additionally before destructive document/storage operations.
- Retention: at least 7 daily copies plus 4 weekly copies in encrypted off-site storage.
- Integrity: every backup receives a SHA-256 checksum and a manifest.
- A backup is not considered recoverable merely because it exists; at least one isolated restore drill must pass before the full external disaster-recovery gate can be marked PASS.

## Complete backup set
A complete Avan recovery point contains:
1. PostgreSQL logical dump (schema + data, including Auth/Storage metadata to the extent supported by the current documented Supabase workflow).
2. Separate byte-for-byte backup of private Storage objects, preserving bucket/path hierarchy.
3. Storage manifest with object path, size and checksum.
4. Application release SHA and the exact database migration set at the backup point.
5. Operational configuration checklist: Auth redirect URLs/settings, SMTP, Edge Functions, Storage bucket configuration/policies, API/publishable-key configuration and external-provider settings.
6. Backup manifest containing UTC timestamp, project ref, release SHA, dump checksum, dump size, object count/checksum summary and operator identity.

Never put database passwords, service-role keys, access tokens or provider secrets in Git or in the backup manifest.

## Free-tier database backup procedure
Run from a trusted operator machine or CI secret environment using the current Supabase CLI/documented workflow and project credentials.

Recommended workflow:
1. Authenticate the trusted operator (`supabase login`).
2. Link the protected operations directory to `dkyqsxnllvxypigxpygo`.
3. Create a logical dump using the current documented `supabase db dump` workflow.
4. Encrypt the dump before it leaves the trusted machine.
5. Calculate SHA-256 and record it in the manifest.
6. Record release SHA, migration head, UTC timestamp, database size and row-count baseline.
7. Upload the encrypted dump + manifest to the off-site retention location.

## Storage backup procedure
A database dump alone does not constitute a complete document recovery set.
For every private bucket:
1. Enumerate object paths and metadata.
2. Copy every object byte to encrypted off-site object storage while preserving bucket/path hierarchy.
3. Record path, byte size and SHA-256 in the Storage manifest.
4. Compare source object count with backup object count.
5. Treat count or checksum mismatch as backup failure.

## Restore drill — mandatory isolated target
**Never run a destructive restore drill against the live Avan project.**

Procedure for a full external drill when a genuinely free isolated target is available:
1. Provision an isolated scratch Supabase/PostgreSQL target that does not incur a charge.
2. Restore the logical database dump into the isolated target using the current supported restore workflow.
3. Recreate configuration that is not contained in the dump: Auth settings/redirects, Edge Functions, Storage configuration, keys/secrets and provider configuration.
4. Restore Storage object bytes into the corresponding private buckets.
5. Deploy the exact Avan release SHA recorded in the backup manifest.
6. Run the data, accounting and authorization validation below.
7. Record PASS/FAIL evidence, RPO point, elapsed restore time (observed RTO), dump checksum and restored object checksum summary.
8. Destroy the scratch environment after evidence has been retained.

## Financial/data validation after restore
Required PASS checks:
- Workspace/Company count matches the backup manifest.
- Membership/role counts match.
- Account count and standard chart version match.
- Journal entry/line counts match.
- Total debit equals total credit.
- Orphan journal lines = 0.
- Posted/Reversed journals unbalanced = 0.
- Posted/Reversed invoices without linked journal = 0.
- Account roles have no broken references.
- Standard account chart has no duplicate `(workspace_id, code)`.
- Every current Company has the expected standard level-2 chart count.
- Private Storage object count and checksums match the manifest.

## Authorization validation after restore
- Owner/Manager/Accountant behavior matches production RLS.
- A user can read an authorized Company and receives zero rows for an unrelated Company.
- Suspended/archived Company cannot access its ledger.
- Platform Admin does not gain Company membership or ordinary ledger access.
- Support Session remains time-bound and read-only.
- Personal user preferences cannot be read/written by another user.
- Company print-profile data is readable only to authorized Company members and writable only through the guarded owner/manager workflow.

## Full external restore-drill status — 2026-09-06
**Status: OPEN / NOT YET A FULL EXTERNAL RESTORE PASS.**

A destructive or pseudo-restore was deliberately not run against `Avan-production`. The currently connected free tooling does not provide a no-cost isolated Supabase target plus a materialized logical dump and Storage-byte restore target. A paid/chargeable branch was explicitly rejected under the project zero-charge policy. Therefore the full external disaster-recovery gate remains open until an actual backup artifact can be restored into a genuinely free isolated target.

The production recovery baseline remains:
- database size: 14,167,187 bytes (~13.5 MiB)
- Companies/Workspaces: 6
- Workspace memberships: 6
- Accounts: 393
- Journal entries: 29
- Journal lines: 65
- Invoices: 11
- Storage objects: 23
- total debit: 201,101,351
- total credit: 201,101,351
- orphan journal lines: 0
- unbalanced Posted/Reversed journals: 0
- Posted/Reversed invoices without journal: 0

This baseline must be copied into the first real backup manifest and compared with the isolated restored copy (adjusted for any legitimate transactions occurring after that recovery point).

## Free transactional recovery rehearsal — PASS — 2026-09-06
A zero-charge, non-destructive data-layer recovery rehearsal was executed directly inside PostgreSQL using transaction-scoped TEMP tables. This rehearsal does **not** modify permanent production tables: source tables were copied into temporary recovery copies, validated, and discarded automatically at transaction/session end.

Evidence:
- public/private base tables copied: **26**
- total rows copied into TEMP recovery copies: **841**
- count + deterministic content-hash matches: **26 / 26**
- checksum/count failures: **0**
- recovered-copy total debit: **201,101,351**
- recovered-copy total credit: **201,101,351**
- orphan journal lines: **0**
- unbalanced Posted/Reversed journals: **0**
- Posted/Reversed invoices without linked journal: **0**
- broken account-role references: **0**
- Companies without exactly 52 standard level-2 system headings: **0**
- minimum standard level-2 headings per Company: **52**
- maximum standard level-2 headings per Company: **52**
- accounting/data recovery-integrity result: **PASS**

Current RLS tenant-isolation was then re-tested with the real `authenticated` database role and a transaction-local simulated user identity:
- authorized Company visible: **1 row**
- unrelated Company visible: **0 rows**
- authorized Company accounts visible: **68 rows** for the selected anonymous test membership
- unrelated Company accounts visible: **0 rows**
- tenant-isolation result: **PASS**

Current privileged-function contract was also verified:
- `public` SECURITY DEFINER functions executable by `authenticated`: **0**
- hardened public SECURITY INVOKER RPC wrappers: **20**
- corresponding privileged implementations retained in `private`: **20**
- security-boundary contract: **PASS**

The reusable rehearsal is versioned at:
- `avan-staging/FREE_TRANSACTIONAL_RECOVERY_REHEARSAL.sql`

### What this PASS proves
- Current database rows can be copied into an independent temporary recovery set without count/content drift.
- Core accounting invariants remain valid on the recovered copies.
- Current tenant RLS still blocks an unrelated Company after the SECURITY DEFINER hardening.
- Public privileged RPC exposure remains closed.

### What this PASS does not prove
This is **not** a full disaster-recovery restore pass because it does not restore:
- an external PostgreSQL logical dump,
- Auth/Storage platform metadata into a fresh Supabase stack,
- private Storage object bytes from an external backup,
- operational configuration into an independent target.

Accordingly, mark the transactional recovery rehearsal **PASS**, while keeping the full external restore gate **OPEN**.

## First real external restore drill acceptance record
The first full external drill may be marked PASS only when all of the following are recorded:
- source backup timestamp and SHA-256
- genuinely free isolated target identifier
- restored release SHA/migration head
- database validation checklist PASS
- Storage count/checksum PASS
- RLS/tenant-isolation checks PASS
- observed restore start/end timestamps and RTO
- operator/reviewer sign-off

## Free-only production posture
While the zero-charge project policy remains active:
- do not create paid Supabase branches/projects;
- do not make paid-only Auth/backup controls a release dependency;
- keep application-level session/password compensating controls enabled;
- continue independent count/hash/integrity recovery rehearsals after material schema changes;
- maintain separate encrypted database and Storage backup procedures whenever a trusted free operator environment is available;
- retain the full external restore gate as OPEN until a genuinely free isolated restoration path becomes available.
