# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از Live PASS شدن **RC1.3-B Company / Operational Settings** و ورود پروژه به **RC1.3-C Operational / Security Controls**.

این فایل وضعیت جاری پروژه است و پس از هر Gate پاس‌شده یا تصمیم معماری مهم باید به‌روزرسانی شود.

## Startup rule for every new chat
1. `AVAN_MASTER_PROMPT.md` را بخوان.
2. این فایل را بخوان.
3. `docs/adr/README.md` و ADRهای Accepted مرتبط را بخوان.
4. Repository/PRها، Supabase migrations و آخرین Live Gate را تطبیق بده.
5. از آخرین نقطه واقعی ادامه بده؛ هیچ Gate را بدون تایید صریح کاربر PASS نکن.

---

## 1) Repository / Release Workflow
Repository: `afzalpour/afzalpour.github.io`

- Root = Production/current public root.
- `avan-staging/` = Staging development + Gate environment.
- `docs/adr/` = Architecture Decision Records.
- Workflow: Branch → PR → Diff review → Merge → Live Gate.
- Production/root promotion فقط پس از Full Regression و RC freeze.

Source of Truth:
- `AVAN_MASTER_PROMPT.md`
- `AVAN_CURRENT_STATE.md`
- Accepted ADRs
- Repository / Supabase migration truth
- نتیجه Live Gate کاربر

---

## 2) Explicit Live PASS history
- Gate B-4 Live — PASS
- Gate B-4.1 — PASS
- RC1 + two-user RLS — PASS
- RC1.1-A Money UX — PASS
- RC1.1-B Currency — PASS
- RC1.1-C Unit Density — PASS
- RC1.1-D User Administration — PASS
- RC1.1-F UX Cleanup — PASS
- RC1.2-B Premium visual polish — PASS
- RC1.2-CF OCR Freeze — PASS
- RC1.2-D Unified Print & Export — PASS
- RC1.2-E Professional A4 + Company Print Identity — PASS
- RC1.2-F Mobile/iPhone Final UX — PASS
- RC1.2-F.1 Complete Mobile Navigation — PASS
- **RC1.3-B Company / Operational Settings — PASS**

Not explicitly marked with Gate phrase:
- RC1.2-D.1 Persian print polish — merged and retained.
- RC1.3-A1 — user explicitly confirmed recovery email arrived and password reset succeeded on desktop and iPhone web; functional Live success is confirmed, but sender branding remains deferred. Do not invent a formal Gate phrase retroactively.

Current phase:
- **RC1.3-C Operational / Security Controls.**

---

