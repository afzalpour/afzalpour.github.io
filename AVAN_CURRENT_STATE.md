# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از Live PASS شدن **RC1.2-CF** و **RC1.2-D** و Merge شدن **RC1.2-D.1** و **RC1.2-E** برای Gate بعدی.

این فایل وضعیت جاری پروژه است و پس از هر Gate پاس‌شده یا تصمیم معماری مهم باید به‌روزرسانی شود.

## Startup rule for every new chat
1. `AVAN_MASTER_PROMPT.md` را بخوان.
2. این فایل را بخوان.
3. `docs/adr/README.md` و ADRهای Accepted مرتبط را بخوان.
4. Repository/PRها و آخرین Live Gate را تطبیق بده.
5. از آخرین نقطه واقعی ادامه بده؛ قابلیت پاس‌شده را بی‌دلیل بازطراحی نکن.

---

## 1) Repository / Release Workflow

Repository:
- `afzalpour/afzalpour.github.io`

ساختار:
- Root = Production/current public root.
- `avan-staging/` = Staging development + Gate environment.
- `docs/adr/` = Architecture Decision Records.

Workflow:
- Staging first.
- Branch → PR → Diff review → Merge → Live Gate.
- هیچ Gate تا تایید صریح کاربر PASS محسوب نمی‌شود.
- Production/root promotion فقط پس از Regression و RC freeze.

Source of Truth:
- `AVAN_MASTER_PROMPT.md`
- `AVAN_CURRENT_STATE.md`
- Accepted ADRs
- Repository
- نتیجه Live Gate کاربر

---

## 2) Gateهای پاس‌شده

- Gate B-4 Live — PASS
- Gate B-4.1 — PASS
- RC1 + two-user RLS — PASS
- RC1.1-A Money UX — PASS
- RC1.1-B Currency — PASS
- RC1.1-C Unit Density — PASS
- RC1.1-D User Administration — PASS
- Owner changing another user password — Live confirmed
- RC1.1-F UX Cleanup — PASS
- RC1.2-B Premium visual polish + Persian cleanup + account tree colors — PASS
- **RC1.2-CF OCR Freeze + reliable manual Smart Document flow — PASS**
- **RC1.2-D Unified Print & Export Center — PASS**

Pending Live Gate:
- **RC1.2-D.1 Persian print polish — MERGED, not yet PASS**
- **RC1.2-E Professional A4 + Company Print Identity — MERGED, not yet PASS**

---

## 3) Latest Important Merges

- RC1.2-B: `bafdfe4b49b8a4d9b44305997abf452a3490fd80`
- RC1.2-CF OCR Freeze: `4ef379adab06f6aef576cd6dd528974b7958083b`
- RC1.2-D Print/Export: `2e8e8fe59765f824910187d5634d5f0d94daf0b1`
- RC1.2-D.1 Print polish: `307a65f96293fc89b621ed68bf1078f0474d921b`
- RC1.2-E Company Print Identity: `106e1b1e0ada840b2a6ae5f397f9b388c4980496`

PWA staging cache after E: **v25**.

---

## 4) Core Financial Invariants

- PostgreSQL/Supabase = financial Source of Truth.
- Financial data is not stored in LocalStorage.
- Auth + Workspace-based RLS active.
- Journal lifecycle: `Draft → Posted → Reversed`.
- Posted journal and lines are immutable.
- Corrections use Reversal/controlled workflow.
- Canonical Ledger currency storage = integer Toman.
- Rial/Toman is presentation/input preference only.
- Browser never receives Service Role.
- orphan journal lines must remain zero.

Relevant ADRs:
- ADR-0001 Canonical Toman
- ADR-0002 Journal immutability
- ADR-0003 Workspace/RLS boundary

---

## 5) Users / Access / Workspace

Roles:
- owner = مالک
- manager = مدیر
- accountant = حسابدار
- viewer = legacy/read-only when applicable

- Direct sensitive membership mutation from browser is blocked.
- SECURITY DEFINER RPCs handle member administration.
- Last active Owner protected.
- Multi-workspace preserved.
- `avan.active_workspace_id` is session UI preference only.
- Default personal workspace may be suppressed from operational context for a shared non-owner user without deleting data.

---

## 6) Authentication

Working:
- Owner changes eligible other-user password via secure Edge Function.
- User changes own password after re-authentication.

Still unresolved before Production:
- Password recovery email delivery/SMTP.
- Final Auth redirect URLs.
- Custom domain configuration when domain exists.

---

## 7) UX / Visual System

Current visual direction:
- Professional dark finance sidebar.
- Warm ivory/premium canvas.
- Vazirmatn web font + system fallbacks.
- Premium but low-distraction cards.
- Semantic financial status colors.
- Professional tables/forms/modals/mobile nav.
- Deterministic account-tree branch colors with UI toggle.

RC1.2-B Persianized technical copy in Reports/Settings.

---

## 8) Smart Documents / OCR

### Current decision
Browser-local OCR is **Frozen** after repeated live failure on real Persian receipts despite multiple receipt-specific Tesseract pipelines.

ADR:
- ADR-0009 Preserve originals + Human Review
- **ADR-0013 Freeze browser OCR**

Current supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

Viewer:
- Images: correct aspect, browser orientation handling, zoom, rotate.
- PDF: internal PDF.js canvas renderer, page navigation, zoom, rotate.
- Original remains private and uses temporary signed URL.
- Original file can be viewed/downloaded/printed.

OCR must not be revived with further ad-hoc Tesseract tuning. Revisit only with a stronger OCR/document-AI engine and representative benchmark set.

