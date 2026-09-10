# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-10 — RC1.5 = Production Released؛ RC1.6-A/B/C در Staging Engineering PASS هستند؛ RC1.6-B و RC1.6-C برای Scope پیاده‌شده Live PASS دارند؛ کاربر PR #113 را نیز با «۴ اصلاح نهایی Live PASS» تأیید کرده است؛ RC1.6 وارد Release Candidate consolidation شده است.**

این فایل Source of Truth وضعیت جاری پروژه است. ترتیب مرجع: `AVAN_MASTER_PROMPT.md` → این فایل → ADRهای Accepted → Repository → گزارش واقعی Live کاربر. Engineering/Backend PASS جایگزین Live PASS نیست.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / next release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- zero-charge policy remains binding.
- Web/PWA active release target است؛ Windows/Desktop/true offline همچنان deferred است.

### Production

- **RC1.5 = current Production release**.
- Production promotion PR: **#103 — Release RC1.5 to Production**.
- Production merge commit: `d5f3c704e81d359ae86c505d12fbc9df8d8f0d14`.
- Production Service Worker cache: `avan-prod-rc1-5-v1`.
- Production Release Gate #1 = PASS؛ post-merge Release Gate #2 = PASS؛ Pages #332 = PASS؛ external HTTP Smoke #1 = PASS.
- rollback branch: `prod-backup-20260910-rc1-5-pre-promotion` at `38fb915cfe98ecc82015c1f1e46fc4a7827a9613`.
- **Production runtime has not yet been changed by RC1.6 work.**
- No RC1.6 Production promotion is authorized until Release Candidate Gate and explicit Production Release Gate are complete.

### Staging / RC1.6

