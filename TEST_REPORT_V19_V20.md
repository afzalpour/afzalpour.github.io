# TEST REPORT — V19 / V20

## Runtime smoke test (isolated browser DOM)
- V19 and V20 inline JavaScript: syntax valid.
- Runtime JavaScript exceptions: 0 in tested flows.
- Demo account entered successfully.
- Mobile viewport: 390 × 844.
- Bottom navigation labels: خانه / گزارش‌ها / ثبت / تعهدات / بیشتر.
- Bottom-nav label font: 13.5px standard; 15.12px in Large text mode.
- Bottom-nav touch target min-height: 58px.
- OCR image selection: FileReader produced a data:image/png;base64 preview.
- OCR preview natural dimensions: 700 × 420 in test image.
- OCR card switched to has-image and showed «تصویر آماده OCR».
- Command Palette: search result click navigated to Reports successfully.
- V20 voice intent test: «ثبت هزینه ۵۰۰ هزار تومان تاکسی» -> expense draft, amount 500000, description تاکسی; no automatic posting.
- V20 workflow engine: 5 default rules available; demo data produced actionable suggestions.
- V20 personalized shortcuts: always fills up to 4 useful shortcuts.

## OCR engine note
The image-preview and file handoff path were tested locally. Tesseract worker/language execution itself depends on its external CDN in the current prototype and was not network-tested in the isolated runtime environment.
