# RC1.2-C.4.1 — Post-OCR lifecycle hotfix

## Scope
This hotfix fixes the live regression where a successfully extracted smart document appeared to disappear after OCR because the full-page reload returned before the Documents page was restored.

## Expected behavior
1. Upload an image/PDF under Smart Documents.
2. Click «استخراج هوشمند».
3. Wait for «استخراج انجام شد؛ نتیجه برای بازبینی انسانی آماده است.»
4. The page may refresh once.
5. Avan must return to «اسناد هوشمند» even if Auth/bootstrap is slow.
6. The same document must still exist in the list with status «استخراج شده».
7. The «بازبینی» modal for that same document should open automatically.
8. If automatic review cannot open, the document must remain visible with an actionable «بازبینی» button.
9. No document delete operation is allowed in this path.
10. Original private source file must remain viewable.

## Regression
- Uploaded documents remain visible.
- Extracted documents remain visible.
- Reviewed/linked documents remain visible.
- Viewer still opens the source file.
- OCR never Posts directly to Ledger.

## Pass phrase
`Gate RC1.2-C.4.1 پاس شد`
