# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: پس از Merge شدن **RC1.2-CF (OCR Freeze)** و **RC1.2-D (Print & Export)**. آخرین Live Gate پاس‌شده توسط کاربر همچنان **RC1.2-B** است؛ CF و D هنوز نیازمند Live Gate هستند.

این فایل وضعیت جاری پروژه است و باید بعد از هر Gate پاس‌شده یا تغییر معماری مهم به‌روزرسانی شود.

## Startup rule for every new chat
قبل از هر تغییر فنی:
1. `AVAN_MASTER_PROMPT.md` را بخوان.
2. همین فایل (`AVAN_CURRENT_STATE.md`) را بخوان.
3. `docs/adr/README.md` و ADRهای Accepted مرتبط با تغییر را بخوان.
4. سپس Repository/PR/Live Gate را با این اسناد تطبیق بده.

ADRهای Accepted تصمیم‌های معماری فعال‌اند و بدون ADR جایگزین (`Supersedes`) نباید نقض شوند.

---

## 1) Repository / Workflow

Repository فعال:
- `afzalpour/afzalpour.github.io`

ساختار:
- Root = Production فعلی/مسیر انتشار اصلی.
- `avan-staging/` = محیط Staging برای توسعه و Gate.
- `docs/adr/` = Architecture Decision Record registry.

Workflow:
- تغییرات ابتدا در Staging.
- Branch → PR → Diff/Review → Merge به `main`.
- Production/root فقط پس از Gateها و Regression نهایی promote می‌شود.

Project Source of Truth:
- `AVAN_MASTER_PROMPT.md`
- `AVAN_CURRENT_STATE.md`
- `docs/adr/README.md` + ADRهای Accepted
- Repository + نتیجه Live Gate کاربر

Latest important merges:
- RC1.2-B Premium UI: `bafdfe4b49b8a4d9b44305997abf452a3490fd80` — LIVE PASS.
- RC1.2-CF OCR Freeze: PR #17, merge `4ef379adab06f6aef576cd6dd528974b7958083b` — awaiting Live Gate.
- RC1.2-D Print & Export: PR #18, merge `2e8e8fe59765f824910187d5634d5f0d94daf0b1` — awaiting Live Gate.

---

## 2) Gateهای پاس‌شده

- Gate B-4 Live — PASS
- Gate B-4.1 — PASS
- RC1 + two-user RLS — PASS
- RC1.1-A Money UX — PASS
- RC1.1-B Currency — PASS
- RC1.1-C Unit Density — PASS
- RC1.1-D User Administration — PASS
- Gate E: Owner changing another user password — live confirmed; سایر refinementها به F منتقل شدند.
- RC1.1-F UX Cleanup — PASS
- RC1.2-A Professional Visual System — direction accepted and refined by B
- **RC1.2-B Premium polish + Persian cleanup + account tree colors — LIVE PASS**

Pending Live Gates:
- **RC1.2-CF — Smart Documents Viewer + OCR Freeze**
- **RC1.2-D — Print & Export Center**

هیچ Gate pending را پاس‌شده فرض نکن تا کاربر صریحاً تایید کند.

---

## 3) وضعیت Core مالی

نام محصول:
- آوان
- Core 1.0

معماری تاییدشده:
- PostgreSQL/Supabase منبع حقیقت مالی.
- LocalStorage برای داده مالی استفاده نمی‌شود.
- Auth + RLS فعال.
- Workspace-based isolation.
- Journal lifecycle: Draft → Posted → Reversed.
- Posted journal immutable.
- Reversal با سند معکوس.

Health snapshot تاریخی تاییدشده:
- Accounts: 18
- Cash/Bank: 2
- orphan journal lines: 0
- closed period: 0 در snapshot قبلی
- visible workspace: 1 برای سناریوی اصلی پس از workspace suppression

اعداد Health snapshot هستند؛ برای تصمیم‌های جدید live health را دوباره بخوان.

ADRهای مستقیم مرتبط:
- ADR-0001 Canonical Ledger Toman
- ADR-0002 Journal lifecycle/immutability
- ADR-0003 Workspace/RLS security boundary

---

## 4) Money / Currency

- Canonical Ledger = integer Toman.
- Rial display = Toman × 10.
- Rial submit = /10 با divisibility guard.
- بدون Rewrite/Reinterpret داده تاریخی.
- Thousands separator + Persian/Arabic/Latin digit normalization.
- Amount-in-words فعال.
- واحد نمایش per-user/per-workspace و Cloud-backed در `workspace_user_preferences`.
- RPCهای preference:
  - `get_my_money_display_unit(wid)`
  - `set_my_money_display_unit(wid,p_unit)`

---

## 5) Users / Access / Workspace

UI roles:
- owner = مالک
- manager = مدیر
- accountant = حسابدار
- viewer = legacy/display only

Security:
- browser mutation مستقیم workspace_members ممنوع.
- RPC امن برای مدیریت اعضا.
- last active Owner protected.
- primary owner protected where applicable.
- invitation + `claim_workspace_invitations()` flow موجود.

