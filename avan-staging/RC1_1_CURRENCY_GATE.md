# Avan Core 1.0 — RC1.1 Currency Gate B

## Safety model
- Canonical Ledger storage stays **Toman**.
- Existing journal, invoice and transaction amounts are never rewritten.
- `money_display_unit` is only a Workspace preference.
- Rial input is converted to canonical Toman at the form-submit boundary.
- Canonical report/Ledger output is converted back to Rial for display.
- Rial values must be divisible by 10 because Core 1.0 stores integer Toman.

## B0 — Database patch
Before testing the UI, run `RC1_1_CURRENCY_PATCH.sql` once in the same Supabase project used by Staging.

Expected:
- SQL finishes without error.
- `workspace_settings.money_display_unit` exists and defaults to `toman`.
- RPCs `get_money_display_unit` and `set_money_display_unit` exist.

Then hard-refresh Staging or open a Private/Incognito window.

## B1 — Settings
1. Login with the primary/owner user.
2. Open Settings.
3. Expected: a **واحد پول** card appears.
4. Expected default active unit: **تومان**.
5. Choose **ریال**.
6. Expected success toast and the Rial button becomes active.
7. Reload/logout-login and reopen Settings.
8. Expected: **ریال** remains active (Cloud persistence).

## B2 — Existing data display
With unit = Rial:
1. Open Dashboard, Reports and one existing Posted journal/invoice.
2. Pick a known amount that was previously shown as `1,234 Toman` (or any known value).
3. Expected: it is shown as `12,340 Rial`.
4. No database row should be edited merely by viewing the page.

Switch back to Toman.
Expected: the same amount returns to its original Toman value exactly.

## B3 — Receipt boundary
With unit = Rial:
1. Open Receipt.
2. Enter `12,345,670` Rial.
3. Expected words end in `ریال`.
4. Submit a disposable test operation.
5. Open the resulting journal/report.
6. Expected display in Rial: `12,345,670 Rial`.
7. Switch Settings to Toman.
8. Expected the exact same Ledger amount displays as `1,234,567 Toman`.

This proves input ÷10 and output ×10 without mutating Ledger semantics.

## B4 — Non-divisible Rial guard
With unit = Rial:
1. Open Receipt or a Draft journal.
2. Enter `101` Rial in a money field.
3. Attempt to submit.
4. Expected: submission is blocked with a message that Rial must be a multiple of 10.
5. No transaction/journal should be created from that attempt.

## B5 — Draft journal edit
1. With unit = Toman, create a Draft with 1,000,000 debit and credit.
2. Save and reopen it.
3. Switch Settings to Rial, then reopen the Draft.
4. Expected each 1,000,000 Toman line appears as 10,000,000 Rial.
5. Edit/save the Draft in Rial with values divisible by 10.
6. Switch back to Toman and reopen.
7. Expected exact canonical Toman values; no ×10/÷10 drift.
8. Delete the temporary Draft.

## B6 — Invoice calculation
With unit = Rial:
1. Open a new invoice Draft.
2. Quantity = `2` (must remain a non-money field).
3. Unit price = `12,500,000` Rial.
4. Discount = `500,000` Rial.
5. Expected live line/total calculations are in Rial and are not multiplied twice.
6. Save as Draft.
7. Switch to Toman and reopen.
8. Expected unit price = `1,250,000` Toman and discount = `50,000` Toman.
9. Remove the temporary Draft if not needed.

## B7 — RLS / permissions
- Owner or manager may change the money display unit.
- Accountant/viewer must not be able to persist a unit change through the RPC.
- Existing two-user Workspace isolation must remain unchanged.

## B8 — Mobile / PWA
On iPhone Safari or real mobile:
- Currency selector fits without horizontal overflow.
- Rial money input still groups digits during typing.
- Amount-in-words says Rial when Rial is selected.
- Reload preserves the selected unit.
- Staging cache is `avan-staging-rc1-v5`.

## PASS criteria
PASS when B0–B8 succeed, existing Ledger values remain semantically unchanged, and switching Toman ⇄ Rial produces no drift.

Suggested report back:
`Gate RC1.1-B پاس شد`

If something fails, report the Gate item (B0…B8), browser/device, and observed value/message.
