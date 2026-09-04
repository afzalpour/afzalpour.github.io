# Gate RC1.2-C.4.2 — RTL Structured Receipt Handoff

## Scope
Fix the live receipt case where reference number was recovered but Amount and Date remained blank.

## What changed
- New OCR v6 post-processing layer over v5.
- Recovers Jalali/Gregorian dates when Tesseract returns RTL order such as `10/06/1405`.
- Recovers grouped amounts when OCR returns reversed RTL groups such as `000,000,1`.
- Adds fuzzy-but-bounded Rial/Toman label recovery (edit distance <= 1 only).
- Structured `receipt_fields` are now the first source for Amount/Date handoff into extracted data; raw OCR text is fallback only.
- Canonical Ledger storage remains integer Toman.
- Rial source amount is converted to Toman only when the source unit was detected.
- Human review remains mandatory; no Posting is introduced.

## Reference live receipt
Expected source values from the provided receipt image:
- Source date: `1405/06/10`
- Source amount: `1,000,000 Rial`
- Expected canonical/display Toman amount: `100,000 Toman`
- Reference/trace observed in previous live run: `145575619`

## Live test
1. Hard refresh staging.
2. Upload the same image as `رسید` or `رسید بانکی`.
3. Run `استخراج هوشمند`.
4. Confirm the document remains available and Review opens/works.
5. In Review verify:
   - Amount is `100,000` Toman when Toman display is active.
   - Date corresponds to Jalali `1405/06/10`.
   - Description remains structured, not raw gibberish.
   - Reference/trace remains available if detected.
6. Do not approve the Gate if Amount or Date is still blank or materially wrong.

Pass phrase: `Gate RC1.2-C.4.2 پاس شد`
