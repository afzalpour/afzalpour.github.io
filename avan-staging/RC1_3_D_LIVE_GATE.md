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
- Historical reversed-invoice link repair: PASS; 4/4 reversed invoices now have valid reversal_journal_entry_id, bad/missing links = 0.
- Reports/runtime RPCs: PASS, including trial balance, journal, balance sheet, P&L, cash/bank, general ledger and account statement; foreign Company report rows = 0.
- Money display unit RPC toggle: PASS.
- Fiscal period close/reopen transaction test: PASS.
- Accounting integrity: total debit = total credit = 201101351; orphan journal lines = 0; unbalanced Posted/Reversed = 0; invoices without posting journal = 0.
- SECURITY DEFINER boundary: public SECURITY DEFINER functions executable by authenticated = 0.
- Security Advisor after DDL change: no new security warning; tracked Free-tier leaked-password warning remains provider-limited.

RC1.3-D regression fix committed as:
- `99c3ee7b7d21a8de003026081e350d41a852af89`
- `avan-staging/APPLIED_RC13_D_INVOICE_REVERSAL_INTEGRITY_FIX.sql`

## User Live UI Gate
Hard Refresh Staging first.

### Confirmed Live PASS evidence
- **Print layout corrections — PASS** by user on 2026-09-06.
  - correct `واحد مبالغ: تومان/ریال` presentation;
  - technical journal/invoice subtitles removed;
  - requested journal/invoice table alignment applied;
  - `اقدام` removed from printed list output;
  - list print/PDF works.
- **Single journal/invoice print — PASS** by user on 2026-09-06.
  - detail modal `چاپ / ذخیره PDF` restored for both journals and invoices.
- **Money unit toggle — PASS**: user confirmed Toman/Rial switching works; print presentation was subsequently accepted in the print-layout PASS above.

Therefore checks 3 and 4 below are CLOSED and must not be repeated unless a later Blocker/Critical print fix touches them.

### Remaining Live checks
1. **شرکت‌های من**
   - Active Company shows `شرکت انتخاب‌شده`.
   - Misplaced `بازگشت به شرکت` is not shown on the active card.
   - Entering another Company still works.

2. **سند حسابداری**
   - Open a journal detail.
   - Bottom shows `جمع کل` debit/credit.
   - Balanced document shows `✓ سند تراز است`.

3. **چاپ / PDF — CLOSED / PASS**
   - List print/PDF PASS.
   - Single journal print/PDF PASS.
   - Single invoice print/PDF PASS.
   - Company identity/unit presentation accepted.

4. **تومان / ریال — CLOSED / PASS**
   - Display unit switching works.
   - Print unit presentation accepted.

5. **حساب‌ها**
   - Standard chart looks complete through level `معین` across دارایی/بدهی/حقوق مالکانه/درآمد/هزینه.
   - Standard headings are raw/non-postable; existing custom accounts are still present.

6. **فاکتور برگشتی**
   - Open an existing reversed invoice if one is available.
   - UI opens normally and does not show a broken accounting-link/error state.
   - No need to create another financial reversal solely for this gate.

7. **iPhone / mobile**
   - Main navigation and `بیشتر` sheet open normally.
   - No horizontal page overflow except intentional finance-table scrolling.
   - Modal is usable and bottom navigation does not collide with the iPhone home indicator.

8. **Auth smoke**
   - Existing-user login works.
   - Signup/recovery UI rejects a password under 12 characters or without letter + number + symbol.
   - Recovery flow remains reachable.

## PASS phrase
If all remaining checks pass, reply exactly or equivalently:

`Gate RC1.3-D پاس شد`

That user confirmation also closes the pending Final Polish visual gate because its remaining checks are included above.

## After PASS
Move immediately to **RC1.3-RC**:
- feature freeze;
- Blocker/Critical fixes only;
- final staging-to-production promotion checklist;
- no new feature work before first Production release.

The full external logical-dump + Storage isolated restore remains a separately tracked OPEN limitation under the zero-charge policy and does not get mislabeled as PASS.