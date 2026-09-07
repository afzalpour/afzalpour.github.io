# RC1.4 — Promotion Readiness

Status: **READY FOR PRODUCTION PROMOTION — explicit release authorization still required**

Date: 2026-09-07

## Final Staging release

- Staging cache: `avan-staging-rc1-v64`
- v64 purpose: live three-digit grouping for settlement amount inputs, including mixed and installment settlement rows.
- GitHub Pages deployment for v64: PASS.
- Production root was not changed during this readiness gate.

## Accounting integrity

- Ledger debit: `4,073,481,351`
- Ledger credit: `4,073,481,351`
- Unbalanced Posted/Reversed journal entries: `0`
- Orphan journal lines: `0`
- Postable accounts with active children: `0`

## Inventory integrity

`public.inventory_financial_reconciliation` is reconciled for all six workspaces.

Active company evidence:
- Movement Ledger value: `1,123,500,000`
- Inventory account balance: `1,123,500,000`
- Inventory difference: `0`
- Issue movement COGS: `32,500,000`
- COGS account balance: `32,500,000`
- COGS difference: `0`

## Invoice / settlement integrity

- Settlement-plan total mismatches: `0`
- Orphan settlement schedules: `0`
- Orphan financial checks: `0`
- Duplicate check identities under the current identity rule: `0`
- Check identity rule: same bank + same check number is allowed only when distinct account numbers identify distinct checks; when account number is missing, the conservative bank + number uniqueness protection remains.

## Security gate

- Public `SECURITY DEFINER` functions executable by `authenticated`: `0`
- Security Advisor: no new RC1.4 security blocker.
- Existing `auth_leaked_password_protection` warning remains OPEN because the project is on the Supabase Free plan; it is not falsely marked PASS.
- Existing RLS-no-policy INFO notices on private deny-by-default tables and `workspace_invitations` are unchanged.

## Performance advisor

Existing informational index/RLS-policy optimization notices remain. No new performance blocker introduced by v64. These are non-blocking hardening items and should be handled in a separate optimization cycle rather than changing the validated RC1.4 release candidate.

## Localization core rule

User-visible UI text and errors must be Persian, clear and fluent. Raw PostgreSQL/Supabase/backend error strings or technical enums must never be shown directly to the user. Standard technical terms that are clearer in their accepted form, such as PDF, CSV and SKU, may remain.

## Release decision

RC1.4 is **Promotion Ready** from the engineering perspective. The next irreversible action is copying/promoting the validated Staging runtime into Production root, which requires explicit production-release authorization.