Multi-workspace:
- session key: `avan.active_workspace_id`
- فقط UI/session preference؛ نه داده مالی.
- Workspace شخصی پیش‌فرض برای کاربری که shared non-owner workspace دارد از context عملیاتی suppress می‌شود؛ داده حذف نمی‌شود.
- Multi-company واقعی باید حفظ شود.

ADR مرتبط:
- ADR-0011 Multi-workspace → Multi-company

---

## 6) Password / Auth

Owner → other user password:
- Edge Function: `owner-set-user-password`
- live confirmed working.
- service role server-side only.

Self password:
- Settings → تغییر رمز من
- re-auth با current password + user-scoped update password.
- Gate F passed.

Unresolved production item:
- Password recovery email historically دریافت نمی‌شد.
- custom domain فعلاً وجود ندارد.
- SMTP / Auth redirect / email template قبل از Production نهایی باید کامل شوند.

---

## 7) UX / Visual System

RC1.2-A:
- Vazirmatn variable font + iOS/macOS/Windows fallback.
- dark finance sidebar.
- modern cards/tables/forms/modals/mobile bottom nav.

RC1.2-B LIVE PASS:
- warm ivory/premium canvas.
- richer KPI and section cards.
- limited gold accent.
- semantic finance colors preserved.
- Report/Settings copy cleanup.
- account tree deterministic branch colors + on/off toggle.

UI copy fixed:
- extra technical text under «از آوان بپرس» removed.
- `محل ذخیره` removed.
- `سلامت Core` → `سلامت سیستم`.
- Posted/Reversed/Workspace/closed-period labels Persianized in final UI layer.

---

## 8) Smart Documents / Viewer / OCR

### Stable parts
- private storage bucket: `avan-documents`.
- JPG/PNG/WEBP/PDF up to 10MB.
- temporary Signed URL for original source.
- internal Image/PDF Viewer from RC1.2-C:
  - image display
  - browser orientation handling
  - zoom / rotate / fit
  - PDF.js canvas rendering
  - multi-page PDF navigation
- Manual Review → Accounting Draft → Human-controlled Ledger Link remains active.
- Original source file is preserved.

### OCR history
Several staging iterations were merged and live-feedback-driven:
- RC1.2-C base viewer/OCR
- C.1 return-to-documents fix
- C.2 receipt-aware OCR
- C.3 structured receipt fields
- C.4 amount/date recovery
- C.4.1 review handoff
- C.4.2 RTL structured handoff
- C.4.3 focused receipt OCR / safe delete infrastructure

Despite Tesseract.js tuning, real Persian receipt Amount/Date extraction remained insufficiently reliable for a financial product.

### Current decision — OCR FREEZE
ADR-0013 is Accepted:
- Browser-local OCR is **frozen** and removed from the normal user workflow.
- Existing extracted historical data is preserved.
- Existing OCR runtime files v2-v8 are retained for rollback/research, not primary use.
- Normal flow is now: Upload → View Original → Manual Review → Accounting Draft → Human Approval/Link.
- Future OCR reactivation requires a new ADR + representative Persian document benchmark + field-level confidence.
- Preferred future direction: evaluate reliable server/provider document intelligence rather than adding more receipt-specific browser heuristics.

RC1.2-CF code merged:
- PR #17
- Merge: `4ef379adab06f6aef576cd6dd528974b7958083b`
- PWA cache v22
- Gate file: `avan-staging/RC1_2_CF_GATE.md`

**Status: awaiting Live Gate.**
Pass phrase: `Gate RC1.2-CF پاس شد`

Relevant ADRs:
- ADR-0009 Smart Documents Preserve Originals + Human Review
- ADR-0013 Freeze Browser-local OCR

---

## 9) Print / Export Center

RC1.2-D is implemented and merged to Staging.

Capabilities:
- Shared print/export engine; no separate incompatible implementation per module.
- Reports:
  - Print / Save as PDF through RTL A4 print window.
  - CSV export with UTF-8 BOM for Excel/Numbers.
  - table-based reports → rows/columns.
  - KPI-only reports → metric/value CSV.
- Invoice detail:
  - `چاپ / ذخیره PDF` in read-only detail modal.
- Journal detail:
  - `چاپ / ذخیره PDF` in read-only detail modal.
- Invoice/Journal list pages:
  - print current list / PDF.
- Smart Document Viewer:
  - download original file.
  - print original image.
  - PDF original opens in signed original tab for browser Print/Save PDF.
- Print output:
  - A4
  - RTL
  - Vazirmatn + fallback
  - stable tables
  - repeated table header
  - page-break controls
  - UI buttons/actions removed from print output.

Implementation files:
- `avan-staging/rc12-print-export.js`
- `avan-staging/rc12-print-export.css`
- `avan-staging/RC1_2_D_GATE.md`

Merge:
- PR #18
- `2e8e8fe59765f824910187d5634d5f0d94daf0b1`
- PWA cache v23

**Status: awaiting Live Gate.**
Pass phrase: `Gate RC1.2-D پاس شد`

