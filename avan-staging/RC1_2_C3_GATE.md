# RC1.2-C.3 — Structured Receipt Fields Gate

## Purpose
Prevent noisy raw OCR from becoming the user-facing receipt description, and independently extract financially important receipt fields.

## Scope
- Receipt / bank-slip images only.
- Existing v3 OCR remains as base/fallback.
- Adds a second structured pass for amount/date/reference.
- Detects the lower dark amount band and OCRs it with a numeric whitelist.
- Standardizes detected amount as `مبلغ <digits> ریال` so the existing canonical-Toman extraction layer performs the conversion.
- Receipt description is synthesized from trusted structured fields instead of raw OCR text.
- No direct Posting. Human review remains mandatory.

## Live reference sample
For the receipt used in live feedback:
- Source amount visually reads `۱٬۰۰۰٬۰۰۰ ریال`.
- In canonical Toman extraction this should become approximately `۱۰۰٬۰۰۰ تومان`.
- Description must never contain the previous gibberish OCR output.
- Acceptable description examples:
  - `رسید کارتخوان — عملیات موفق — پیگیری/مرجع ...`
  - `رسید کارتخوان — نیازمند بازبینی`
- Missing uncertain fields is preferable to inventing a wrong value.

## Gate steps
1. Hard refresh Staging.
2. Upload the same receipt as `رسید` or `رسید بانکی`.
3. Run `استخراج هوشمند` and wait for completion.
4. Confirm the document stays visible and status becomes `استخراج شده`.
5. Open `بازبینی`.
6. Verify Description is structured Persian and contains no OCR gibberish.
7. Verify amount is close to `۱۰۰٬۰۰۰ تومان` when Toman is active (or `۱٬۰۰۰٬۰۰۰ ریال` when Rial display is active).
8. Verify detected date/reference only if they look correct against the source image.
9. Confirm no Posted journal is created automatically.

Pass phrase after live verification:
`Gate RC1.2-C.3 پاس شد`
