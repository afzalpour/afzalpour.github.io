# AVAN RC1.5 — Final Web/PWA Engineering Gate Evidence

Date: 2026-09-09
Status: **ENGINEERING PASS / LIVE ACCEPTANCE PENDING**

## Scope

This evidence closes the automated Staging engineering path through the full active-runtime regression and final Web/PWA/mobile hardening. It does **not** claim browser/PWA Live PASS and does not promote the Production root runtime.

## Repository evidence

### Full active-runtime regression

- PR #85 — `RC1.5 staging: full active-runtime regression gate`
- PR head: `bbf69f6a0aa12af30c118a24153916a1863172e1`
- merge commit: `6ad04f2b283f81f3260e06484d6f61b9950a45d7`
- PR Actions Run #103: PASS
- post-merge main Actions Run #104: PASS
- Pages Run #312: PASS

The active release regression covers the current accounting/inventory shell, one-Rial money precision, VAT, settlement, reports/print, e-Invoice prevalidation, mobile/PWA boundaries, and Production-vs-Staging environment separation.

Four dormant tests that encoded superseded runtime contracts were retired from the active test tree. In particular, the obsolete rule that Rial invoice input must be divisible by 10 is not allowed to re-enter the release gate; ADR-0019 remains authoritative.

### Final Web/PWA and iPhone hardening

- PR #86 — `RC1.5 staging: final Web/PWA and iPhone hardening`
- PR head: `a87ebed1a4205f03918e7b97453045d93b325ecc`
- merge commit: `5cf9cc9676d8b9af188b3c150be1c8bb32c6d726`
- PR Actions Run #105: PASS
- post-merge main Actions Run #106: PASS
- Pages Run #313: PASS

Implemented hardening:

- final Persian font ownership uses `Vazirmatn` with iOS/system fallbacks instead of loading Vazirmatn while legacy CSS requests an unavailable `IRAN` family;
- `100dvh` and safe-area-aware mobile presentation for iPhone/PWA surfaces;
- PWA orientation is no longer locked to portrait, allowing landscape for accounting tables;
- Service Worker HTML shell fallback is restricted to navigation requests;
- missing JS/CSS/image assets no longer receive `index.html`, preventing MIME / `Unexpected token <` offline failures;
- Staging cache marker: `avan-staging-rc1-v83-final-web-pwa`;
- `sw.js` syntax validation and permanent Web/PWA regression coverage are part of `npm run quality`.

## Latest read-only backend regression baseline

No mutation was performed for this gate.

- unbalanced Posted/Reversed journals: **0**
- orphan journal lines: **0**
- invoice subtotal + tax vs final-total mismatches: **0**
- Posted/Reversed invoices without journal: **0**
- inventory reconciliation failures: **0 across 6 Companies**
- settlement schedule total mismatches: **0**
- orphan settlement schedules: **0**
- orphan financial checks: **0**
- authenticated-executable `public SECURITY DEFINER` functions: **0**
- Posted/Reversed Ledger debit = credit = **4,073,483,384.7 Toman**
- relevant invoice/settlement/check/journal monetary columns remain `numeric(20,1)`.

Current Tax state observed read-only during the regression:

- Tax-enabled Companies/settings: **1**
- e-Invoice enabled on that setting: **0**
- the enabled setting currently has no tax identifier; no data was changed by the engineering gate. If e-Invoice is later enabled, prevalidation is expected to report the missing seller identity as a blocker.

## Release boundary

- repository root remains the RC1.4 Production runtime.
- all changes described here are in `avan-staging/` / test/documentation paths.
- no DB migration was required by PR #85 or PR #86.
- no Production promotion has occurred.
- **Explicit user browser/PWA Live acceptance is the next gate.**

## Required Live acceptance focus

1. Invoice one-Rial precision and amount-in-words (`1515 Rial ↔ 151.5 Toman`).
2. VAT-inclusive final total flowing exactly into Settlement when Tax is enabled.
3. Sale/purchase invoice save plus credit/cash/check/installment/mixed Settlement UI.
4. Prepared reports and receipt/payment/transfer detail unit presentation.
5. iPhone/mobile font, safe-area, keyboard and toast behavior.
6. PWA install/open/offline shell behavior without JS/CSS MIME errors.
7. e-Invoice preflight findings with explicit confirmation that nothing is transmitted.

Only explicit user acceptance may change this gate from Engineering PASS to Live PASS.
