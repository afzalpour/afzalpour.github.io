# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از Live PASS شدن **RC1.2-E** و آماده‌سازی **RC1.2-F Mobile/iPhone Final UX Regression** برای Gate بعدی.

این فایل وضعیت جاری پروژه است و پس از هر Gate پاس‌شده یا تصمیم معماری مهم باید به‌روزرسانی شود.

## Startup rule for every new chat
1. `AVAN_MASTER_PROMPT.md` را بخوان.
2. این فایل را بخوان.
3. `docs/adr/README.md` و ADRهای Accepted مرتبط را بخوان.
4. Repository/PRها و آخرین Live Gate را تطبیق بده.
5. از آخرین نقطه واقعی ادامه بده؛ قابلیت پاس‌شده را بی‌دلیل بازطراحی نکن.

---

## 1) Repository / Release Workflow

Repository: `afzalpour/afzalpour.github.io`

- Root = Production/current public root.
- `avan-staging/` = Staging development + Gate environment.
- `docs/adr/` = Architecture Decision Records.
- Workflow: Branch → PR → Diff review → Merge → Live Gate.
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
- RC1.2-CF OCR Freeze + reliable manual Smart Document flow — PASS
- RC1.2-D Unified Print & Export Center — PASS
- **RC1.2-E Professional A4 + Company Print Identity — PASS**

Still not explicitly marked PASS by user:
- RC1.2-D.1 Persian print polish — merged and retained; do not retroactively mark PASS without explicit confirmation.

Current Gate:
- **RC1.2-F Mobile / iPhone Final UX Regression — implementation ready for Staging Live Gate.**

---

## 3) Latest Important Merges / Fixes

- RC1.2-B: `bafdfe4b49b8a4d9b44305997abf452a3490fd80`
- RC1.2-CF OCR Freeze: `4ef379adab06f6aef576cd6dd528974b7958083b`
- RC1.2-D Print/Export: `2e8e8fe59765f824910187d5634d5f0d94daf0b1`
- RC1.2-D.1 Print polish: `307a65f96293fc89b621ed68bf1078f0474d921b`
- RC1.2-E Company Print Identity: `106e1b1e0ada840b2a6ae5f397f9b388c4980496`
- RC1.2-E.1 Schema-cache recovery UI: PR #21; superseded by E.2 stability fix.
- RC1.2-E.2 Company Profile UI stability: merge `99f291805f6bdb75ff7184787c687451b761d90d`.

Supabase E migration:
- `workspace_print_profiles` created.
- `get_workspace_print_profile(uuid)` created.
- `set_workspace_print_profile(uuid,jsonb)` created.
- private `avan-branding` bucket created.
- PostgREST schema reloaded.
- existence verified directly in Supabase.
- RPC EXECUTE verified: `anon=false`, `authenticated=true`.

PWA staging cache before F: v27.
RC1.2-F bumps staging cache to **v28**.

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

- Sensitive membership mutation from browser is blocked.
- Secure RPC/Edge paths enforce administration.
- Last active Owner protected.
- Multi-workspace preserved.
- `avan.active_workspace_id` is session UI preference only.
- Default personal workspace may be suppressed from shared operational context without deleting data.

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

Current direction:
- Professional dark finance sidebar.
- Warm ivory/premium canvas.
- Vazirmatn web font + system fallbacks.
- Premium but low-distraction cards.
- Semantic financial status colors.
- Professional tables/forms/modals/mobile nav.
- Deterministic account-tree branch colors with UI toggle.

RC1.2-F mobile layer is presentation-only and exists to prevent later CSS layers from overriding iPhone Safe Area/mobile hardening.

---

## 8) Smart Documents / OCR

Browser-local OCR is **Frozen** after repeated live failure on real Persian receipts.

Relevant ADRs:
- ADR-0009 Preserve originals + Human Review
- ADR-0013 Freeze browser OCR

Supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

Viewer:
- Images: aspect-ratio safe, orientation handling, zoom, rotate.
- PDF: internal PDF.js renderer, page navigation, zoom, rotate.
- Originals stay private via temporary signed URLs.
- Original file can be viewed/downloaded/printed.

Do not restart ad-hoc Tesseract tuning. Revisit only with a stronger Document AI/OCR engine and representative benchmark set.

---

## 9) Print / Export

RC1.2-D — LIVE PASS:
- Reports: Print / Save PDF + CSV.
- Invoice: detail Print/PDF + list print.
- Journal: detail Print/PDF + list print.
- Smart documents: download/print original.
- RTL A4 shared print engine.

RC1.2-D.1 retained behavior:
- print digits localized to Persian without mutating source values.
- invoice/journal detail table cells and headers centered.
- duplicate invoice/journal title beneath print identity removed.

ADR: ADR-0008 Unified Print/Export System.

---

## 10) RC1.2-E — Company Print Identity — LIVE PASS

Cloud-backed Workspace profile:
- display/legal name
- registration number
- national ID
- economic code
- tax ID
- phone/email/postal code/address
- private logo path

Architecture:
- table: `public.workspace_print_profiles`
- read RPC: `get_workspace_print_profile`
- write RPC: `set_workspace_print_profile`
- Owner/Manager edit; authenticated workspace members can consume output subject to function checks.
- browser does not store company identity in LocalStorage.

Logo:
- private bucket `avan-branding`
- JPG/PNG/WEBP, max 2MB
- workspace-scoped path
- signed URL for display/print

E had a frontend MutationObserver regression during recovery work; fixed by RC1.2-E.2 using idempotent rendering and removing the second recovery observer. User confirmed page stability and later confirmed Gate E PASS.

---

## 11) RC1.2-F — Current Development / Live Gate

Goal: final Mobile/iPhone UX regression before Production-readiness work.

Implementation:
- new final presentation layer: `avan-staging/rc12-mobile-final.css`
- restores iPhone Safe Area after later Design System overrides.
- uses `100dvh` for Safari dynamic viewport handling.
- prevents Safari focus zoom by using 16px mobile form controls.
- strengthens touch targets.
- protects floating Bottom Nav from Home Indicator.
- keeps wide financial tables horizontally scrollable without page-wide overflow.
- hardens modal viewport/scroll behavior.
- hardens Smart Document Viewer sizing/pan behavior.
- hardens Company Profile mobile layout.
- no Ledger/RLS/backend changes.

Gate file:
- `avan-staging/RC1_2_F_GATE.md`

Expected pass phrase:
- `Gate RC1.2-F پاس شد`

Do not mark F PASS before explicit user confirmation.

---

## 12) After RC1.2-F

### RC1.3-A — Production-ready Auth
- password recovery email
- SMTP
- redirect URLs
- email templates
- domain-dependent finalization later

### RC1.3-B — Company / operational settings completion
- remaining company/tax operational metadata only where required by upcoming modules/outputs

### RC1.3-C — Operational controls
- backup/restore strategy
- usable Audit Log UX
- user-friendly operational errors
- session/recovery controls

### RC1.3-D — Full regression
- RLS
- journals/invoices/reports
- currency
- fiscal periods
- integrity
- Smart Documents manual flow
- print/export
- company identity
- mobile/iPhone

### RC1.3-RC
- feature freeze
- Blocker/Critical fixes only

Then: approved Staging → Production/root promotion.

---

## 13) Official Future Product Roadmap

This scope remains official and must not be lost during stabilization.

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
