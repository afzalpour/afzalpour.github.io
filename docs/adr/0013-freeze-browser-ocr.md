# ADR-0013 — Freeze Browser-local OCR Until a More Reliable Engine Is Chosen

- Status: Accepted
- Date: 2026-09-05

## Context
RC1.2-C through C.4.3 repeatedly improved browser-local OCR for Persian receipts using Tesseract.js, targeted crops, RTL recovery and structured field handoff. Live feedback still showed unreliable Amount/Date extraction on real receipts. Continuing receipt-specific heuristics would increase complexity without reaching the reliability expected from a financial product.

The document viewer, private original-file storage, manual review, accounting-draft and Ledger-link pipeline remain valuable and independent from OCR quality.

## Decision
- Freeze browser-local OCR as a non-primary/legacy implementation.
- Remove the automatic OCR action from the normal Smart Documents workflow.
- Keep already extracted historical data intact.
- Keep source-file viewing, manual review, accounting draft creation and controlled Ledger linking active.
- Do not delete the existing OCR runtimes yet; retain them for rollback/research until a replacement is selected.
- A future OCR reactivation requires a separate ADR and a measurable reliability gate on representative Persian documents.

## Replacement direction
When OCR work resumes, evaluate a provider/server-side document intelligence pipeline capable of structured Persian document extraction, confidence per field, reproducible test fixtures and clear privacy controls. Do not resume by adding more receipt-specific browser heuristics without benchmark evidence.

## Consequences
- Users no longer receive low-confidence automatic Amount/Date values from the primary flow.
- Smart Documents remains useful as a private document archive + manual review + accounting attachment workflow.
- Development can move to Print/Export without blocking on OCR tuning.

## Guardrails
- Original private file remains the source artifact.
- Human review remains mandatory before accounting effect.
- No OCR result may directly create a Posted journal.
- Existing extracted documents must remain readable/reviewable.
- Future OCR must expose field-level confidence and be benchmarked before production activation.

## Related
- ADR-0009 Smart Documents Preserve Originals and Require Human Review.
- RC1.2-C / C.1 / C.2 / C.3 / C.4 / C.4.1 / C.4.2 / C.4.3.
- RC1.2-CF freezes OCR and preserves the Viewer/manual workflow.
