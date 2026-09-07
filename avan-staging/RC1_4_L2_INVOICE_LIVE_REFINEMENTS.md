# Avan — RC1.4-L2 Invoice Live Refinements

Date: 2026-09-07
Environment: Staging (`avan-staging/`)
Production root: unchanged

## Status
**CODE COMPLETE / DEPLOYED / USER LIVE CHECK PENDING**

## User-reported issues addressed
1. Sales/Purchase invoice form now uses a single workspace-style modal, matching the inventory document UX: fixed header/details/footer with only the line area scrolling. Desktop uses a wide modal; mobile/iPhone uses a full-screen modal without page back-and-forth navigation.
2. Invoice `طرف‌حساب` is no longer dependent on the legacy page workspace context. It is loaded directly from the currently active Company and filtered correctly:
   - Sale: customer / both
   - Purchase: vendor / both
3. If the active Company has no suitable party, the invoice window now provides an inline `＋ طرف‌حساب` control. Name/type/phone are saved without closing the invoice; the new party is immediately selected.
4. Invoice line account selectors are re-synced from the active Company's postable accounts.
5. Purchase inventory lines default to the Inventory Asset role only when the selected item is actually `inventory`; services and non-inventory items are not forced to Inventory Asset.
6. Standard-precision invoice saves are routed with the active Company ID. The existing six-decimal inventory bridge remains responsible for >3-decimal inventory quantities.

## Assets
- `rc14-invoice-live-refinements.js`
- `rc14-invoice-live-refinements.css`
- `index.html` loads both assets.
- Staging Service Worker cache: `avan-staging-rc1-v58`.

## Deployment
Latest functional commit:
`e7f0d557e1980c16f9257c7d5032d6e467c18b84`

GitHub Pages run:
`34094764374`

Result: `completed / success`.

## Correct stock-aware workflow
### Sale
A previous stock receipt/opening must have created available stock. The user then goes directly to `فاکتورها → فروش`, selects the inventory item and source warehouse, and posts the invoice. Posting the sale automatically creates the linked inventory Issue and COGS accounting. A separate manual Issue is not required.

### Purchase
Physical receipt is posted first in `کالا و انبار → اسناد انبار → رسید`. The user then goes to `فاکتورها → خرید`, selects the same inventory item and the exact Posted Receipt line, and posts the purchase invoice. The invoice clears GRNI to Accounts Payable and must not increase inventory a second time.

## Remaining user live check
- Open Sale Invoice: confirm single-window layout and party selector/inline creation.
- Open Purchase Invoice: confirm single-window layout and party selector/inline creation.
- Post one stock Sale and reverse it: stock decreases/restores automatically.
- Post one matched Purchase invoice against a Posted Receipt: inventory does not increase again.
- Confirm the same invoice modal remains usable on iPhone/mobile.