Latest functional Staging merge head: `781ce0418c86a492a656080ac45681b6251804cb` (PR #113).

Current Staging Service Worker cache: `avan-staging-rc1-v101-accounting-negative-display`.

RC1.6 consists of:

1. **RC1.6-A — Bank Reconciliation Foundation** — Engineering/Backend PASS.
2. **RC1.6-B — Bank Statement Import + Reconciliation UI / Live refinements** — Engineering PASS + Live PASS for implemented scope.
3. **RC1.6-C — Party Ledger / صورتحساب مالی طرف‌حساب** — Engineering PASS + full Live PASS including PR #113 final presentation polish.

Current phase: **RC1.6 Release Candidate consolidation / Production Release Gate preparation**.

---

## 2) Explicit Live acceptance

### RC1.5

User explicitly accepted full RC1.5 Live Gate with:

**«شش مورد پاس شد — RC1.5 Live PASS»**

RC1.5 is already released to Production.

### RC1.6-B — Bank Reconciliation

The user explicitly confirmed the implemented scope through granular Live checks:

- real ESC-delimited bank statement import works;
- exact one-Rial receipt/payment/transfer works;
- invoice tax selector works;
- reconciliation no-candidate path can create the appropriate financial event;
- receipt/payment counterpart can be any valid active postable account while transfer remains restricted to bank/cash;
- a transaction explicitly Voided for a statement line no longer returns as a candidate for that same line.

These confirmations establish **RC1.6-B Live PASS for the implemented scope**.

### RC1.6-C — Party Ledger

User first explicitly reported:

**«اصلاحات صورتحساب Live PASS»**

for the Party Ledger implementation through PR #112.

PR #113 then added four final presentation refinements. The user explicitly reported:

**«۴ اصلاح نهایی Live PASS»**

This accepts:

1. Reports launcher contains only Party selector + `مشاهده صورتحساب` before opening the statement;
2. Jalali range remains inside statement and redundant instruction is removed;
3. Party Ledger detail headers/values are centered on screen and Print/PDF;
4. negative financial output is visually red accounting notation `(amount)` while signed numeric truth/calculations remain unchanged.

Therefore **RC1.6-C Full Live Gate = PASS**.

---

## 3) RC1.6-A — Bank Reconciliation Foundation

- PR #105 merged as `db6844b2ff1f273ed0d63ba906740d73e42cdf45`.
- PR Architecture Gate #156 = PASS.
- post-merge main Architecture Gate #157 = PASS.
- ADR-0022 defines Bank Statement Reconciliation boundary.
- Backend tables: `bank_statement_imports`, `bank_statement_lines`, `bank_reconciliation_matches`.
- Company/RLS boundary applies to all three tables.
- candidate RPC is read-only / `SECURITY INVOKER`; no autonomous financial posting.
- matching/finalization remains Human-controlled.
- Void/audit lifecycle is used instead of destructive match deletion.
- one-Rial exactness and opening/closing balance equation are enforced.
- authenticated rollback rehearsals covered positive match, wrong direction reject, one-Rial mismatch reject, cross-company reject, unresolved finalize reject, closing-balance mismatch reject and valid finalize PASS.
- public executable `SECURITY DEFINER` exposure remained zero.

**RC1.6-A Engineering/Backend Gate = PASS.**

---

## 4) RC1.6-B — Bank Statement Import + Reconciliation UI

Evidence chain:

- PR #106 merged `ea787f6688fac84fc1c28907542d5a184f9f58fe` — initial Bank Statement Import + Reconciliation workspace.
- PR #107 merged `229977af2d53118f79528e3c314d485029e53423` — CSV/Persian UI/tax selector/odd-Rial compatibility; Gate #163 PASS.
- PR #108 merged `94e80723cf7976ec1fdf8c89298be7ee9f5668f7` — real ESC bank-file normalization + exact one-Rial financial operations; Gate #165 PASS.
- PR #109 merged `8679f7305d962af0b47ee2a0e01716f23e52108e` — stable tax lifecycle + compact bank history/no-candidate flow; Gates #173/#174 PASS; Pages #346 PASS.
- PR #110 merged `e49cc33eb35c7f6c54aa139d0c1f02fddf52fc06` — operation-account scope + pair-level Void candidate suppression; Gates #176/#177 PASS; Pages #347 PASS.

Bank file compatibility was proven against a real ASCII ESC (`0x1B`) delimited statement containing 106 valid transactions.

Accounting invariant:

- receipt/payment counterpart = any valid active postable account;
- transfer counterpart = bank/cash only.

Reconciliation invariant:

- a candidate explicitly voided for one statement line is suppressed only for that transaction/statement-line pair; unrelated lines remain unaffected.

**RC1.6-B Engineering Gate = PASS.**  
**RC1.6-B Live Gate = PASS for implemented scope.**

---

## 5) RC1.6-C — Party Ledger / صورتحساب مالی طرف‌حساب

### Accounting model

Party Ledger derives outstanding position only from the selected party's AR/AP control-account lines using exact `party_id`, never free-text name matching.

Reason: financial operation posting can tag both Journal sides with the party. Summing every party-tagged Journal line would cancel and misstate outstanding exposure.

Contract:

- receivable position = debit − credit on configured `receivable` control account;
- payable position = credit − debit on configured `payable` control account;
- informational net claim = receivable − payable;
- gross receivable/payable balances are shown separately; no automatic offset/net settlement;
- direct cash activity with no AR/AP exposure does not distort outstanding balance;
- exact 0.1 Toman / one-Rial precision is preserved.

### PR #111 — foundation

- merged `f5a828d86106e58cff364916335e995b4ee9801c`.
- PR Gate #180 PASS; post-merge Gate #181 PASS; Pages #348 PASS.
- Party page exposes `صورتحساب مالی`.
- Reports exposes `گردش و مانده طرف‌حساب`.
- report includes opening, period debit/credit, gross receivable/payable, net status and chronological running balance.

### PR #112 — Live UX/Print polish

- merged `ec4e1c816c70bad114f53f65788fad81790c00b4`.
- PR Gate #182 PASS; post-merge Gate #183 PASS; Pages #349 PASS.
- wider statement surface;
- Jalali from/to selector inside statement;
- debtor statement red / creditor statement blue;
- KPI overflow protection;
- no repeated money unit beside detail amounts;
- `چاپ / ذخیره PDF` using unified Avan print pipeline.
- Explicit Live PASS reported by user.

### PR #113 — final presentation polish

- merged `781ce0418c86a492a656080ac45681b6251804cb`.
- PR Architecture Gate #184 PASS.
- post-merge main Architecture Gate #185 PASS.
- Pages #350 PASS.
- Reports launcher now contains only Party selector + `مشاهده صورتحساب`;
- date range remains inside statement;
- redundant Jalali explanatory sentence removed;
- Party Ledger detail headings and values centered on screen and Print/PDF;
- centralized accounting-negative presentation added for financial output surfaces:
  - algebraically negative values remain signed internally;
  - browser/print visual shows absolute figure in parentheses and red instead of visible minus;
  - presentation-only; no rewrite of database/Core/API numeric values;
  - uses central UI Lifecycle, not a new generic monetary `MutationObserver`;
  - Print/PDF receives same presentation before cloning;
  - CSV/raw computational semantics retain signed numeric values.
- PWA cache = `avan-staging-rc1-v101-accounting-negative-display`.
- User explicitly reported **«۴ اصلاح نهایی Live PASS»**.

**RC1.6-C Engineering/Frontend Gate = PASS.**  
**RC1.6-C Full Live Gate = PASS.**

---

## 6) Governing invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- browser never receives Service Role/private secrets.
- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Canonical money = **Toman with 0.1 Toman = 1 Rial** under ADR-0019.
- `1515 Rial` persists losslessly as `151.5 Toman`.
- sub-Rial values are rejected, never silently rounded.
- browser Local/Session Storage is not a financial datastore.
- account hierarchy is structural; only valid leaves are postable.
- Persian-first / RTL; iPhone/mobile is first-class.
- no new shared-client monkey patching; central Operation Pipeline / UI Lifecycle / Money Runtime are extension boundaries.
- AI/automation remains Human-controlled and explainable.
- applied DB migration history is immutable; corrections are additive follow-up migrations.
- negative accounting notation `(amount)` is Presentation Layer only; signed numeric truth remains unchanged in Core/DB.

---

## 7) Security / RLS / recovery posture

- public financial data remains RLS-governed.
- authenticated-executable public `SECURITY DEFINER` = 0 at latest verified security baseline.
- anon-executable public `SECURITY DEFINER` = 0 at latest verified security baseline.
- Session guard = 60-minute inactivity + 12-hour max + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Supabase built-in Leaked Password Protection remains unavailable under current zero-charge/provider posture; it must not be falsely marked fixed.
- Free Transactional Recovery Rehearsal = PASS.
- real external disaster restore to an isolated fresh target remains OPEN because no genuinely free isolated restore target is available; never restore against `Avan-production` itself.

A fresh read-only security/integrity verification is required for the RC1.6 Release Candidate Gate.

---

## 8) Production integrity baseline

Last formal RC1.5 Production read-only baseline on 2026-09-10:

- workspaces 7; memberships 8; accounts 546; journal entries 75; journal lines 171; invoices 35; storage objects 25.
- Posted/Reversed Ledger debit = credit = **4,081,615,836.9 Toman**.
- unbalanced Posted/Reversed journals = 0.
- orphan journal lines = 0.
- authoritative invoice total mismatch = 0.
- Posted/Reversed invoices without journal = 0.
- settlement schedule total mismatch = 0.
- orphan settlement schedules/checks = 0.
- unreconciled inventory companies = 0.
- anon/authenticated-executable public `SECURITY DEFINER` = 0.

This is a Production RC1.5 baseline. RC1.6 Release Candidate preparation requires a fresh read-only database verification before Production promotion.

---

## 9) Strategic architecture — ADR-0023

The user explicitly approved the nine strategic differentiators and requested them to be stored in architecture. ADR-0023 is therefore **Accepted**.

Official strategic modules:

1. **Avan Financial Control Tower — برج کنترل مالی**;
2. **Financial Digital Twin — دوقلوی مالی کسب‌وکار**;
3. **Working Capital Autopilot — اتوپایلوت سرمایه در گردش**;
4. **Continuous Close + Continuous Audit — بستن و حسابرسی مستمر**;
5. **Iran Compliance Radar — رادار هوشمند تعهدات قانونی ایران**;
6. **Counterparty 360 — پرونده مالی هوشمند طرف‌حساب**;
7. **Smart Procurement & Spend Control — خرید و کنترل هزینه هوشمند**;
8. **Avan Evidence Graph — گراف شواهد مالی**;
9. **Avan Connect / Automation Marketplace — پلتفرم اتصال و اتوماسیون**.

Detailed roadmap: `docs/AVAN_INTELLIGENT_FINANCE_ROADMAP.md`.

### Priority

Modules 1 and 2 are **Early Priority**.

The planned sequence is:

1. finish/freeze RC1.6 release boundary and Production Release Gate;
2. immediately begin **Control Tower Foundation + Digital Twin Foundation** in the next Staging cycle;
3. do not mix those new features into the RC1.6 promotion diff;
4. continue Treasury/Checks → Sales/Purchase completeness → Inventory completeness;
5. expand Evidence Graph cross-cutting as each new domain is added;
6. schedule modules 3–9 at the highest-value architectural points rather than by feature-count pressure.

Strategic thesis:

**آوان فقط نمی‌گوید چه اتفاقی افتاده؛ می‌گوید چرا اتفاق افتاده، بعد چه می‌شود، و الان چه اقدام کنترل‌شده‌ای باید انجام شود.**

Guardrails:

- deterministic financial calculation before LLM narrative;
- evidence before recommendation;
- Actual vs Forecast vs Scenario explicitly separated;
- no silent AI posting/payment;
- every important number should be drillable to evidence;
- scenario engine cannot mutate Actual Ledger;
- Company/RLS and one-Rial exactness apply to all intelligence layers.

---

## 10) Immediate next gate

The final RC1.6 feature Live Gate is complete.

Immediate next step:

**RC1.6 Release Candidate consolidation / Production Release Gate preparation**

Required actions:

1. synchronize architecture/state docs and freeze an explicit RC1.6 candidate branch/SHA;
2. run full Staging Architecture/Regression Gate at frozen head;
3. run PWA precache integrity Gate;
4. run fresh read-only DB integrity checks for Ledger, invoices, settlement, inventory and bank reconciliation;
5. verify Company/RLS and `SECURITY DEFINER` security baseline;
6. verify one-Rial precision, Print/PDF and accounting-negative presentation regressions;
7. create fresh pre-RC1.6 Production rollback branch/SHA;
8. build controlled Staging → Production promotion diff preserving Production-only configuration;
9. execute Production Release Gate before merge;
10. after Production merge, run post-merge Release Gate + Pages + external HTTP smoke + fresh read-only DB integrity verification.

**Production promotion is not automatic.** A separate explicit Production Release Gate remains required.

After the RC1.6 release boundary is frozen, the next Staging feature cycle starts **Control Tower Foundation + Digital Twin Foundation** under ADR-0023.
