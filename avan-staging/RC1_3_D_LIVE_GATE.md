# Avan — RC1.3-D Full Regression Live Gate

Date: 2026-09-06

## Automated / server-side regression — PASS
The following have already been executed against the connected Supabase project. Do not repeat them manually unless a new Blocker/Critical fix changes the relevant area.

- Multi-company RLS across workspaces, journals, invoices, documents, settings, print profiles, audit, fiscal years and user preferences: PASS.
- Storage tenant isolation: PASS; both buckets private, storage.objects RLS enabled, foreign Company objects visible = 0.
- Platform Admin / Company Admin / Support separation: PASS; Platform Admin gained no Company membership or ordinary ledger access; controlled Support remained read-only and revoke worked.
- Tenant suspend/reactivate lifecycle: PASS.
- New Company onboarding through public SECURITY INVOKER RPC: PASS; Owner role, 65 accounts, 52 standard level-2 headings, 8 account roles, 2 financial accounts, no duplicate account codes.
- Journal Draft → Posted → Reversed lifecycle: PASS; both original/reversal journals balanced and immutable protections enforced.
- Invoice Draft → Posted → Reversed lifecycle: PASS after RC1.3-D reversal-link fix.
- Reports/runtime RPCs: PASS, including trial balance, journal, balance sheet, P&L, cash/bank, general ledger and account statement; foreign Company report rows = 0.
- Money display unit RPC toggle: PASS.
- Fiscal period close/reopen transaction test: PASS.
- Accounting integrity: total debit = total credit = 201101351; orphan journal lines = 0; unbalanced Posted/Reversed = 0; invoices without posting journal = 0.
- SECURITY DEFINER boundary: public SECURITY DEFINER functions executable by authenticated = 0.
- Security Advisor after DDL change: no new security warning; tracked Free-tier leaked-password warning remains provider-limited.

RC1.3-D regression fix committed as:
- `99c3ee7b7d21a8de003026081e350d41a852af89`
- `avan-staging/APPLIED_RC13_D_INVOICE_REVERSAL_INTEGRITY_FIX.sql`

## Recheck on 2026-09-06 after print fixes
- Standard chart: 6/6 Companies have exactly 52 system level-2 (`معین`) headings.
- Standard level-2 headings that are postable: 0.
- Account balances are Ledger-derived; accounts table does not carry a stored balance field.
- Reversed invoices currently present: 5.
- Reversed invoices with missing/invalid `reversal_journal_entry_id`: 0.

Therefore **Accounts** and **reversed-invoice accounting-link** checks are CLOSED server-side and do not require another user financial mutation.

## Confirmed Live PASS evidence
- **Print layout corrections — PASS** by user on 2026-09-06.
  - correct `واحد مبالغ: تومان/ریال` presentation;
  - technical journal/invoice subtitles removed;
  - requested journal/invoice table alignment applied;
  - `اقدام` removed from printed list output;
  - list print/PDF works.
- **Single journal/invoice print — PASS** by user on 2026-09-06.
  - detail modal `چاپ / ذخیره PDF` works for journals and invoices.
- **Money unit toggle — PASS**.
- **Company switching / active-company behavior — PASS** by user on 2026-09-06.
  - active Company selection works;
  - switching between Companies works.

## RC1.3-D fixes after latest Live feedback
### Company Portfolio action layout
User found an owner/admin Company card could show both `تغییر نام` and `ورود به شرکت`, causing CSS Grid to auto-place `ورود به شرکت` unattractively below the card.

Fix applied:
- `rc13-final-polish.css` now pins Rename and Enter into a stable action column on desktop;
- mobile keeps full-width stacked actions;
- active-company indicator remains in the same action column.

Commit:
- `aad098d75d835b8086cfe55c1f0fa8bdab06169d`

Status: **FIXED / Live visual retest pending**.

### Revoked / missing Supabase Session recovery
User encountered:
`session from session_id claim in JWT does not exist`

Supabase session semantics confirm that the JWT `session_id` must correspond to a row in `auth.sessions`; a missing row means the server-side session is terminated.

Fix applied:
- `supabase-auth.js` clears a revoked/missing local session instead of reusing the still-time-valid JWT;
- password login explicitly starts from a clean local session and stores only the newly issued session;
- `rc13-session-security.js` returns the UI to the Auth shell when the server session disappears;
- raw Supabase session errors are localized in `error-messages-fa.js`;
- active Company local selection is cleared when the auth session becomes invalid;
- Staging PWA cache bumped to `avan-staging-rc1-v48`.

Commits:
- `d8199e844fff1daf42068b5c9c1dd2f41debe4dd`
- `74c748c8ef9276f0aa5706bf5317a96913743e55`
- `0cebe9d585c4ddd0f96787190f4011f8fc400eee`
- `dfa917c2cdc1dd37f774b746997f1c6fe8b31e7c`

Status: **FIXED / Live login retest pending**.

## Remaining User Live checks
Hard Refresh Staging first.

1. **Company Portfolio polish retest**
   - On a non-active Company where the user can rename it, `تغییر نام` and `ورود به شرکت` must stay neatly aligned inside the card.
   - `ورود به شرکت` must not drop unattractively below the card.

2. **سند حسابداری**
   - Open one journal detail.
   - Bottom shows debit/credit `جمع کل`.
   - A balanced document shows `✓ سند تراز است`.

3. **iPhone / mobile**
   - Main navigation and `بیشتر` sheet open normally.
   - No horizontal page overflow except intentional finance-table scrolling.
   - Modal is usable and bottom navigation does not collide with the iPhone home indicator.

4. **Auth smoke after Session recovery fix**
   - Hard Refresh once; an obsolete Session should be discarded instead of showing the raw `session_id claim` error.
   - Existing-user login must create a fresh valid session and enter the app.
   - Signup/recovery UI rejects a password under 12 characters or without letter + number + symbol.
   - Recovery flow remains reachable.

### Static implementation already verified for the remaining checks
- Journal detail enhancer calculates debit/credit totals and adds balanced/unbalanced status.
- iPhone CSS includes safe-area handling, `100dvh`, 16px form controls, modal viewport protection and safe bottom navigation.
- Password guard applies 12-character + letter + number + symbol policy to signup/recovery while existing-user login remains compatible with the existing login path.

## PASS phrase
If the remaining Live checks pass, reply exactly or equivalently:

`Gate RC1.3-D پاس شد`

That user confirmation also closes the pending Final Polish visual gate because all remaining Final Polish checks are included here.

## After PASS
Move immediately to **RC1.3-RC**:
- feature freeze;
- Blocker/Critical fixes only;
- final staging-to-production promotion checklist;
- no new feature work before first Production release.

The full external logical-dump + Storage isolated restore remains a separately tracked OPEN limitation under the zero-charge policy and does not get mislabeled as PASS.
