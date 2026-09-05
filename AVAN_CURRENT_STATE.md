# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از Live PASS شدن **RC1.3-C1.1 Audit Role Boundary** و پذیرش **ADR-0014 Multi-tenant Company + Platform Admin**.

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
- RC1.3-B Company / Operational Settings — PASS
- **RC1.3-C1 Security Definer + Audit UX — PASS**
- **RC1.3-C1.1 Audit Role Boundary — PASS**

Not explicitly marked with Gate phrase:
- RC1.2-D.1 Persian print polish — merged and retained.
- RC1.3-A1 — recovery email and password reset succeeded on desktop and iPhone web; sender branding remains deferred.

Current phase:
- **RC1.3-C1.2 Company Context & Settings UX** per ADR-0014.

---

## 3) Latest Important Merges
- RC1.2-D.1 Print polish: `307a65f96293fc89b621ed68bf1078f0474d921b`
- RC1.2-E Company Print Identity: `106e1b1e0ada840b2a6ae5f397f9b388c4980496`
- RC1.2-E.2 Company Profile UI stability: `99f291805f6bdb75ff7184787c687451b761d90d`
- RC1.2-F Mobile/iPhone final UX: `6123ac86a178556f74c228fc592c28769d5fbda3`
- RC1.2-F.1 Complete Mobile Navigation: `00d15b061983d5f1afdf4e9de165a292dac404b1`
- RC1.3-A1 Auth Recovery Hardening: `8807f117918dd4e25d31f8c758c3d591b3e8681d`
- RC1.3-B Company / Operational Settings: `96915960a12575364cde0ad081e1ede6059fe1e1` (PR #26)
- RC1.3-C1 Security Definer + Audit UX: `2245b0c59ff7ac80f1de4424f7d231d453610f24` (PR #27)
- **RC1.3-C1.1 Audit Role Boundary: `d8b31318e3bcc7f53730403fbcca726704a52bfe` (PR #28)**

PWA staging cache after C1.1: **v33**.

---

## 4) Core Financial Invariants
- PostgreSQL/Supabase = financial Source of Truth.
- Financial data is not stored in LocalStorage.
- Auth + Workspace/Company-based RLS active.
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
- ADR-0011 Multi-workspace → Multi-company
- ADR-0013 Freeze Browser OCR
- **ADR-0014 Multi-tenant Company + Platform Admin**

---

## 5) Authentication — RC1.3-A status
Working:
- Owner changes eligible other-user password via secure Edge Function.
- User changes own password after re-authentication.
- Forgot-password request hardened with generic anti-enumeration response, email validation, cooldown, rate-limit handling and expired/invalid callback handling.
- Recovery email delivery and password reset Live-confirmed on desktop and iPhone web.

Still deferred before Production:
- Current sender appears as Supabase because default Supabase SMTP is used.
- Custom sender branding requires custom SMTP and verified sending identity/domain.
- Final custom-domain redirect configuration when a domain exists.
- Professional Auth templates finalized with custom SMTP/domain.

---

## 6) Company / Multi-tenant Architecture — ADR-0014
آوان رسماً **Multi-tenant / Multi-company SaaS** است؛ نه نرم‌افزار تک‌شرکتی.

### Company boundary
- هر Workspace مسیر محصولی یک Company / Business Context مستقل است.
- User می‌تواند عضو چند Company باشد و در هر Company Role متفاوت داشته باشد.
- User می‌تواند Owner شرکت خودش و Accountant/Manager شرکت دیگری باشد.
- Journal / Invoice / Document به Company تعلق دارند، نه سازنده سند.
- اعضای مجاز همان Company دفتر مالی مشترک Company را می‌بینند.
- Cross-company leakage = Blocker/Critical defect.

### Company Profile
- `workspace_print_profiles` متعلق به Company است، نه User.
- Owner/Manager Company می‌توانند آن را ویرایش کنند.
- Accountant/Viewer در Company دیگر Read-only هستند.
- همان User اگر در Company خودش Owner باشد، مشخصات Company خودش را ویرایش می‌کند.
- Per-user company identity داخل یک Company ممنوع است.

### Platform Admin
- `platform_admin/system_admin` سطح Control Plane آوان است و عضو خودکار Companyها نیست.
- Platform Admin برای Tenant lifecycle, plans, system health, support operations است.
- Platform Admin به‌طور پیش‌فرض Ledger/Invoices/Documents شرکت‌ها را نمی‌بیند.
- Support Access آینده باید Explicit + Time-bounded + Reason-required + Audit-logged باشد.

### Current UX defect found
- `avan-cloud-bootstrap.js` در سناریوی عضویت کاری، Workspace شخصی Owned را suppress می‌کند.
- داده واقعی نشان داد User دوم هم‌زمان Accountant یک Workspace و Owner یک Workspace دیگر است، اما UX می‌تواند Workspace Owned را پنهان کند.
- این suppression باید در C1.2 حذف/بازطراحی شود و `شرکت فعال` صریح شود.

---

## 7) Company Print Identity / Operational Profile
Source of truth:
- `public.workspace_print_profiles`
- `get_workspace_print_profile(wid)`
- `set_workspace_print_profile(wid,p_profile)`
- private bucket `avan-branding`

Fields:
- display/legal name
- entity type
- registration/national/economic/tax IDs
- phone/email/postal code
- province/city/address
- invoice footer
- private logo

RC1.3-B = Live PASS.

---

## 8) Audit / Security — RC1.3-C1 + C1.1
### C1
- all 43 public SECURITY DEFINER functions: PUBLIC execute=0, anon execute=0, authenticated preserved.
- Audit Log UX added.

### C1.1
- `audit_logs` broad privileges removed from anon/authenticated.
- authenticated can SELECT only safe columns used by UI.
- `before_json/after_json` unavailable to browser users.
- Owner/Manager see admin/access audit events.
- Accountant/Viewer do not see admin/access events.
- Live two-user Gate passed.

Security Advisor still warns that many SECURITY DEFINER functions are callable by authenticated users; some are intentionally browser RPCs. Further reduction must be dependency-by-dependency, not bulk.

Leaked Password Protection remains disabled and is pending Auth operational hardening where plan support allows.

---

## 9) RLS finding pending targeted fix
During Company/Document visibility review, current policies correctly scope SELECT on `journal_entries`, `invoices`, `invoice_lines`, `documents` and `journal_lines` by `has_workspace_access(workspace_id)`.

However `journal_lines` draft INSERT/UPDATE/DELETE policy expressions contain a suspicious tautology:
`e.workspace_id = e.workspace_id`
instead of an explicit parent-line workspace equality.

This must be corrected in a targeted migration and Gate during C1.2/C security hardening. Do not change unrelated Ledger semantics.

---

## 10) Settings UX target order — ADR-0014
Settings should render in this order:
1. **حساب کاربری** — personal user/password/session
2. **شرکت فعال / مشخصات شرکت و چاپ**
3. **کاربران و دسترسی‌ها** — Company admins only
4. financial/display/operational Company settings
5. **گزارش فعالیت**
6. security/operational controls

---

## 11) Mobile / iPhone
RC1.2-F and F.1 = Live PASS.

Bottom Nav:
- خانه
- حساب‌ها
- ثبت
- گزارش
- بیشتر

`بیشتر`:
- فاکتورها
- اسناد حسابداری
- اسناد هوشمند
- طرف‌حساب‌ها
- تنظیمات

---

## 12) Smart Documents / OCR
Browser-local OCR is Frozen under ADR-0013.

Supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

---

## 13) Immediate roadmap before Production
### RC1.3-C1.2 — Company Context & Settings UX
- stop suppressing Owned personal/company workspace
- explicit `شرکت فعال` selector
- show Role in active Company
- Settings reorder per ADR-0014
- Company profile editable based on role of active Company
- same-company shared financial document behavior retained
- cross-company isolation Gate
- targeted `journal_lines` RLS parent-workspace fix

### RC1.3-C1.3 — Company Creation / Rename
- explicit Create Company flow
- Owner assignment
- company rename/profile initialization
- remove bootstrap naming ambiguity

### RC1.3-C2 — Platform Control Plane Skeleton
- Platform Admin data model separate from `workspace_members`
- Company/Tenant registry/status
- no default tenant Ledger access
- audited support-access design

### RC1.3-C3 — Backup / Restore / Session / Operational Controls
- backup strategy
- restore procedure
- session controls
- operational safety checks

### RC1.3-D — Full Regression
- multi-company/two-user RLS
- Draft/Posted/Reversed immutability
- invoices/reports/currency/fiscal periods
- orphan lines zero
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

## 14) Official Product Direction
آوان = حسابداری + انبار + فروش + مالیات + خزانه + اتوماسیون + AI + Voice + تصمیم‌یار مدیریتی.

Future pillars:
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