---

## 9) Print / Export

### RC1.2-D — LIVE PASS
Shared Print/Export Engine:
- Reports: Print / Save PDF + CSV.
- Invoice: detail Print/PDF + list print.
- Journal: detail Print/PDF + list print.
- Smart documents: download/print original.
- RTL A4 print layout.

ADR:
- ADR-0008 Unified Print/Export System.

### RC1.2-D.1 — MERGED, AWAITING LIVE GATE
User feedback after D:
- Printed invoice/journal digits were Latin.
- Detail tables needed centered columns.
- Repeated detail title under the Avan print brand was unnecessary.

Implemented D.1:
- Print-window text is localized to Persian digits without mutating source values.
- Invoice/journal detail table cells and headers are centered.
- Repeated `فاکتور ...` / `سند ...` title is removed from underneath print identity; document body title remains.
- Cache v24 (subsequently v25 in E).

Gate file:
- `avan-staging/RC1_2_D1_GATE.md`

---

## 10) RC1.2-E — Professional A4 + Company Print Identity

Status: **MERGED TO STAGING, AWAITING SQL PATCH + LIVE GATE**

Files:
- `avan-staging/RC1_2_E_COMPANY_PROFILE_PATCH.sql`
- `avan-staging/RC1_2_E_GATE.md`
- `avan-staging/rc12-company-profile.js`
- `avan-staging/rc12-company-profile.css`
- shared print engine updated

Architecture:
- `workspace_print_profiles` is a dedicated Cloud table.
- Profile is Workspace-scoped.
- Browser does not persist company identity in LocalStorage.
- Read/write is via SECURITY DEFINER RPCs.
- Owner/Manager edit; other members read for output.

Profile fields:
- display name
- legal name
- registration number
- national ID
- economic code
- tax ID
- phone
- email
- postal code
- address
- private logo path

Logo:
- private Supabase Storage bucket: `avan-branding`
- JPG/PNG/WEBP, max 2MB
- workspace-scoped path
- signed URL for display/print
- Owner/Manager mutation policy

Print identity:
- shared A4 Header applies to reports/invoices/journals.
- company logo or Avan fallback mark.
- company official details.
- Persian digits retained.
- detail table centering retained.
- no duplicate invoice/journal title beneath identity header.

### Manual prerequisite for E
Assistant currently has no direct Supabase execution connector in this session.
User must run once in Supabase SQL Editor:

`avan-staging/RC1_2_E_COMPANY_PROFILE_PATCH.sql`

Then Hard Refresh and run Gate E.

---

## 11) Immediate Next Gate

1. Run `RC1_2_E_COMPANY_PROFILE_PATCH.sql` once in Supabase.
2. Hard Refresh Staging.
3. Test `RC1_2_D1_GATE.md`.
4. Test `RC1_2_E_GATE.md`.

Expected pass phrases:
- `Gate RC1.2-D.1 پاس شد`
- `Gate RC1.2-E پاس شد`

Do not mark either as PASS before user confirms.

---

## 12) Next Development After E PASS

### RC1.2-F — Mobile / iPhone Final UX Regression
- Safari/iPhone typography.
- forms/modals.
- bottom navigation / safe area.
- wide financial tables.
- Smart Document Viewer.
- print/share/download flows.
- Company Profile settings on mobile.

After F:
- RC1.3-A Auth recovery / SMTP / redirects.
- RC1.3-B remaining company/tax operational settings if needed.
- RC1.3-C backup/restore strategy, Audit Log UX, operational controls.
- RC1.3-D full regression.
- RC1.3-RC feature freeze.
- Production promotion.

---

## 13) Official Future Product Roadmap

The following remain official product scope, not abandoned ideas:

### Intelligence
- CFO Autopilot
- explainable KPI / Why this number
- Cash Forecast
- What-if scenarios
- Budget vs Actual
- proactive management alerts
- Continuous Audit
- Collection Agent
- Close Autopilot

### AI Accounting
- stronger future Document AI/OCR
- document classification
- party/account suggestion
- recurring-pattern learning
- draft generation
- human-controlled posting

### Voice AI
- Persian speech-to-text
- voice financial queries
- voice commands generating drafts
- voice response
- optional voice cloning only with explicit consent; never financial authentication

### Inventory
- Stock Ledger / movement-based architecture
- multi-warehouse
- receipts/issues/transfers/returns/adjustments
- costing
- reorder alerts
- accounting integration

### Sales / Purchase
- quote/proforma
- orders
- purchase/sales invoices
- returns/discount/settlement
- AR/AP + inventory + tax + Ledger integration

### Tax
- VAT/tax profiles
- product/party tax mapping
- electronic invoicing / Iranian taxpayer-system integration based on current law at implementation time
- pre-validation, status, retry, audit
- versioned/configurable tax rules

### Treasury / Bank AI
- cash/bank/cheques/maturities
- bank reconciliation
- transaction import/API where feasible
- automatic matching
- unmatched queue + confidence

### Additional modules
- Payroll
- Fixed Assets
- Budgeting/Forecast
- Approval Workflow
- Multi-company/Branch + future consolidation
- Integrations with bank/POS/e-commerce/API/Excel

---

## 14) Governing Product Principle

آوان نباید به یک نرم‌افزار حسابداری معمولی تبدیل شود.

معیار ثابت:

**اعتماد مالی + UX حرفه‌ای + اتوماسیون + هوش توضیح‌پذیر + تصمیم‌سازی مدیریتی.**