## 3) Latest Important Merges
- RC1.2-D.1 Print polish: `307a65f96293fc89b621ed68bf1078f0474d921b`
- RC1.2-E Company Print Identity: `106e1b1e0ada840b2a6ae5f397f9b388c4980496`
- RC1.2-E.2 Company Profile UI stability: `99f291805f6bdb75ff7184787c687451b761d90d`
- RC1.2-F Mobile/iPhone final UX: `6123ac86a178556f74c228fc592c28769d5fbda3`
- RC1.2-F.1 Complete Mobile Navigation: `00d15b061983d5f1afdf4e9de165a292dac404b1`
- RC1.3-A1 Auth Recovery Hardening: `8807f117918dd4e25d31f8c758c3d591b3e8681d`
- **RC1.3-B Company / Operational Settings: `96915960a12575364cde0ad081e1ede6059fe1e1` (PR #26)**

PWA staging cache after RC1.3-B: **v31**.

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
- ADR-0007 Versioned Tax Rules
- ADR-0008 Unified Print/Export
- ADR-0013 Freeze Browser OCR

---

## 5) Authentication — RC1.3-A status
Working:
- Owner changes eligible other-user password via secure Edge Function.
- User changes own password after re-authentication.
- Forgot-password request hardened with generic anti-enumeration response, email validation, 60s cooldown, rate-limit handling and expired/invalid callback handling.
- Recovery email delivery and password reset were Live-confirmed by user on desktop and iPhone web.

Still deferred before Production:
- Current sender appears as Supabase because default Supabase SMTP is used.
- Custom sender branding (`آوان <no-reply@...>`) requires custom SMTP and verified sending identity/domain.
- Final custom-domain redirect configuration when a domain exists.
- Professional branded Auth templates can be finalized alongside custom SMTP/domain.

Do not use Gmail as the production transactional SMTP workaround.

---

## 6) Company Print Identity / Operational Profile
Source of truth remains:
- `public.workspace_print_profiles`
- read RPC `get_workspace_print_profile(wid)`
- write RPC `set_workspace_print_profile(wid,p_profile)`
- private logo bucket `avan-branding`

Existing fields:
- display/legal name
- registration number
- national ID
- economic code
- tax ID
- phone/email/postal code/address
- private logo

### RC1.3-B — LIVE PASS
Adds:
- `entity_type`: `individual | legal | other` → حقیقی / حقوقی / سایر
- `province`
- `city`
- optional `invoice_footer`

Behavior:
- Settings card title: `مشخصات شرکت و چاپ`
- Owner/Manager edit; other workspace users read-only.
- Print header can show entity type and province/city/address.
- `invoice_footer` is printed only on invoice detail print, never journal/report.
- Existing print digit localization, centered invoice/journal tables and logo behavior retained.
- No `app.js` change.
- No Ledger, journal lifecycle, invoice posting, numbering, canonical money or financial-RLS change.
- No VAT/tax rates or Iranian taxpayer-system rules hard-coded; ADR-0007 remains authoritative.

Supabase migration applied directly and verified:
- migration: `20260905102441 rc1_3_b_company_operational_profile`
- columns `entity_type`, `province`, `city`, `invoice_footer` exist.
- company profile RPC privileges verified: `anon=false`, `authenticated=true`.

Gate file:
- `avan-staging/RC1_3_B_GATE.md`
- User explicitly confirmed: `Gate RC1.3-B پاس شد`

---

## 7) Mobile / iPhone
RC1.2-F and F.1 are Live PASS.

Bottom Nav:
- خانه
- حساب‌ها
- ثبت
- گزارش
- بیشتر

`بیشتر` sheet exposes:
- فاکتورها
- اسناد حسابداری
- اسناد هوشمند
- طرف‌حساب‌ها
- تنظیمات

Safe Area, 100dvh modal behavior, Safari input sizing, wide table scrolling and mobile company settings are retained.

---

## 8) Smart Documents / OCR
Browser-local OCR is **Frozen** under ADR-0013.

Supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

Do not restart ad-hoc local OCR tuning. Revisit only with a stronger Document AI/OCR provider and representative Persian benchmark set.

---

## 9) Current phase — RC1.3-C Operational / Security Controls
Supabase Security Advisor on 2026-09-05 identified legacy hardening items that must be handled with targeted regression testing:

- Multiple existing `SECURITY DEFINER` functions in `public` still appear executable by `anon`/PUBLIC, including financial/reporting RPC surfaces. Many may have internal auth/workspace checks, but grants must be reviewed and narrowed intentionally rather than changed wholesale.
- `Leaked Password Protection` is disabled in Supabase Auth.
- `workspace_print_profiles` has RLS enabled with no direct row policies by design because table privileges are revoked and access is through controlled RPCs; do not add permissive policies just to silence the advisor.
- Performance advisor reports several unindexed FKs and some policy/init-plan inefficiencies; review selectively in operational/performance hardening.

RC1.3-C scope:
- backup/restore strategy
- usable Audit Log UX
- user-friendly operational errors
- session/recovery controls
- SECURITY DEFINER EXECUTE-grant inventory and hardening
- leaked-password protection review/enablement where supported
- targeted operational/performance fixes with regression coverage

Hard rule:
- do not bulk-revoke or change grants without mapping each browser/RPC dependency and running the relevant two-user/RLS/financial regression.

---

## 10) Next roadmap
After **RC1.3-C Live PASS**:

### RC1.3-D — Full Regression
- two-user / workspace RLS
- journal Draft/Posted/Reversed immutability
- invoices/reports
- currency and fiscal periods
- integrity / orphan lines zero
- Smart Documents manual flow
- print/export/company identity
- mobile/iPhone/navigation
- auth recovery

### RC1.3-RC
- feature freeze
- Blocker/Critical fixes only

Then:
- approved Staging → Production/root promotion
- custom domain + production SMTP/sender branding finalized when domain exists.

---

## 11) Official Future Product Direction
آوان = حسابداری + انبار + فروش + مالیات + خزانه + اتوماسیون + AI + Voice + تصمیم‌یار مدیریتی.

Future pillars remain:
- CFO Autopilot / explainable KPIs / cash forecast / scenarios
- Continuous Audit / Collections / Close Autopilot
- stronger server/provider Document AI with human-controlled posting
- Inventory Stock Ledger / multi-warehouse / costing
- Sales & Purchase lifecycle
- Versioned Tax/VAT + electronic invoicing based on current law at implementation time
- Treasury / bank reconciliation / cheque lifecycle
- Payroll / Fixed Assets / Budgeting
- Approval workflows / Multi-company / integrations
- Persian Voice AI with explicit consent; never voice as financial authentication

Governing principle:
**اعتماد مالی + UX حرفه‌ای + اتوماسیون + هوش توضیح‌پذیر + تصمیم‌سازی مدیریتی.**
