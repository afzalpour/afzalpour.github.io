# RC1.5-C1.4 — Invoice / Manual Journal Stability Live Gate

Date: 2026-09-08
Status: **LIVE PASS — explicit user confirmation**

## Scope
This gate closes the browser-freeze regression that remained after C1.3 and verifies the adjacent manual-journal UI stability path.

## Engineering fix
- Body-wide legacy `MutationObserver` consumers no longer react to text-only `childList` churn while structural/attribute mutations remain observable.
- Invoice `quantity`, `unit_price`, and `discount` input events no longer bubble into the legacy V60 settlement form-level recomputation on every keystroke.
- Target/capture handlers for money formatting, invoice totals, and Tax remain active.
- Settlement totals refresh without structural DOM replacement.
- Regression tests `mutation-stability.spec.mjs` and `invoice-input-stability.spec.mjs` passed in CI.

## Deployment evidence
- PR: #69 — `Stop invoice unit-price mutation storm`
- Merge commit: `113c9fdce66a54f2eedbf5f14009d80d8b11ce90`
- GitHub Pages deployment for the merge completed successfully.
- Runtime change is under `avan-staging/` only; Production root runtime was not promoted.

## Explicit Live acceptance
User tested on Staging and confirmed on 2026-09-08:
- invoice entry, including typing/editing unit price (`فی`), is correct and no browser hang remains;
- manual journal entry was also checked and is correct.

Therefore **RC1.5-C1.4 Live Stability Gate = PASS**.

## Important non-implication
This does **not** mark the full RC1.5-C Tax functional Live Gate as PASS. Controlled Tax activation → taxed invoice → post → VAT report → reversal remains a separate Live functional gate before Production promotion.
