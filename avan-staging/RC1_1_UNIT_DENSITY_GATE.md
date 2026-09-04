# Avan Core 1.0 — RC1.1-C Unit Density Gate

## Goal
Reduce repeated Rial/Toman labels without changing accounting semantics.

## Expected presentation
- Financial pages show the active unit once near the page title.
- Financial forms show the active unit once near the form content.
- Repeated numeric values in KPI cards, invoice totals, journal lines and reports do not append Rial/Toman to every number.
- Amount-in-words helpers do not repeat the unit after every field.
- Settings still provides the Rial/Toman selector.

## C1 — Invoice
1. Open a sale or purchase invoice.
2. Verify one unit badge is visible for the form.
3. Enter quantity, unit price and discount.
4. Unit price and discount remain grouped numerically.
5. Amount-in-words is shown without repeating Rial/Toman after each helper.
6. Line total and grand total show the number without a repeated unit suffix.
7. Calculation must remain unchanged.

## C2 — Manual journal
1. Open a Draft journal.
2. Verify one form-level unit badge.
3. Enter debit and credit values.
4. Debit, credit and totals must not repeat the unit after each amount.
5. Save/reopen/delete Draft successfully.

## C3 — Dashboard and reports
1. Open Dashboard and Reports.
2. Verify one compact unit indicator near the financial page title.
3. KPI values and table cells show numbers without repeating the unit suffix.
4. All displayed values remain numerically identical to the pre-patch values.

## C4 — Rial/Toman switch
1. In Settings switch Toman to Rial.
2. Return to Dashboard/Invoices/Reports.
3. Existing values must still convert exactly ×10 for Rial.
4. Compact unit badges must update to Rial.
5. Switch back to Toman; values must return exactly with no drift.

## C5 — Input guard
With Rial selected, try a non-divisible amount such as 101 Rial.
Expected: the existing RC1.1-B guard still blocks submission.

## C6 — Mobile
On iPhone/Safari or a narrow viewport:
- unit badges fit without overflow;
- amount-in-words wraps normally;
- no repeated unit suffix makes rows materially wider;
- no new console errors.

## PASS
`Gate RC1.1-C پاس شد`
