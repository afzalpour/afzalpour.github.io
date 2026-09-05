# Avan — Backup / Restore Runbook

## Current platform state
- Supabase project: `Avan-production`
- Current organization plan: **Free**.
- Supabase managed daily backups are available on Pro/Team/Enterprise, not the current Free plan.
- On Free, Avan must maintain regular logical database dumps off-site.
- Supabase database backups do **not** contain Storage object bytes; Storage needs a separate backup.

## Recovery objectives for Core 1.0
Until production usage data is available, use these conservative operational targets:
- Database logical backup: at least daily; before every production migration/release additionally.
- Storage object backup: at least daily; before destructive document/storage operations additionally.
- Keep at least 7 daily copies plus 4 weekly copies in an encrypted off-site location.
- A backup is not considered usable until a restore drill has validated it.

## Backup set
A complete Avan backup set contains:
1. PostgreSQL database logical dump (schema + data, including auth/storage metadata where supported by the documented Supabase CLI workflow).
2. A separately exported inventory and byte copy of private Storage objects.
3. Repository release SHA and migrations corresponding to the backup point.
4. Operational configuration checklist: Auth redirect URLs/settings, SMTP, Edge Functions, API/publishable-key configuration, Storage bucket policies and any external provider settings. Never store service-role/secret keys in Git.

## Free-plan database backup procedure
Run from a trusted operator machine/CI secret environment using current Supabase CLI documentation and project credentials. Do not place database passwords or secret keys in shell history or Git.

Recommended workflow:
1. `supabase login` using the operator account.
2. `supabase link --project-ref dkyqsxnllvxypigxpygo` in a protected operations directory.
3. Create the logical dump with the current documented `supabase db dump` workflow.
4. Encrypt the resulting dump before off-site upload.
5. Record UTC timestamp, release commit SHA, dump checksum and database size in the backup manifest.

## Storage backup procedure
Database dump only preserves Storage metadata, not object bytes.
For every private bucket:
1. Enumerate object paths and object metadata.
2. Copy every object byte to encrypted off-site object storage while preserving bucket/path hierarchy.
3. Produce a manifest containing path, size and checksum.
4. Compare source object count/manifest with the backup copy.

## Restore drill — mandatory isolated target
Never run a drill against the live Avan project.
1. Provision an isolated Supabase scratch project/approved development branch.
2. Restore the logical database dump using the current Supabase backup/restore migration guidance.
3. Recreate configuration not contained in the dump: Auth settings/redirects, Edge Functions, Storage configuration, keys/secrets and provider configuration.
4. Restore Storage object bytes into the corresponding private buckets.
5. Deploy the exact Avan application release SHA recorded in the backup manifest.
6. Run the validation checklist below.
7. Destroy the scratch environment after the drill and retain only the drill report/checksums.

## Financial/data validation after restore
Required PASS checks:
- Workspace/Company count matches backup manifest.
- User/membership and role counts match.
- Journal entry/line counts match.
- Total debit equals total credit.
- orphan journal lines = 0.
- Posted/Reversed journals unbalanced = 0.
- Posted invoices without linked journal = 0.
- Account roles have no broken references.
- Standard account chart exists without duplicate `(workspace_id, code)`.
- Private document Storage object count/checksum matches backup manifest.

## Authorization validation after restore
- Owner/Manager/Accountant behavior matches production RLS.
- A user can read its authorized Company and receives zero rows for an unrelated Company.
- Suspended/archived Company cannot access its ledger.
- Platform Admin does not gain Company membership/ordinary ledger access.
- Support Session remains time-bound and read-only.

## Restore-drill status for current Free project
As of 2026-09-05 the database readiness baseline has been recorded, but a **true isolated restore drill has not yet been executed** because the connected environment does not provide a no-cost isolated restore target or a downloadable `db dump` artifact. Do not mark restore readiness PASS until an actual dump has been restored into an isolated target and the checks above have passed.

Current pre-drill baseline recorded in the live database:
- database size: 13 MB
- Storage objects: 23
- orphan journal lines: 0
- unbalanced Posted/Reversed journals: 0
- Posted/Reversed invoices without journal: 0

## Upgrade recommendation before commercial Production
Before onboarding paying customers, move the Supabase organization/project to an appropriate paid production tier so managed daily backup retention is available. If business RPO/RTO requires finer recovery points, evaluate PITR separately based on current Supabase pricing and retention requirements.
