# RC1.2-C.4 — Reference Receipt OCR Gate

Status: awaiting LIVE PASS.

## Why
The real Persian POS receipt supplied during the live gate remained safe but its amount/date were blank in C.3. C.4 uses this receipt pattern as a reference case while keeping the algorithm general for receipt/bank-slip images.

## Implementation
- Keeps the general receipt OCR base on v3.
- Replaces the C.3 structured-field pass with v5 targeted extraction.
- Multiple date ROIs around the receipt date/time row.
- Date OCR with both normal and binary preprocessing.
- Flexible date parser accepts separated Jalali/Gregorian dates and compact 8-digit dates.
- Detects the dark lower amount band.
- Runs amount OCR on inverted grayscale plus two binary thresholds.
- Runs amount passes both with and without a numeric whitelist.
- Selects amount by cross-pass consensus rather than one OCR result.
- Unit is not guessed blindly: standardized financial amount is emitted only when Rial/Toman evidence is present in OCR evidence.
- Raw gibberish is never used as the user-facing receipt description.
- Human review remains mandatory; no direct Posting.

## Reference live case
For the receipt used in this gate, the source visibly contains:
- Date: `1405/06/10` (time is also visible on the receipt).
- Amount: `1,000,000 Rial`.
- Canonical Toman amount expected after extraction: `100,000 Toman`.
- The receipt also visibly states a successful operation.

The app does not hard-code these values; they are only the acceptance reference for this real test image.

## Live test
1. Hard refresh Staging.
2. Upload the same reference image as `رسید` or `رسید بانکی`.
3. Run `استخراج هوشمند` and wait until completion.
4. Confirm the document stays visible and status becomes `استخراج شده`.
5. Open `بازبینی`.
6. Amount must no longer be blank. For this reference receipt it should resolve to 100,000 Toman when display unit is Toman (source is 1,000,000 Rial).
7. Date must no longer be blank and should correspond to 1405/06/10.
8. Description must remain a safe structured receipt description; no raw OCR gibberish.
9. No Posted journal may be created automatically.

## Pass phrase
`Gate RC1.2-C.4 پاس شد`
