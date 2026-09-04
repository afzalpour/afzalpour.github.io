# ADR-0009 — Smart Documents Preserve Originals and Require Human Review

- Status: Accepted
- Date: 2026-09-05

## Context
OCR ممکن است خطا کند، به‌ویژه روی تصویر کم‌کیفیت، متن فارسی، اعداد و تاریخ. اصل فایل باید مستقل از نتیجه OCR محفوظ بماند.

## Decision
Pipeline استاندارد اسناد هوشمند:

`Upload → Private Storage → Correct Viewer → OCR → Structured Extraction → Confidence → Human Review → Accounting Draft → Approval → Ledger Link`

- اصل فایل همیشه محفوظ می‌ماند.
- Viewer قبل از ارزیابی OCR باید صحیح باشد.
- فیلدهای حساس مثل مبلغ و تاریخ Confidence مستقل داشته باشند.
- OCR مستقیم سند Posted ایجاد نمی‌کند.

## Consequences
- خطای OCR قابل اصلاح است.
- Audit از فایل اصلی تا ثبت حسابداری حفظ می‌شود.
- استخراج Line Item در آینده بدون شکستن pipeline اضافه می‌شود.

## Guardrails
- Signed URL/Private Storage برای اصل فایل.
- رندر صحیح orientation/aspect ratio/PDF قبل از OCR tuning.
- Review انسانی قبل از Accounting effect نهایی.
- Confidence پایین باید به‌وضوح Flag شود.
