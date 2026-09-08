# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-08 — AC-1 Engineering PASS / RC1.5-C Backend PASS / C1.4 invoice-stability engineering PASS / Live retest pending**.

این فایل Source of Truth وضعیت جاری پروژه است. Gateهای Live فقط با تأیید صریح کاربر PASS می‌شوند.

---

## 1) Current release state
Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / release evidence / next-cycle workspace**.
- Supabase financial Source of Truth = project `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Project cost policy = **zero-charge paths only**.
- Production URL = `https://afzalpour.github.io/`.

### Current status
- **RC1.4 Inventory / Sales-Purchase / Settlement = Production Released**.
- Production promotion commit: `81b5c54643267842a8f225ee09668ade2fc95052`.
- **RC1.5-C / C.1 remains Staging-only and Live Gate is NOT PASS.**
- User explicitly confirmed C.1.2 staging generally healthy, then reported a reproducible full-browser freeze while typing invoice unit price (`فی`). C1.3 did not resolve the Live issue.
- **C1.4 invoice-stability engineering gate PASS; user Live retest pending.**
  - body-wide legacy MutationObservers ignore text-only childList churn while retaining element/attribute mutations;
  - invoice `quantity` / `unit_price` / `discount` input events no longer bubble into the legacy V60 settlement form-level recomputation on every keystroke;
  - target/capture handlers for money formatting, invoice totals and tax remain active;
  - settlement totals are refreshed without structural DOM replacement;
  - regression tests `mutation-stability.spec.mjs` and `invoice-input-stability.spec.mjs` PASS;
  - Production root runtime remains untouched.
- Platform Admin C1.3 user management remains staged: all Auth users including users without company membership are listed; email can be edited; destructive deletion is guarded for self/platform admins/company owners.
- Manual journal one-viewport layout remains staged and still requires user Live verification after the invoice freeze is cleared.

### Integrity baseline after C1.3 backend work
- Ledger debit = credit = **4,073,481,351 Toman**.
- orphan journal lines = **0**.
- unbalanced Posted/Reversed journals = **0**.
- tax-enabled companies = **0**.
- public SECURITY DEFINER executable by authenticated = **0**.

---

## 2) Production discipline
- Root Production runtime must not be modified while RC1.5-C/C.1 is under Live testing.
- Staging changes are promoted to Production only after explicit user PASS.
- `app.js` remains the Compatibility Shell during the Strangler migration; no full rewrite.
- One quarantined legacy direct client overwrite remains in `rc14-catalog-settlement-v60.js`; no unauthorized new overwrite is permitted.

---

## 3) Next gate
1. Publish C1.4 to `/avan-staging/` after CI/merge.
2. User Live retest: repeatedly type/backspace unit price in sale invoice and a newly added second row.
3. If freeze is cleared, verify Platform Admin user edit/list behavior and manual-journal one-viewport layout.
4. Only explicit user confirmation can close the C1.4 Live Gate.
5. Production root promotion remains blocked until that confirmation.
