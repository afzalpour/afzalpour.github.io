# Avan — RC1.3-D Status

Date: 2026-09-06

## Current status
- Automated/server-side Full Regression: **PASS**.
- RC1.3-D invoice reversal integrity defect: **FIXED / REGRESSION PASS**.
- User Live UI Gate: **PASS** — user explicitly confirmed `Gate RC1.3-D پاس شد` on 2026-09-06.
- Final Polish visual gate: **PASS** through the same completed RC1.3-D Live checks.
- Current phase: **RC1.3-RC / Feature Freeze**.
- Freeze rule: **no new features; Blocker/Critical fixes only until Production promotion decision**.

## Final pre-RC server verification — 2026-09-06
- Workspaces: 6.
- Accounts: 393.
- Journal entries: 30.
- Journal lines: 67.
- Invoices: 11.
- Ledger debit = credit = **201581351** canonical Toman.
- Orphan journal lines = 0.
- Unbalanced Posted/Reversed journals = 0.
- Reversed invoices with missing/invalid reversal journal link = 0.
- Companies without exactly 52 system level-2 standard headings = 0.
- Critical public tables without RLS = 0.
- `public` SECURITY DEFINER functions executable by `authenticated` = 0.

## Security Advisor
- No new authenticated-public-SECURITY-DEFINER warning.
- INFO-only deny-by-default/no-policy notices remain for private control-plane tables and `workspace_invitations`.
- The only WARN remains Supabase **Leaked Password Protection Disabled**; this is provider/plan-limited under the project's zero-charge policy and remains compensated by the application password-strength/denylist controls.

## Relevant files
- `avan-staging/RC1_3_D_LIVE_GATE.md`
- `avan-staging/APPLIED_RC13_D_INVOICE_REVERSAL_INTEGRITY_FIX.sql`
- `avan-staging/RC1_3_RC_PROMOTION_GATE.md`

## Relevant commits
- Invoice reversal integrity fix: `99c3ee7b7d21a8de003026081e350d41a852af89`
- Desktop print recovery: `149b87df0d9561eaf23b7dffd1857616e530d641`
- Live print polish: `1d4577953330462bb7f4b5d6fcd9a9b8d368e830`
- Detail print recovery hardening: `cd2e3bc45399e3da95c17f76667c74fe2f2125e8`
- Auth rollback after RC blocker: `38500077cc2fb9c3a055c4d53f4f69e0f20ac21e` and `c8f1f13004d1e4a41bb4bf4c73b298f847026140`.

## Next
Stay in **RC1.3-RC Feature Freeze** and execute only the staging-to-production promotion gate. Production/root must not be changed until the explicit Production promotion decision.