ADR:
- ADR-0008 Unified Print and Export System

---

## 10) Professional Document Templates — NEXT AFTER D PASS

### RC1.2-E
هدف:
- professional A4 templates on top of the shared D engine.
- Company name/logo/contact/tax identity.
- seller/buyer information where appropriate.
- official invoice/journal header/footer.
- page number / document metadata.
- company identity centralized, not duplicated.

This stage connects to Company Settings / Company Profile.

Do not mark E started/passed until D Live Gate is confirmed unless the user explicitly asks to bypass Gate discipline.

---

## 11) Mobile / iPhone

After D/E:
### RC1.2-F — Mobile/iPhone final UX regression
- Safari/iPhone typography.
- forms/modal/bottom nav.
- wide tables.
- document viewer.
- print/share/download flows.
- safe-area.

---

## 12) Product Vision — official future roadmap

User explicitly requires Avan to become one of the best and smartest products in its category; the following remain official roadmap, not optional ideas.

### Finance Intelligence
- CFO Autopilot
- Explainable KPI / Why this number
- Cash Forecast
- What-if scenarios
- Budget vs Actual
- Proactive management alerts

### Continuous Audit
- duplicate detection
- unusual amount
- integrity checks
- anomaly/pattern detection
- period/control risks
- explainable evidence

### Collection Agent
- Aging
- collection priority
- delay probability
- suggested action/message
- cash impact

### Close Autopilot
- month-end checklist
- readiness score
- unresolved items
- discrepancy detection
- draft adjustments with human approval

### AI Accounting
- future reliable document OCR / structured extraction
- document classification
- party recognition
- account suggestion
- learned recurring patterns
- accounting draft
- human-controlled posting

### Voice AI
- Persian speech-to-text
- voice commands for Draft transactions/invoices/reports
- management voice questions
- voice response
- optional user-voice cloning only with explicit opt-in/consent; never financial authentication

### Inventory
- Stock Ledger / movement-based architecture
- products/services
- warehouses
- receipts/issues/transfers/adjustments/returns
- historical/realtime stock
- reorder alerts
- costing
- accounting integration

### Sales / Purchase
- quote/proforma
- order
- purchase/sales invoices
- returns/discount/settlement
- AR/AP + inventory + tax + Ledger integration

### Tax
- VAT/tax profiles
- product/party mapping
- electronic invoice / Iranian taxpayer-system requirements using current law at implementation time
- pre-validation/status/audit/retry
- rules versioned/configurable

### Treasury / Bank AI
- cash/bank/cheques/maturities
- bank reconciliation
- transaction import/API where feasible
- auto matching
- internal transfer detection
- unmatched queue + confidence

### Payroll
- employee/payroll/benefit/deduction/insurance/tax/accounting posting

### Fixed Assets
- asset register/depreciation/disposal/accounting

### Workflow
- approval chains
- role/amount/type limits

### Multi-company / Branch
- true isolation
- consolidated reporting later

### Integrations
- banks, POS, e-commerce, Excel/CSV, external APIs

---

## 13) Production Roadmap

After RC1.2-D/E/F:
- RC1.3-A: Auth recovery / SMTP / redirect production readiness.
- RC1.3-B: Company profile / logo / tax identity.
- RC1.3-C: operational controls, backup/restore strategy, audit log UX, session/recovery.
- RC1.3-D: full regression.
- RC1.3-RC: feature freeze, blocker/critical fixes only.
- Production promotion.
- custom domain + final auth/email/branding configuration after domain acquisition.

After Core is production-ready, continue staged Intelligence/Inventory/Tax/Treasury/Voice modules.

---

## 14) Architecture Decision Registry

Index:
- `docs/adr/README.md`

Template:
- `docs/adr/ADR_TEMPLATE.md`

Accepted ADRs:
- ADR-0001 Canonical Ledger = integer Toman
- ADR-0002 Journal Lifecycle and Posted Immutability
- ADR-0003 Workspace + RLS Security Boundary
- ADR-0004 Staging-first Gate-based Release
- ADR-0005 Explainable Human-controlled AI
- ADR-0006 Inventory Stock Ledger
- ADR-0007 Versioned Tax Rules
- ADR-0008 Unified Print/Export
- ADR-0009 Smart Documents Preserve Originals + Human Review
- ADR-0010 Voice AI Consent and Safety
- ADR-0011 Multi-workspace → Multi-company
- ADR-0012 Project Source of Truth
- ADR-0013 Freeze Browser-local OCR

Rule: Accepted ADRs are not silently violated. Fundamental changes require a new ADR and explicit supersession where applicable.

---

## 15) Immediate Next Action

Current code is already merged for CF and D.

### User Live Gate now
1. Hard Refresh Staging.
2. Run `avan-staging/RC1_2_CF_GATE.md`.
3. Run `avan-staging/RC1_2_D_GATE.md`.

Do not call either gate PASS until the user explicitly confirms it.

If both pass, the next implementation is:

**RC1.2-E — Professional A4 Templates + Company Identity foundation.**
