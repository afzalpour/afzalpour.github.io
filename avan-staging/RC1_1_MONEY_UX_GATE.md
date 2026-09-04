# Avan Core 1.0 — RC1.1 Money UX Gate A

## Scope
This Gate validates presentation-only money UX changes on the already validated RC1 accounting runtime.

Included:
- Three-digit grouping while typing monetary values.
- Persian amount-in-words helper below monetary inputs.
- Global topbar `دریافت` / `پرداخت` buttons removed.
- Sidebar receipt/payment/transfer and mobile `＋ ثبت` remain available.
- PWA staging cache bumped to RC1 v4.

Not included in Gate A:
- Rial/Toman switching. RC1 currently treats entered/displayed monetary values as Toman in the browser runtime. A database-boundary currency refactor will be Gate B so existing ledger amounts are never reinterpreted by a cosmetic toggle.
- Workspace user administration.
- Theme customization.
- Font asset migration.

## A1 — Receipt input
1. Open `دریافت` from the sidebar (or mobile quick menu).
2. In مبلغ type `123456789`.
3. Expected visible value: `123٬456٬789`.
4. Expected helper text: `صد و بیست و سه میلیون و چهارصد و پنجاه و شش هزار و هفتصد و هشتاد و نه تومان`.
5. Put the cursor in the middle of the amount and insert/delete one digit.
6. Expected: grouping is recomputed and the cursor remains near the edited digit.

## A2 — Payment / transfer
Repeat a short amount test in `پرداخت` and `انتقال`.
Expected: grouping and amount-in-words work in both forms.

## A3 — Manual journal
1. Open a new manual Draft journal.
2. Enter `1000000` in Debit and `1000000` in Credit on two valid rows.
3. Expected each input shows `1٬000٬000`.
4. Expected each helper shows `یک میلیون تومان`.
5. Save as Draft, reopen, then delete the temporary Draft.
6. Expected: existing Draft lifecycle remains unchanged.

## A4 — Invoice fields
1. Open a sale or purchase invoice Draft.
2. Enter quantity `2`.
3. Enter unit price `1250000`.
4. Enter discount `50000`.
5. Expected:
   - quantity stays `2` with NO amount-in-words helper;
   - unit price shows `1٬250٬000` + words;
   - discount shows `50٬000` + words;
   - invoice total calculation remains correct.
6. Delete/close the temporary Draft if it is not needed.

## A5 — Accounting integrity smoke check
Post ONE test operation only if a disposable test transaction is acceptable; otherwise use the existing Draft-only regression route.

If posting:
1. Enter `1234567` in an operation form.
2. Confirm it is displayed as `1٬234٬567` before submit.
3. After posting, open the journal/report and confirm the ledger amount is exactly `1٬234٬567` — not multiplied/divided by 10 and not changed by separators.
4. Reverse the test operation if required by the test dataset policy; do not delete Posted ledger rows.

## A6 — Header/navigation
- Desktop topbar must NOT show global `دریافت` and `پرداخت` buttons.
- Sidebar must still show `دریافت`, `پرداخت`, `انتقال`.
- Mobile bottom navigation must still show `＋ ثبت` and its quick actions.

## A7 — iPhone / mobile
On Safari iPhone (or responsive mobile plus one real iPhone if available):
- Open a money field.
- Type at least 9 digits.
- Confirm separators appear during typing.
- Confirm amount-in-words wraps without horizontal overflow.
- Confirm keyboard/input remains usable and modal can scroll.

## A8 — Console / cache
- Hard refresh once after deployment (or open a Private window).
- Confirm the new UI appears; staging Service Worker cache is `avan-staging-rc1-v4`.
- Browser Console: no new red JavaScript errors caused by `rc11-money.js`.

## PASS criteria
PASS when A1–A8 succeed, no non-money numeric field is reformatted, and existing RC1 accounting/RLS behavior is unchanged.

Suggested report back:
`Gate RC1.1-A پاس شد`

If any step fails, report only the Gate item (A1…A8), device/browser, and what was observed.
