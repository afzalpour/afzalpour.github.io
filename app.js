import {
  jalalizeDateInputs
} from './src/ui/date/jalali-picker.js';
import {
  errorMessageFa
} from './src/ui/errors/error-messages-fa.js';
import {
  toast,
  showError
} from './src/ui/feedback/toast.js';
import {
  openModal,
  closeModal,
  bindModalBackdrop
} from './src/ui/components/modal.js';

import {
  setTitle,
  setNav,
  page
} from './src/ui/shell/shell-view.js';

import {
  showAuth as uiShowAuth,
  setAuthMode as uiSetAuthMode,
  bindAuthModeTabs
} from './src/ui/auth/auth-view.js';

import {
  createAuthController
} from './src/application/auth/auth-controller.js';

import {
  buildWhyNumberEvidence
} from './src/reports/why-number.js';

import {
  buildPartyAging
} from './src/reports/party-aging.js';

import {
  partyAgingSection,
  partyAgingDetailHtml
} from './src/ui/reports/party-aging-view.js';
import {
  parsePersianReportIntent
} from './src/reports/nl-report-intent.js';

import {
  executeReportIntent
} from './src/reports/nl-report-executor.js';

import {
  naturalReportBoxHtml,
  naturalReportResultHtml
} from './src/ui/reports/nl-report-view.js';
import {
  buildFinancialCopilotSnapshot,
  answerBusinessQuestion
} from './src/ai/business-copilot.js';

import {
  financialCopilotSectionHtml,
  businessAnswerHtml
} from './src/ui/intelligence/business-copilot-view.js';
import {
  createDocumentService
} from './src/documents/document-service.js';

import {
  documentsPageHtml,
  documentUploadModalHtml
} from './src/ui/documents/documents-view.js';
import {
  buildDocumentDraftProposal
} from './src/documents/document-proposal.js';
import {
  recognizeLocalDocument
} from './src/documents/local-ocr-runtime.js';

import {
  buildLocalOcrExtraction
} from './src/documents/local-ocr-extraction.js';

import {
  documentReviewModalHtml
} from './src/ui/documents/document-review-view.js';

import {
  installAvanCloud
} from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

(function(){
'use strict';
const Q=id=>document.getElementById(id), C=installAvanCloud();
const Auth=createAuthController(C);
const Documents=
  createDocumentService(C);
const authCallback=Auth.consumeAuthCallback();
let currentPage='dashboard';
let reportState={
  tab:'trial',
  from:null,
  to:null,
  ledgerAccount:null,
  nlQuery:'',
  nlResult:null
};
let invoiceFilter='all';
let dashboardAging=null;
let dashboardIntelligence=null;  
let ctx={
  user:null,
  workspace:null,
  fiscalYear:null,
  accounts:[],
  roles:{},
  parties:[],
  entries:[],
  lines:[],
  financialAccounts:[],
  periods:[],
  transactions:[],
  invoices:[],
  invoiceLines:[],
  documents:[],
  invoiceIntegrity:null,
  health:null,
  integrity:null,
  workspaceRole:null,
  visibleWorkspaces:0
};
const faDigits=s=>String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const cleanAmount=v=>faDigits(v).replace(/[٬,\s]/g,'').replace(/[^0-9-]/g,'');
const bi=v=>{try{return BigInt(cleanAmount(v)||'0')}catch{return 0n}};
const money=v=>{let n=bi(v),sign=n<0n?'-':'';if(n<0n)n=-n;return sign+n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'٬')+' تومان'};
const today=()=>new Date().toISOString().slice(0,10);
const dateFa=s=>{try{return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s+'T12:00:00'))}catch{return s||'—'}};
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const catFa={asset:'دارایی',liability:'بدهی',equity:'حقوق مالکانه',income:'درآمد',expense:'هزینه'};
const levelFa={1:'کل',2:'معین',3:'تفصیلی'};
const statusFa={draft:'پیش‌نویس',posted:'ثبت‌شده',reversed:'برگشتی'};
const roleFa={owner:'مالک',manager:'مدیر',accountant:'حسابدار',viewer:'مشاهده‌گر'};
const invoiceTypeFa={sale:'فروش',purchase:'خرید'};

bindModalBackdrop();

const acct=id=>ctx.accounts.find(a=>a.id===id);
const party=id=>ctx.parties.find(p=>p.id===id);
const invoice=id=>ctx.invoices.find(x=>x.id===id);
const role=k=>ctx.roles[k];
const activePostable=()=>ctx.accounts.filter(a=>a.is_active&&a.is_postable);
const financialLedgerIds=()=>new Set(ctx.financialAccounts.filter(f=>f.is_active).map(f=>f.ledger_account_id));
const financialPostable=()=>{const ids=financialLedgerIds();return activePostable().filter(a=>ids.has(a.id))};
const accountOptions=(selected='',filter=()=>true)=>ctx.accounts.filter(filter).map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('');
const partyOptions=(selected='')=>`<option value="">بدون طرف‌حساب</option>`+ctx.parties.filter(p=>p.is_active).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');

async function loadContext(){
  ctx.user=await Auth.user(); if(!ctx.user)throw new Error('AUTH_REQUIRED');
  let ws=await C.select('workspaces','select=id,name,mode,base_currency,created_at&order=created_at.asc');
  if(!ws?.length){
    await C.rpc('bootstrap_avan_workspace',{p_name:'فضای مالی من',p_mode:'personal',p_money_unit:'toman',p_fiscal_name:'۱۴۰۵',p_date_from:'2026-03-21',p_date_to:'2027-03-20'});
    ws=await C.select('workspaces','select=id,name,mode,base_currency,created_at&order=created_at.asc');
  }
  ctx.visibleWorkspaces=ws.length;ctx.workspace=ws[0]; const wid=ctx.workspace.id;
  let result;
  try{
    result=await Promise.all([
      C.select('fiscal_years',`select=*&workspace_id=eq.${wid}&order=date_from.desc&limit=1`),
      C.select('accounts',`select=*&workspace_id=eq.${wid}&order=code.asc`),
      C.select('account_roles',`select=role_key,account_id&workspace_id=eq.${wid}`),
      C.select('parties',`select=*&workspace_id=eq.${wid}&order=name.asc`),
      C.select('journal_entries',`select=*&workspace_id=eq.${wid}&order=entry_date.desc,journal_no.desc.nullslast,created_at.desc`),
      C.select('journal_lines',`select=*&workspace_id=eq.${wid}&order=line_no.asc`),
      C.select('financial_accounts',`select=*&workspace_id=eq.${wid}&order=kind.asc,created_at.asc`),
      C.select('fiscal_periods',`select=*&workspace_id=eq.${wid}&order=date_from.desc`),
      C.select('financial_transactions',`select=*&workspace_id=eq.${wid}&order=tx_date.desc,created_at.desc&limit=100`),
      C.rpc('avan_workspace_health',{wid}),
      C.rpc('avan_core_integrity',{wid}),
      C.rpc('workspace_role',{wid})
    ]);
  }catch(e){
    if(String(e.message).includes('avan_core_integrity')||String(e.message).includes('workspace_role')||e.status===404)throw new Error('PATCH_B4_REQUIRED');
    throw e;
  }
  const [fy,accounts,roles,parties,entries,lines,financialAccounts,periods,transactions,health,integrity,workspaceRole]=result;
  ctx.fiscalYear=fy?.[0]||null;ctx.accounts=accounts||[];ctx.roles=Object.fromEntries((roles||[]).map(r=>[r.role_key,r.account_id]));
  ctx.parties=parties||[];ctx.entries=entries||[];ctx.lines=lines||[];ctx.financialAccounts=financialAccounts||[];ctx.periods=periods||[];ctx.transactions=transactions||[];
  ctx.health=health;ctx.integrity=integrity;ctx.workspaceRole=workspaceRole;

try{
  const d1=await Promise.all([
    C.select('invoices',`select=*&workspace_id=eq.${wid}&order=invoice_date.desc,invoice_no.desc.nullslast,created_at.desc`),
    C.select('invoice_lines',`select=*&workspace_id=eq.${wid}&order=line_no.asc`),
    C.rpc('invoice_integrity',{wid})
  ]);

  ctx.invoices=d1[0]||[];
  ctx.invoiceLines=d1[1]||[];
  ctx.invoiceIntegrity=d1[2]||{};
  ctx.documents =
  await C.select(
    'documents',
    `select=*&workspace_id=eq.${wid}&order=created_at.desc`
  ) || [];

}catch(e){
  throw new Error('PATCH_D1_REQUIRED');
}

if(!reportState.from&&ctx.fiscalYear){
  reportState.from=ctx.fiscalYear.date_from;
  reportState.to=today();
}
}
async function reloadAndRender(){await loadContext();await render()}
async function showApp(){
  Q('authShell').hidden=true;Q('appShell').hidden=false;Q('bottomNav').hidden=false;
  try{await reloadAndRender()}catch(e){
    if(e.message==='PATCH_B4_REQUIRED')
  page(`<div class="error-box"><b>Gate B-4 هنوز روی دیتابیس نصب نشده است.</b></div>`);
else if(e.message==='PATCH_D1_REQUIRED')
  page(`<div class="error-box"><b>ماژول فاکتور D1 روی دیتابیس در دسترس نیست.</b></div>`);
else
  showError(e,'showApp');
  }
}
function showAuth(){
  return uiShowAuth();
}

function setAuthMode(mode){
  Auth.setMode(mode);
  return uiSetAuthMode(mode);
}
bindAuthModeTabs(setAuthMode);
Q('authForm').onsubmit=async e=>{e.preventDefault();const email=Q('authEmail').value.trim(),password=Q('authPassword').value;Q('authSubmit').disabled=true;Q('authStatus').textContent='در حال ارتباط با Supabase…';try{if(Auth.getMode()==='login'){await Auth.login(email,password);Q('authStatus').textContent='ورود موفق';await showApp()}else{const r=await Auth.signup(email,password);if(r?.status==='authenticated'){Q('authStatus').textContent='حساب ساخته شد.';await showApp()}else{setAuthMode('login');Q('authStatus').innerHTML='<span class="success-box" style="display:block">ثبت‌نام انجام شد. در صورت فعال بودن تأیید ایمیل، ابتدا ایمیل را تأیید کنید.</span>'}}}catch(err){Q('authStatus').innerHTML=`<span class="error-box" style="display:block">${esc(errorMessageFa(err))}</span>`}finally{Q('authSubmit').disabled=false}};
Q('forgotPasswordBtn').onclick=async()=>{

  const email=Q('authEmail').value.trim();

  if(!email)
    return Q('authStatus').innerHTML=
      '<span class="error-box" style="display:block">ابتدا ایمیل خود را وارد کنید.</span>';

  Q('forgotPasswordBtn').disabled=true;

  try{

    await Auth.requestPasswordReset(
  email
);

    Q('authStatus').innerHTML=
      '<span class="success-box" style="display:block">اگر این ایمیل در آوان ثبت شده باشد، لینک بازیابی رمز ارسال می‌شود.</span>';

  }catch(err){

    Q('authStatus').innerHTML=
      `<span class="error-box" style="display:block">${esc(errorMessageFa(err))}</span>`;

  }finally{

    Q('forgotPasswordBtn').disabled=false;
  }
};


function passwordRecoveryModal(){

  openModal(`
    <h2>تنظیم رمز عبور جدید</h2>

    <p class="muted">
      رمز عبور جدید را وارد کنید.
    </p>

    <form id="recoveryForm">

      <div class="field">
        <label>رمز عبور جدید</label>
        <input
          id="newPassword"
          type="password"
          minlength="8"
          autocomplete="new-password"
          required
        >
      </div>

      <div class="field" style="margin-top:10px">
        <label>تکرار رمز عبور</label>
        <input
          id="newPassword2"
          type="password"
          minlength="8"
          autocomplete="new-password"
          required
        >
      </div>

      <div class="form-actions">
        <button class="primary">
          ذخیره رمز جدید
        </button>
      </div>

      <div id="recoveryStatus"></div>

    </form>
  `);

  Q('recoveryForm').onsubmit=async e=>{

    e.preventDefault();

    const p1=Q('newPassword').value;
    const p2=Q('newPassword2').value;

    if(p1!==p2)
      return Q('recoveryStatus').innerHTML=
        '<span class="error-box" style="display:block">دو رمز عبور یکسان نیستند.</span>';

    try{

await Auth.updatePassword(p1);
      
      Q('recoveryStatus').innerHTML=
        '<span class="success-box" style="display:block">رمز عبور با موفقیت تغییر کرد.</span>';

      setTimeout(
        async()=>{
          closeModal();
          await showApp();
        },
        500
      );

    }catch(err){

      Q('recoveryStatus').innerHTML=
        `<span class="error-box" style="display:block">${esc(errorMessageFa(err))}</span>`;
    }
  };
}
async function navigate(p){currentPage=p;setNav(p);closeModal();await render()}
async function render(){
  try{
    if(currentPage==='dashboard')await renderDashboard();
    else if(currentPage==='accounts')renderAccounts();
    else if(currentPage==='parties')renderParties();
    else if(currentPage==='invoices')renderInvoices();
    else if(currentPage==='journal')renderJournal();
    else if(currentPage==='documents')renderDocuments();
    else if(currentPage==='reports')await renderReports();
    else renderSettings();

    bind();
  }catch(e){
    page(`<div class="error-box">${esc(errorMessageFa(e))}</div>`);
    console.error(e);
  }
}
async function renderDashboard(){
  setTitle('داشبورد');

  page(
    '<div class="loading">در حال محاسبه از Ledger…</div>'
  );

  const wid =
    ctx.workspace.id;

  const from =
    ctx.fiscalYear.date_from;

  const to =
    today();

  const [
    bs,
    pnl,
    cash
  ] = await Promise.all([
    C.rpc(
      'report_balance_sheet',
      {
        wid,
        as_of: to
      }
    ),

    C.rpc(
      'report_profit_loss',
      {
        wid,
        dfrom: from,
        dto: to
      }
    ),

    C.rpc(
      'report_cash_bank_balances',
      {
        wid,
        as_of: to
      }
    )
  ]);

  const B =
    Object.fromEntries(
      (bs || []).map(
        x => [
          x.category,
          bi(x.amount)
        ]
      )
    );

  const P =
    Object.fromEntries(
      (pnl || []).map(
        x => [
          x.category,
          bi(x.amount)
        ]
      )
    );

  const assets =
    B.asset || 0n;

  const liab =
    B.liability || 0n;

  const equity =
    (B.equity || 0n) +
    (B.current_profit || 0n);

  const profit =
    (P.income || 0n) -
    (P.expense || 0n);

  const cashTotal =
    (cash || []).reduce(
      (sum, item) =>
        sum + bi(item.amount),
      0n
    );

  const recent =
    ctx.entries
      .filter(
        entry =>
          entry.status !== 'draft'
      )
      .slice(0, 6);

  dashboardAging =
  buildPartyAging({
    roles:
      ctx.roles,

    parties:
      ctx.parties,

    entries:
      ctx.entries,

    lines:
      ctx.lines,

    invoices:
      ctx.invoices,

    asOf:
      to
  });

  dashboardIntelligence =
  buildFinancialCopilotSnapshot({
    asOf:
      to,

    fiscalFrom:
      from,

    assets,

    liabilities:
      liab,

    profit,

    cash:
      cashTotal,

    aging:
      dashboardAging,

    accounts:
      ctx.accounts,

    entries:
      ctx.entries,

    lines:
      ctx.lines,

    documents:
      ctx.documents,

    invoices:
      ctx.invoices,

    integrity:
      ctx.integrity
  });

  const whyButton =
    (metric, amount) => `
      <button
        class="ghost small"
        data-why-number="${metric}"
        data-why-amount="${amount.toString()}"
      >
        چرا این عدد؟
      </button>
    `;

  page(`
    <div class="grid4">

      <div class="card">
        <div class="kpi-label">
          دارایی
        </div>

        <div class="kpi-value">
          ${money(assets)}
        </div>

        <div class="section">
          ${whyButton(
            'assets',
            assets
          )}
        </div>
      </div>

      <div class="card">
        <div class="kpi-label">
          بانک و صندوق
        </div>

        <div class="kpi-value">
          ${money(cashTotal)}
        </div>

        <div class="section">
          ${whyButton(
            'cash',
            cashTotal
          )}
        </div>
      </div>

      <div class="card">
        <div class="kpi-label">
          بدهی
        </div>

        <div class="kpi-value">
          ${money(liab)}
        </div>

        <div class="section">
          ${whyButton(
            'liabilities',
            liab
          )}
        </div>
      </div>

      <div class="card">
        <div class="kpi-label">
          سود/زیان سال
        </div>

        <div
          class="kpi-value ${
            profit >= 0n
              ? 'pos'
              : 'neg'
          }"
        >
          ${money(profit)}
        </div>

        <div class="section">
          ${whyButton(
            'profit',
            profit
          )}
        </div>
      </div>

       </div>
${
  financialCopilotSectionHtml(
    dashboardIntelligence,
    {
      money,
      esc,
      dateFa
    }
  )
}
    ${
      partyAgingSection(
        dashboardAging,
        {
          money,
          dateFa,
          esc
        }
      )
    }

    <div class="section card">

      <div class="section-head">

        <div>
          <h2>
            آخرین اسناد
          </h2>

          <span class="muted">
            حقوق مالکانه + سود جاری:
            ${money(equity)}
          </span>
        </div>

        <span class="cloud-badge">
          ● Ledger زنده
        </span>

      </div>

      ${
        recent.length
          ?`
            <table>
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>تاریخ</th>
                  <th>شرح</th>
                  <th>منبع</th>
                  <th>وضعیت</th>
                </tr>
              </thead>

              <tbody>
                ${
                  recent.map(
                    entry => `
                      <tr>
                        <td>
                          ${
                            entry.journal_no ??
                            '—'
                          }
                        </td>

                        <td>
                          ${
                            dateFa(
                              entry.entry_date
                            )
                          }
                        </td>

                        <td>
                          ${
                            esc(
                              entry.description
                            )
                          }
                        </td>

                        <td>
                          ${
                            esc(
                              entry.source_type
                            )
                          }
                        </td>

                        <td>
                          <span
                            class="badge ${entry.status}"
                          >
                            ${
                              statusFa[
                                entry.status
                              ] ||
                              esc(
                                entry.status
                              )
                            }
                          </span>
                        </td>
                      </tr>
                    `
                  ).join('')
                }
              </tbody>
            </table>
          `
          :`
            <div class="empty">
              هنوز سندی ثبت نشده است.
            </div>
          `
      }

    </div>
  `);
}

function agingDetailModal(
  sideName,
  partyId
) {
  if (!dashboardAging) {
    return toast(
      'اطلاعات Aging هنوز آماده نیست'
    );
  }

  openModal(
    partyAgingDetailHtml({
      aging:
        dashboardAging,

      sideName,
      partyId,

      money,
      dateFa,
      esc
    })
  );

  if (Q('cancelModal')) {
    Q('cancelModal').onclick =
      closeModal;
  }

  document
    .querySelectorAll(
      '[data-aging-journal]'
    )
    .forEach(
      button =>
        button.onclick = () =>
          viewJournal(
            button.dataset
              .agingJournal
          )
    );
}
  
function whyNumberModal(
  metric,
  amount,
  fromOverride = null,
  toOverride = null
) {
  const from =
    fromOverride ||
    ctx.fiscalYear?.date_from ||
    null;

  const to =
    toOverride ||
    today();

  let evidence;

  try {
    evidence =
      buildWhyNumberEvidence({
        metric,
        accounts:
          ctx.accounts,

        financialAccounts:
          ctx.financialAccounts,

        entries:
          ctx.entries,

        lines:
          ctx.lines,

        from,
        to
      });
  } catch (error) {
    return showError(
      error,
      'whyNumberModal'
    );
  }

  const scopeText =
    evidence.scope === 'range'
      ?`${dateFa(from)} تا ${dateFa(to)}`
      :`تا ${dateFa(to)}`;

  const accountRows =
    evidence.accounts
      .slice(0, 12)
      .map(
        account => `
          <tr>
            <td>
              ${
                esc(
                  account.code || ''
                )
              }
            </td>

            <td>
              ${
                esc(
                  account.name || ''
                )
              }
            </td>

            <td>
              ${
                esc(
                  catFa[
                    account.category
                  ] ||
                  account.category ||
                  '—'
                )
              }
            </td>
          </tr>
        `
      )
      .join('');

  const journalRows =
    evidence.journals
      .slice(0, 12)
      .map(
        entry => `
          <tr>
            <td>
              ${
                entry.journal_no ??
                '—'
              }
            </td>

            <td>
              ${
                dateFa(
                  entry.entry_date
                )
              }
            </td>

            <td>
              ${
                esc(
                  entry.description ||
                  ''
                )
              }
            </td>

            <td>
              <button
                class="ghost small"
                data-why-journal="${entry.id}"
              >
                مشاهده سند
              </button>
            </td>
          </tr>
        `
      )
      .join('');

  openModal(`
    <div class="section-head">

      <div>
        <h2>
          چرا این عدد؟ —
          ${esc(evidence.title)}
        </h2>

        <span class="muted">
          مسیر ردیابی عدد از گزارش معتبر تا Ledger
        </span>
      </div>

      <span class="cloud-badge">
        Ledger Evidence
      </span>

    </div>

    <div class="grid4">

      <div class="card">
        <div class="kpi-label">
          عدد گزارش
        </div>

        <div class="kpi-value small-kpi">
          ${money(amount)}
        </div>
      </div>

      <div class="card">
        <div class="kpi-label">
          منبع محاسبه
        </div>

        <div class="kpi-value small-kpi">
          ${esc(
            evidence.sourceReport
          )}
        </div>
      </div>

      <div class="card">
        <div class="kpi-label">
          حساب‌های مرتبط
        </div>

        <div class="kpi-value small-kpi">
          ${evidence.accountCount}
        </div>
      </div>

      <div class="card">
        <div class="kpi-label">
          شواهد Ledger
        </div>

        <div class="kpi-value small-kpi">
          ${evidence.lineCount}
          ردیف /
          ${evidence.journalCount}
          سند
        </div>
      </div>

    </div>

    <div class="info-box">
      عدد اصلی مستقیماً از RPC گزارش محاسبه می‌شود؛
      این پنجره آن را دوباره در مرورگر محاسبه نمی‌کند.

      <br><br>

      مسیر داده:

      <b>
        Dashboard
        →
        ${esc(
          evidence.sourceReport
        )}
        →
        Accounts
        →
        Journal Lines
        →
        Journal
      </b>

      <br><br>

      بازه:
      ${scopeText}
    </div>

    <div class="section">
      <h3>
        حساب‌های مرتبط
      </h3>

      ${
        accountRows
          ?`
            <table>
              <thead>
                <tr>
                  <th>کد</th>
                  <th>حساب</th>
                  <th>گروه</th>
                </tr>
              </thead>

              <tbody>
                ${accountRows}
              </tbody>
            </table>
          `
          :`
            <div class="empty">
              حساب مرتبطی پیدا نشد.
            </div>
          `
      }
    </div>

    <div class="section">
      <h3>
        آخرین اسناد مؤثر
      </h3>

      ${
        journalRows
          ?`
            <table>
              <thead>
                <tr>
                  <th>سند</th>
                  <th>تاریخ</th>
                  <th>شرح</th>
                  <th>Drill-down</th>
                </tr>
              </thead>

              <tbody>
                ${journalRows}
              </tbody>
            </table>
          `
          :`
            <div class="empty">
              سند مرتبطی در این بازه پیدا نشد.
            </div>
          `
      }
    </div>

    <div class="form-actions">
      <button
        class="ghost"
        id="cancelModal"
      >
        بستن
      </button>
    </div>
  `);

  Q('cancelModal').onclick =
    closeModal;

  document
    .querySelectorAll(
      '[data-why-journal]'
    )
    .forEach(
      button =>
        button.onclick = () =>
          viewJournal(
            button.dataset
              .whyJournal
          )
    );
}

function renderAccounts(){
  setTitle('حساب‌ها');
  const rows=ctx.accounts.map(a=>`<tr class="${a.is_active?'':'account-archived'}"><td class="tree-indent-${a.level-1}">${esc(a.code)}</td><td>${esc(a.name)}${a.is_system?' <span class="badge">سیستمی</span>':''}</td><td>${levelFa[a.level]}</td><td>${catFa[a.category]}</td><td>${a.is_active?'فعال':'بایگانی'}</td><td><div class="row-actions">${!a.is_system?`<button class="ghost small" data-edit-account="${a.id}">ویرایش</button><button class="ghost small" data-archive-account="${a.id}">${a.is_active?'بایگانی':'فعال‌سازی'}</button><button class="danger small" data-delete-account="${a.id}">حذف</button>`:''}${a.is_postable&&a.is_active?`<button class="good-btn small" data-opening="${a.id}">افتتاحیه</button>`:''}</div></td></tr>`).join('');
  page(`<div class="section-head"><div><h2>درخت حساب‌ها</h2><span class="muted">کل / معین / تفصیلی — حساب دارای گردش حذف نمی‌شود.</span></div><button class="primary" id="addAccount">＋ حساب جدید</button></div><table><thead><tr><th>کد</th><th>نام</th><th>سطح</th><th>ماهیت</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${rows}</tbody></table>`);
}
function accountModal(id=null){
  const a=id?acct(id):null;
  const parents=ctx.accounts.filter(
    x=>x.is_active&&x.level<3&&(!a||x.id!==a.id)
  );

  openModal(`
    <h2>${a?'ویرایش حساب':'حساب جدید'}</h2>

    <form id="accountForm">
      <div class="form-grid">

        <div class="field">
          <label>کد</label>
          <input
            value="${a?esc(a.code):'خودکار'}"
            disabled
          >
          <small>
            ${a
              ?'کد حساب قابل تغییر نیست.'
              :'کد حساب پس از ذخیره به‌صورت خودکار تعیین می‌شود.'}
          </small>
        </div>

        <div class="field">
          <label>نام</label>
          <input
            name="name"
            value="${esc(a?.name||'')}"
            required
          >
        </div>

        ${!a?`
          <div class="field">
            <label>حساب والد</label>
            <select name="parent_id" id="accountParent" required>
              <option value="">انتخاب حساب والد…</option>
              ${parents.map(p=>`
                <option value="${p.id}">
                  ${esc(p.code)} — ${esc(p.name)} (${levelFa[p.level]})
                </option>
              `).join('')}
            </select>
          </div>

          <div class="field">
            <label>گروه حساب کل</label>
            <input
              id="accountCategoryPreview"
              value="پس از انتخاب حساب والد"
              disabled
            >
            <small>
              گروه حساب به‌صورت خودکار از حساب والد تعیین می‌شود.
            </small>
          </div>
        `:''}

      </div>

      <div class="form-actions">
        <button type="button" class="ghost" id="cancelModal">
          انصراف
        </button>
        <button class="primary">
          ذخیره
        </button>
      </div>
    </form>
  `);

  Q('cancelModal').onclick=closeModal;

  if(!a){
    Q('accountParent').onchange=()=>{
      const p=acct(Q('accountParent').value);

      Q('accountCategoryPreview').value=
        p
          ? `${catFa[p.category]} — از حساب والد`
          : 'پس از انتخاب حساب والد';
    };
  }

  Q('accountForm').onsubmit=async e=>{
    e.preventDefault();

    const f=new FormData(e.target);
    const name=f.get('name').trim();

    if(!name)
      return toast('نام حساب الزامی است');

    try{

      if(a){

        await C.update(
          'accounts',
          {
            name:name
          },
          `id=eq.${a.id}&workspace_id=eq.${ctx.workspace.id}`
        );

      }else{

        const pid=f.get('parent_id');

        if(!pid)
          return toast('حساب والد را انتخاب کنید');

        const p=acct(pid);

        if(!p)
          return toast('حساب والد معتبر نیست');

        await C.insert(
          'accounts',
          {
            workspace_id:ctx.workspace.id,
            parent_id:pid,
            name:name,
            is_system:false
          }
        );
      }

      closeModal();
      await reloadAndRender();
      toast('حساب ذخیره شد');

    }catch(err){
      showError(err);
    }
  };
}
 async function toggleArchive(id){const a=acct(id),wasActive=a.is_active;await C.update('accounts',{is_active:!wasActive},`id=eq.${id}&workspace_id=eq.${ctx.workspace.id}`);await reloadAndRender();toast(wasActive?'حساب بایگانی شد':'حساب فعال شد')}
async function deleteAccount(id){if(!confirm('این حساب حذف شود؟ حساب دارای گردش یا زیرحساب حذف نمی‌شود.'))return;try{await C.remove('accounts',`id=eq.${id}&workspace_id=eq.${ctx.workspace.id}`);await reloadAndRender();toast('حساب حذف شد')}catch(e){showError(e)}}
function openingModal(id){
  const a=acct(id);openModal(`<h2>مانده افتتاحیه — ${esc(a.name)}</h2><form id="openingForm"><div class="form-grid"><div class="field"><label>تاریخ</label><input type="date" name="date" value="${ctx.fiscalYear.date_from}" required><small>جلالی: ${dateFa(ctx.fiscalYear.date_from)}</small></div><div class="field"><label>مبلغ</label><input name="amount" inputmode="numeric" required></div></div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">ثبت قطعی</button></div></form>`);
  Q('cancelModal').onclick=closeModal;Q('openingForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),amt=cleanAmount(f.get('amount'));if(bi(amt)<=0n)return toast('مبلغ معتبر وارد کنید');try{await C.rpc('post_financial_operation',{p_workspace_id:ctx.workspace.id,p_fiscal_year_id:ctx.fiscalYear.id,p_tx_date:f.get('date'),p_tx_type:'opening_balance',p_amount:amt,p_primary_account_id:a.id,p_counterpart_account_id:null,p_party_id:null,p_description:`مانده افتتاحیه ${a.name}`});closeModal();await reloadAndRender();toast('مانده افتتاحیه ثبت شد')}catch(err){showError(err)}};
}

function renderParties(){
  setTitle('طرف‌حساب‌ها');page(`<div class="section-head"><div><h2>اشخاص</h2><span class="muted">مشتری، فروشنده و سایر اشخاص</span></div><button class="primary" id="addParty">＋ طرف‌حساب</button></div>${ctx.parties.length?`<table><thead><tr><th>نام</th><th>نوع</th><th>تلفن</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${ctx.parties.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.kind)}</td><td>${esc(p.phone||'—')}</td><td>${p.is_active?'فعال':'بایگانی'}</td><td><button class="ghost small" data-edit-party="${p.id}">ویرایش</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">طرف‌حساب ثبت نشده است.</div>'}`);
}
function partyModal(id=null){
  const p=id?ctx.parties.find(x=>x.id===id):null;openModal(`<h2>${p?'ویرایش طرف‌حساب':'طرف‌حساب جدید'}</h2><form id="partyForm"><div class="form-grid"><div class="field"><label>نام</label><input name="name" value="${esc(p?.name||'')}" required></div><div class="field"><label>نوع</label><select name="kind"><option value="customer">مشتری</option><option value="vendor">فروشنده</option><option value="both">هر دو</option><option value="other">سایر</option></select></div><div class="field"><label>تلفن</label><input name="phone" value="${esc(p?.phone||'')}"></div></div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">ذخیره</button></div></form>`);if(p)Q('partyForm').kind.value=p.kind;Q('cancelModal').onclick=closeModal;Q('partyForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),row={name:f.get('name').trim(),kind:f.get('kind'),phone:f.get('phone').trim()};try{p?await C.update('parties',row,`id=eq.${p.id}&workspace_id=eq.${ctx.workspace.id}`):await C.insert('parties',{workspace_id:ctx.workspace.id,...row});closeModal();await reloadAndRender();toast('طرف‌حساب ذخیره شد')}catch(err){showError(err)}};
}
const cleanQty=v=>
  faDigits(v)
    .trim()
    .replace(/٫/g,'.')
    .replace(/,/g,'.')
    .replace(/\s/g,'');

function qtyMilli(v){
  const s=cleanQty(v);

  if(!/^\d+(\.\d{1,3})?$/.test(s))
    return null;

  const [a,b='']=s.split('.');

  return (
    BigInt(a)*1000n+
    BigInt((b+'000').slice(0,3))
  );
}

function invoiceAmount(qty,price,discount){

  const q=qtyMilli(qty);
  const p=bi(price);
  const d=bi(discount);

  if(
    q===null||
    q<=0n||
    p<0n||
    d<0n
  )
    return null;

  const gross=(q*p+500n)/1000n;

  return d>gross
    ?null
    :gross-d;
}

function invoicePartyOptions(type,selected=''){

  const kinds=
    type==='sale'
      ?new Set(['customer','both'])
      :new Set(['vendor','both']);

  return (
    `<option value="">انتخاب طرف‌حساب…</option>`+
    ctx.parties
      .filter(
        p=>p.is_active&&kinds.has(p.kind)
      )
      .map(
        p=>`
          <option
            value="${p.id}"
            ${p.id===selected?'selected':''}
          >
            ${esc(p.name)}
          </option>
        `
      )
      .join('')
  );
}

function invoiceAccountOptions(type,selected=''){

  const fin=financialLedgerIds();
  const ar=role('receivable');
  const salesDiscount=role('sales_discount');

  const filter=a=>
    a.is_active&&
    a.is_postable&&
    (
      type==='sale'
        ?(
          a.category==='income'&&
          a.id!==salesDiscount
        )
        :(
          a.category==='expense'||
          (
            a.category==='asset'&&
            !fin.has(a.id)&&
            a.id!==ar
          )
        )
    );

  return (
    `<option value="">انتخاب حساب…</option>`+
    accountOptions(selected,filter)
  );
}

function invoiceLineRow(type,l={}){

  return `
    <div class="invoice-line" data-invoice-line>

      <div class="field">
        <label>شرح ردیف</label>
        <input
          name="description"
          value="${esc(l.description||'')}"
          placeholder="شرح خدمت/خرید"
        >
      </div>

      <div class="field">
        <label>حساب</label>
        <select name="account">
          ${invoiceAccountOptions(
            type,
            l.account_id||''
          )}
        </select>
      </div>

      <div class="field">
        <label>تعداد</label>
        <input
          name="quantity"
          inputmode="decimal"
          value="${esc(l.quantity||'1')}"
        >
      </div>

      <div class="field">
        <label>فی</label>
        <input
          name="unit_price"
          inputmode="numeric"
          value="${
            esc(
              l.unit_price&&
              String(l.unit_price)!=='0'
                ?l.unit_price
                :''
            )
          }"
        >
      </div>

      <div class="field">
        <label>تخفیف</label>
        <input
          name="discount"
          inputmode="numeric"
          value="${
            esc(
              l.discount&&
              String(l.discount)!=='0'
                ?l.discount
                :''
            )
          }"
        >
      </div>

      <div
        class="invoice-line-total"
        data-line-amount
      >
        ${money(l.line_total||0)}
      </div>

      <button
        type="button"
        class="danger small"
        data-remove-invoice-line
      >
        ×
      </button>

    </div>
  `;
}

function updateInvoiceTotals(){

  let total=0n;

  document
    .querySelectorAll('[data-invoice-line]')
    .forEach(r=>{

      const a=
        invoiceAmount(
          r.querySelector('[name=quantity]').value,
          cleanAmount(
            r.querySelector('[name=unit_price]').value
          )||'0',
          cleanAmount(
            r.querySelector('[name=discount]').value
          )||'0'
        );

      const el=
        r.querySelector('[data-line-amount]');

      if(a===null){

        el.textContent='نامعتبر';
        el.classList.add('neg');

      }else{

        el.textContent=money(a);
        el.classList.remove('neg');
        total+=a;
      }
    });

  if(Q('invoiceTotal'))
    Q('invoiceTotal').textContent=money(total);
}

function bindInvoiceLines(){

  document
    .querySelectorAll(
      '[data-remove-invoice-line]'
    )
    .forEach(b=>{

      b.onclick=()=>{

        b.closest(
          '[data-invoice-line]'
        ).remove();

        updateInvoiceTotals();
      };
    });

  document
    .querySelectorAll(
      '[data-invoice-line] input,[data-invoice-line] select'
    )
    .forEach(
      i=>i.oninput=updateInvoiceTotals
    );

  updateInvoiceTotals();
}

function renderInvoices(){

  setTitle('فاکتورها');

  const rows=
    ctx.invoices
      .filter(
        i=>
          invoiceFilter==='all'||
          i.invoice_type===invoiceFilter
      )
      .map(i=>`
        <tr>

          <td>
            ${i.invoice_no??'پیش‌نویس'}
          </td>

          <td>
            ${invoiceTypeFa[i.invoice_type]}
          </td>

          <td>
            ${dateFa(i.invoice_date)}
          </td>

          <td>
            ${esc(
              party(i.party_id)?.name||'—'
            )}
          </td>

          <td class="num">
            ${money(i.total_amount)}
          </td>

          <td>
            <span class="badge ${i.status}">
              ${
                statusFa[i.status]||
                esc(i.status)
              }
            </span>
          </td>

          <td>
            <div class="row-actions">

              <button
                class="ghost small"
                data-view-invoice="${i.id}"
              >
                مشاهده
              </button>
              ${
  i.status==='draft'
    ?`
      <button
        class="ghost small"
        data-edit-invoice="${i.id}"
      >
        ویرایش
      </button>

      <button
        class="good-btn small"
        data-post-invoice="${i.id}"
      >
        ثبت قطعی
      </button>

      <button
        class="danger small"
        data-delete-invoice="${i.id}"
      >
        حذف
      </button>
    `
    :i.status==='posted'
      ?`
        <button
          class="danger small"
          data-reverse-invoice="${i.id}"
        >
          برگشت فاکتور
        </button>
      `
      :''
}
            </div>
          </td>

        </tr>
      `)
      .join('');

  page(`
    <div class="section-head">

      <div>
        <h2>فاکتور فروش و خرید</h2>
        <span class="muted">
          ثبت قطعی فاکتور مستقیماً سند دوبل روی Ledger می‌سازد.
        </span>
      </div>

      <div class="row-actions">

        <button
          class="good-btn"
          id="newSaleInvoice"
        >
          ＋ فروش
        </button>

        <button
          class="primary"
          id="newPurchaseInvoice"
        >
          ＋ خرید
        </button>

      </div>
    </div>

    <div class="tabs">

      <button
        data-invoice-filter="all"
        class="${invoiceFilter==='all'?'active':''}"
      >
        همه
      </button>

      <button
        data-invoice-filter="sale"
        class="${invoiceFilter==='sale'?'active':''}"
      >
        فروش
      </button>

      <button
        data-invoice-filter="purchase"
        class="${invoiceFilter==='purchase'?'active':''}"
      >
        خرید
      </button>

    </div>

    ${
      rows
        ?`
          <table>
            <thead>
              <tr>
                <th>شماره</th>
                <th>نوع</th>
                <th>تاریخ</th>
                <th>طرف‌حساب</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th>اقدام</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>
          </table>
        `
        :`
          <div class="empty">
            فاکتوری در این بخش وجود ندارد.
          </div>
        `
    }
  `);
}

function invoiceModal(
  type,
  id = null,
  prefill = null
){

  const inv=
    id
      ?invoice(id)
      :null;

  if(
    inv&&
    inv.status!=='draft'
  )
    return toast(
      'فقط فاکتور پیش‌نویس قابل ویرایش است'
    );

  type=
    inv?.invoice_type||
    type;

  const ls=
  inv
    ?ctx.invoiceLines.filter(
      l=>l.invoice_id===inv.id
    )
    :(
      prefill?.lines?.length
        ?prefill.lines
        :[]
    );

  openModal(`
    <h2>
      ${inv?'ویرایش':'فاکتور'}
      ${invoiceTypeFa[type]}
    </h2>

    <div class="info-box">
      این مرحله برای فاکتورهای غیرانبار/خدمات است.
      مالیات و موجودی در D1 ثبت نمی‌شوند.
    </div>

    <form id="invoiceForm">

      <div class="form-grid">

        <div class="field">
          <label>تاریخ</label>
          <input
            type="date"
            name="date"
            value="${
  inv?.invoice_date ||
  prefill?.date ||
  today()
}"
            required
          >
        </div>

        <div class="field">
          <label>سررسید</label>
          <input
            type="date"
            name="due"
            value="${inv?.due_date||''}"
          >
        </div>

        <div class="field">
          <label>طرف‌حساب</label>
          <select
            name="party"
            required
          >
            ${
              invoicePartyOptions(
  type,
  inv?.party_id ||
  prefill?.partyId ||
  ''
)
            }
          </select>
        </div>

        <div class="field">
          <label>شرح کلی</label>
          <input
            name="description"
            value="${
              esc(
                inv?.description ||
prefill?.description ||
`فاکتور ${invoiceTypeFa[type]}`
              )
            }"
          >
        </div>

      </div>

      <div
        class="invoice-lines"
        id="invoiceLines"
      >
        ${
          (
            ls.length
              ?ls
              :[{}]
          )
          .map(
            l=>invoiceLineRow(type,l)
          )
          .join('')
        }
      </div>

      <div class="invoice-grand-total">
        جمع فاکتور:
        <b id="invoiceTotal">
          ${money(inv?.total_amount||0)}
        </b>
      </div>

      <div class="form-actions">

        <button
          type="button"
          class="ghost"
          id="addInvoiceLine"
        >
          ＋ ردیف
        </button>

        <button
          type="button"
          class="ghost"
          id="cancelModal"
        >
          انصراف
        </button>

        <button
          class="ghost"
          data-invoice-save="draft"
        >
          ذخیره پیش‌نویس
        </button>

        <button
          class="primary"
          data-invoice-save="post"
        >
          ذخیره و ثبت قطعی
        </button>

      </div>

    </form>
  `);

  Q('cancelModal').onclick=
    closeModal;

  Q('addInvoiceLine').onclick=()=>{

    Q('invoiceLines')
      .insertAdjacentHTML(
        'beforeend',
        invoiceLineRow(type)
      );

    bindInvoiceLines();
  };

  bindInvoiceLines();

  Q('invoiceForm').onsubmit=
    async ev=>{

      ev.preventDefault();

      const mode=
        ev.submitter?.dataset.invoiceSave||
        'draft';

      const f=
        new FormData(ev.target);

      const rows=[];

      for(
        const r of
        document.querySelectorAll(
          '[data-invoice-line]'
        )
      ){

        const aid=
          r.querySelector(
            '[name=account]'
          ).value;

        const desc=
          r.querySelector(
            '[name=description]'
          ).value.trim();

        const qty=
          cleanQty(
            r.querySelector(
              '[name=quantity]'
            ).value||'1'
          );

        const price=
          cleanAmount(
            r.querySelector(
              '[name=unit_price]'
            ).value
          );

        const disc=
          cleanAmount(
            r.querySelector(
              '[name=discount]'
            ).value
          )||'0';

        const isBlank=
          !aid&&
          !desc&&
          !price;

        if(isBlank)
          continue;

        if(!aid)
          return toast(
            'حساب ردیف را انتخاب کنید'
          );

        if(
          qtyMilli(qty)===null||
          qtyMilli(qty)<=0n
        )
          return toast(
            'تعداد ردیف معتبر نیست'
          );

        if(bi(price)<=0n)
          return toast(
            'فی باید بیشتر از صفر باشد'
          );

        if(
          invoiceAmount(
            qty,
            price,
            disc
          )===null||
          invoiceAmount(
            qty,
            price,
            disc
          )<=0n
        )
          return toast(
            'مبلغ/تخفیف ردیف معتبر نیست'
          );

        rows.push({
          account_id:aid,
          description:desc,
          quantity:qty,
          unit_price:price,
          discount:disc
        });
      }

      if(
        mode==='post'&&
        !rows.length
      )
        return toast(
          'برای ثبت قطعی حداقل یک ردیف لازم است'
        );

      try{

        const iid=
          await C.rpc(
            'save_draft_invoice',
            {
              p_workspace_id:
                ctx.workspace.id,

              p_fiscal_year_id:
                ctx.fiscalYear.id,

              p_invoice_id:
                inv?.id||null,

              p_invoice_type:
                type,

              p_invoice_date:
                f.get('date'),

              p_due_date:
                f.get('due')||null,

              p_party_id:
                f.get('party'),

              p_description:
                f.get('description'),

              p_lines:
                rows
            }
          );

if (
  prefill?.sourceDocumentId
) {
  const sourceDocument =
    ctx.documents.find(
      document =>
        document.id ===
        prefill.sourceDocumentId
    );

  if (sourceDocument) {
    await Documents
      .saveAccountingDraftRef({
        document:
          sourceDocument,

        entityType:
          'invoice',

        entityId:
          iid,

        userId:
          ctx.user.id
      });
  }
}
        
        if(mode==='post')
          await C.rpc(
            'post_invoice',
            {iid}
          );

        closeModal();

        await reloadAndRender();

        toast(
          mode==='post'
            ?'فاکتور ثبت قطعی و سند حسابداری ایجاد شد'
            :'پیش‌نویس فاکتور ذخیره شد'
        );

      }catch(err){
        showError(err);
      }
    };
}

function viewInvoice(id){

  const inv=invoice(id);

  const ls=
    ctx.invoiceLines.filter(
      l=>l.invoice_id===id
    );

  openModal(`
    <div class="section-head">

      <div>
        <h2>
          فاکتور
          ${invoiceTypeFa[inv.invoice_type]}
          ${inv.invoice_no??'پیش‌نویس'}
        </h2>

        <span class="muted">
          ${dateFa(inv.invoice_date)}
          —
          ${esc(party(inv.party_id)?.name||'—')}
        </span>
      </div>

      <span class="badge ${inv.status}">
        ${statusFa[inv.status]}
      </span>

    </div>

    <table>

      <thead>
        <tr>
          <th>شرح</th>
          <th>حساب</th>
          <th>تعداد</th>
          <th>فی</th>
          <th>تخفیف</th>
          <th>جمع</th>
        </tr>
      </thead>

      <tbody>

        ${
          ls.map(l=>`
            <tr>

              <td>
                ${esc(l.description||'—')}
              </td>

              <td>
                ${esc(
                  acct(l.account_id)?.name||'—'
                )}
              </td>

              <td>
                ${esc(l.quantity)}
              </td>

              <td class="num">
                ${money(l.unit_price)}
              </td>

              <td class="num">
                ${money(l.discount)}
              </td>

              <td class="num">
                ${money(l.line_total)}
              </td>

            </tr>
          `).join('')
        }

      </tbody>

    </table>

    <div class="invoice-grand-total">
      جمع:
      <b>
        ${money(inv.total_amount)}
      </b>
    </div>

    <div class="form-actions">
      <button
        class="ghost"
        id="cancelModal"
      >
        بستن
      </button>
    </div>
  `);

  Q('cancelModal').onclick=
    closeModal;
}
function reverseInvoiceModal(id){

  const inv=invoice(id);

  if(!inv)
    return toast('فاکتور پیدا نشد');

  if(inv.status!=='posted')
    return toast('فقط فاکتور ثبت‌شده قابل برگشت است');

  if(!inv.journal_entry_id)
    return toast('سند حسابداری فاکتور پیدا نشد');

  openModal(`
    <h2>
      برگشت فاکتور
      ${invoiceTypeFa[inv.invoice_type]}
      ${inv.invoice_no??''}
    </h2>

    <div class="info-box">
      با برگشت فاکتور، سند حسابداری اصلی حذف نمی‌شود؛
      یک سند معکوس جدید ثبت می‌شود و وضعیت فاکتور نیز
      به «برگشتی» تغییر می‌کند.
    </div>

    <form id="reverseInvoiceForm">

      <div class="form-grid">

        <div class="field">
          <label>تاریخ برگشت</label>
          <input
            type="date"
            name="date"
            value="${today()}"
            required
          >
        </div>

        <div class="field">
          <label>علت برگشت</label>
          <input
            name="reason"
            value="برگشت فاکتور ${inv.invoice_no??''}"
            required
          >
        </div>

      </div>

      <div class="form-actions">

        <button
          type="button"
          class="ghost"
          id="cancelModal"
        >
          انصراف
        </button>

        <button
          class="danger"
        >
          ثبت برگشت فاکتور
        </button>

      </div>

    </form>
  `);

  Q('cancelModal').onclick=closeModal;

  Q('reverseInvoiceForm').onsubmit=
    async ev=>{

      ev.preventDefault();

      const f=
        new FormData(ev.target);

      try{

        await C.rpc(
          'reverse_journal_entry',
          {
            jid:inv.journal_entry_id,
            reverse_date:f.get('date'),
            reason:f.get('reason')
          }
        );

        closeModal();

        await reloadAndRender();

        toast('فاکتور برگشت داده شد');

      }catch(err){
        showError(err);
      }
    };
}  
function renderJournal(){
  setTitle('اسناد حسابداری');
  const rows=ctx.entries.map(e=>`<tr><td>${e.journal_no??'پیش‌نویس'}</td><td>${dateFa(e.entry_date)}</td><td>${esc(e.description)}</td><td>${esc(e.source_type)}</td><td><span class="badge ${e.status}">${statusFa[e.status]||esc(e.status)}</span></td><td><div class="row-actions"><button class="ghost small" data-view-journal="${e.id}">مشاهده</button>${e.status==='draft'?`<button class="ghost small" data-edit-journal="${e.id}">ویرایش</button><button class="good-btn small" data-post-journal="${e.id}">ثبت قطعی</button><button class="danger small" data-delete-journal="${e.id}">حذف</button>`:e.status==='posted'?`<button class="danger small" data-reverse-journal="${e.id}">برگشت سند</button>`:''}</div></td></tr>`).join('');
  page(`<div class="section-head"><div><h2>چرخه اسناد</h2><span class="muted">Draft → Posted → Reversed؛ سند Posted و خطوط آن Immutable هستند.</span></div><button class="primary" id="addJournal">＋ سند دستی</button></div>${rows?`<table><thead><tr><th>شماره</th><th>تاریخ</th><th>شرح</th><th>منبع</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="empty">هنوز سندی وجود ندارد.</div>'}`);
}
function lineRow(l={}){return `<div class="journal-line" data-line-row><div class="field"><label>حساب</label><select name="account"><option value="">انتخاب حساب…</option>${accountOptions(l.account_id||'',a=>a.is_active&&a.is_postable)}</select></div><div class="field"><label>طرف‌حساب</label><select name="party">${partyOptions(l.party_id||'')}</select></div><div class="field"><label>بدهکار</label><input name="debit" inputmode="numeric" value="${esc(l.debit&&String(l.debit)!=='0'?l.debit:'')}"></div><div class="field"><label>بستانکار</label><input name="credit" inputmode="numeric" value="${esc(l.credit&&String(l.credit)!=='0'?l.credit:'')}"></div><button type="button" class="danger small" data-remove-line>×</button></div>`}
function bindLines(){document.querySelectorAll('[data-remove-line]').forEach(b=>b.onclick=()=>{b.closest('[data-line-row]').remove();updateLineTotals()});document.querySelectorAll('[data-line-row] input,[data-line-row] select').forEach(i=>i.oninput=updateLineTotals);updateLineTotals()}
function updateLineTotals(){const rows=[...document.querySelectorAll('[data-line-row]')],d=rows.reduce((s,r)=>s+bi(r.querySelector('[name=debit]').value),0n),c=rows.reduce((s,r)=>s+bi(r.querySelector('[name=credit]').value),0n),complete=rows.filter(r=>r.querySelector('[name=account]').value&&(bi(r.querySelector('[name=debit]').value)>0n||bi(r.querySelector('[name=credit]').value)>0n)).length;Q('lineTotals').innerHTML=`جمع بدهکار: <b>${money(d)}</b> | جمع بستانکار: <b>${money(c)}</b> | ${d>0n&&d===c&&complete>=2?'<span class="pos">آماده ثبت قطعی</span>':'<span class="warn">پیش‌نویس — هنوز آماده Post نیست</span>'}`}
function journalModal(
  id = null,
  prefill = null
){
  const e=id?ctx.entries.find(x=>x.id===id):null;if(e&&e.status!=='draft')return toast('فقط پیش‌نویس قابل ویرایش است');const ls=
  e
    ?ctx.lines.filter(
      l =>
        l.journal_entry_id ===
        e.id
    )
    :(
      prefill?.lines ||
      []
    );
  openModal(`<h2>${e?'ویرایش پیش‌نویس':'سند دستی جدید'}</h2><div class="info-box">پیش‌نویس لازم نیست متوازن باشد. تراز بودن، حداقل دو ردیف و اعتبار حساب‌ها هنگام «ثبت قطعی» کنترل می‌شود.</div><form id="journalForm"><div class="form-grid"><div class="field"><label>تاریخ</label><input type="date" name="date" value="${
  e?.entry_date ||
  prefill?.date ||
  today()
}" required></div><div class="field"><label>شرح سند</label><input name="description" value="${
  esc(
    e?.description ||
    prefill?.description ||
    'سند دستی'
  )
}" required></div></div><div class="journal-lines" id="journalLines">${(ls.length?ls:[{},{}]).map(lineRow).join('')}</div><div class="line-total" id="lineTotals"></div><div class="form-actions"><button type="button" class="ghost" id="addLine">＋ ردیف</button><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">ذخیره پیش‌نویس</button></div></form>`);
  Q('addLine').onclick=()=>{Q('journalLines').insertAdjacentHTML('beforeend',lineRow());bindLines()};Q('cancelModal').onclick=closeModal;bindLines();
  Q('journalForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),rawRows=[...document.querySelectorAll('[data-line-row]')].map(r=>({account_id:r.querySelector('[name=account]').value,party_id:r.querySelector('[name=party]').value||null,debit:cleanAmount(r.querySelector('[name=debit]').value)||'0',credit:cleanAmount(r.querySelector('[name=credit]').value)||'0'}));for(const r of rawRows){const d=bi(r.debit),c=bi(r.credit);if((d>0n||c>0n)&&!r.account_id)return toast('برای ردیفی که مبلغ دارد، حساب را انتخاب کنید');if(d>0n&&c>0n)return toast('هر ردیف فقط می‌تواند بدهکار یا بستانکار باشد، نه هر دو');}const rows=rawRows.filter(r=>r.account_id&&(bi(r.debit)>0n||bi(r.credit)>0n));try{const jid =
  await C.rpc('save_draft_journal',{p_workspace_id:ctx.workspace.id,p_fiscal_year_id:ctx.fiscalYear.id,p_journal_id:e?.id||null,p_entry_date:f.get('date'),p_description:f.get('description'),p_lines:rows});closeModal();await reloadAndRender();const d=rows.reduce((s,x)=>s+bi(x.debit),0n),c=rows.reduce((s,x)=>s+bi(x.credit),0n);toast(rows.length>=2&&d>0n&&d===c?'پیش‌نویس متوازن ذخیره شد':'پیش‌نویس ذخیره شد؛ برای ثبت قطعی هنوز باید تکمیل و متوازن شود')}catch(err){showError(err)}};
}
function viewJournal(id){
  const e=ctx.entries.find(x=>x.id===id),ls=ctx.lines.filter(l=>l.journal_entry_id===id);openModal(`<div class="section-head"><div><h2>سند ${e.journal_no??'پیش‌نویس'}</h2><span class="muted">${dateFa(e.entry_date)} — ${esc(e.description)}</span></div><span class="badge ${e.status}">${statusFa[e.status]}</span></div><table><thead><tr><th>حساب</th><th>طرف‌حساب</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>${ls.map(l=>`<tr><td>${esc(acct(l.account_id)?.code||'')} — ${esc(acct(l.account_id)?.name||'')}</td><td>${esc(party(l.party_id)?.name||'—')}</td><td class="num">${money(l.debit)}</td><td class="num">${money(l.credit)}</td></tr>`).join('')}</tbody></table><div class="form-actions"><button class="ghost" id="cancelModal">بستن</button></div>`);Q('cancelModal').onclick=closeModal;
}
function reverseModal(id){
  const e=ctx.entries.find(x=>x.id===id);openModal(`<h2>برگشت سند ${e.journal_no}</h2><form id="reverseForm"><div class="form-grid"><div class="field"><label>تاریخ برگشت</label><input type="date" name="date" value="${today()}" required></div><div class="field"><label>علت</label><input name="reason" value="برگشت سند" required></div></div><div class="error-box">سند اصلی حذف یا ویرایش نمی‌شود؛ یک سند معکوس جدید Posted خواهد شد.</div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="danger">ثبت سند برگشتی</button></div></form>`);Q('cancelModal').onclick=closeModal;Q('reverseForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);try{await C.rpc('reverse_journal_entry',{jid:id,reverse_date:f.get('date'),reason:f.get('reason')});closeModal();await reloadAndRender();toast('سند برگشتی ثبت شد')}catch(err){showError(err)}};
}

function operationModal(kind){

  if(kind==='quick'){

  openModal(`
    <h2>ثبت سریع</h2>

    <div class="summary-strip">

      <button
        class="good-btn"
        data-op="receipt"
      >
        دریافت
      </button>

      <button
        class="danger"
        data-op="payment"
      >
        پرداخت
      </button>

      <button
        class="ghost"
        data-op="transfer"
      >
        انتقال
      </button>

      <button
        class="primary"
        data-op="journal"
      >
        سند دستی
      </button>

      <button
        class="good-btn"
        data-op="sale_invoice"
      >
        فاکتور فروش
      </button>

      <button
        class="primary"
        data-op="purchase_invoice"
      >
        فاکتور خرید
      </button>

      <button
        class="ghost"
        data-op="document"
      >
        آپلود سند
      </button>

    </div>
  `);

  document
    .querySelectorAll('[data-op]')
    .forEach(
      b=>b.onclick=async()=>{

        if(
          b.dataset.op==='journal'
        ){

          await navigate(
            'journal'
          );

          journalModal();

        }else if(
          b.dataset.op==='sale_invoice'||
          b.dataset.op==='purchase_invoice'
        ){

          await navigate(
            'invoices'
          );

          invoiceModal(
            b.dataset.op==='sale_invoice'
              ?'sale'
              :'purchase'
          );

        }else if(
          b.dataset.op==='document'
        ){

          await navigate(
            'documents'
          );

          documentUploadModal();

        }else{

          operationModal(
            b.dataset.op
          );
        }
      }
    );

  return;
}


  const fin=financialPostable();

  if(!fin.length)
    return toast(
      'حساب بانک/صندوق فعال پیدا نشد'
    );

  const title=
    kind==='receipt'
      ?'دریافت'
      :kind==='payment'
        ?'پرداخت'
        :'انتقال';

  const defCounter=
    kind==='receipt'
      ?role('default_income')
      :role('default_expense');

  const finIds=
    new Set(
      fin.map(a=>a.id)
    );

  openModal(`
    <h2>${title}</h2>

    <form id="opForm">

      <div class="form-grid">

        <div class="field">
          <label>تاریخ</label>

          <input
            type="date"
            name="date"
            value="${today()}"
            required
          >

          <small>
            جلالی: ${dateFa(today())}
          </small>
        </div>

        <div class="field">
          <label>مبلغ</label>

          <input
            name="amount"
            inputmode="numeric"
            required
          >
        </div>

        ${
          kind==='receipt'
            ?`
              <div class="field">
                <label>واریز به</label>

                <select name="primary">
                  ${
                    accountOptions(
                      role('bank'),
                      a=>finIds.has(a.id)
                    )
                  }
                </select>
              </div>

              <div class="field">
                <label>حساب مقابل</label>

                <select name="counter">
                  ${
                    accountOptions(
                      defCounter,
                      a=>a.is_active&&a.is_postable
                    )
                  }
                </select>
              </div>
            `
            :kind==='payment'
              ?`
                <div class="field">
                  <label>پرداخت از</label>

                  <select name="primary">
                    ${
                      accountOptions(
                        role('bank'),
                        a=>finIds.has(a.id)
                      )
                    }
                  </select>
                </div>

                <div class="field">
                  <label>حساب هزینه/مقابل</label>

                  <select name="counter">
                    ${
                      accountOptions(
                        defCounter,
                        a=>a.is_active&&a.is_postable
                      )
                    }
                  </select>
                </div>
              `
              :`
                <div class="field">
                  <label>از حساب</label>

                  <select name="primary">
                    ${
                      accountOptions(
                        role('bank'),
                        a=>finIds.has(a.id)
                      )
                    }
                  </select>
                </div>

                <div class="field">
                  <label>به حساب</label>

                  <select name="counter">
                    ${
                      accountOptions(
                        role('cash'),
                        a=>finIds.has(a.id)
                      )
                    }
                  </select>
                </div>
              `
        }

        <div class="field">
          <label>طرف‌حساب</label>

          <select name="party">
            ${partyOptions()}
          </select>
        </div>

        <div class="field">
          <label>شرح</label>

          <input
            name="description"
            value="${title}"
            required
          >
        </div>

      </div>

      <div class="form-actions">

        <button
          type="button"
          class="ghost"
          id="cancelModal"
        >
          انصراف
        </button>

        <button class="primary">
          ثبت قطعی
        </button>

      </div>

    </form>
  `);

  Q('cancelModal').onclick=
    closeModal;

  Q('opForm').onsubmit=
    async e=>{

      e.preventDefault();

      const f=
        new FormData(e.target);

      const amt=
        cleanAmount(
          f.get('amount')
        );

      const primary=
        f.get('primary');

      const counter=
        f.get('counter');

      if(bi(amt)<=0n)
        return toast(
          'مبلغ معتبر وارد کنید'
        );

      if(primary===counter)
        return toast(
          'حساب مبدأ و مقصد/مقابل باید متفاوت باشند'
        );

      try{

        await C.rpc(
          'post_financial_operation',
          {
            p_workspace_id:
              ctx.workspace.id,

            p_fiscal_year_id:
              ctx.fiscalYear.id,

            p_tx_date:
              f.get('date'),

            p_tx_type:
              kind,

            p_amount:
              amt,

            p_primary_account_id:
              primary,

            p_counterpart_account_id:
              counter,

            p_party_id:
              f.get('party')||null,

            p_description:
              f.get('description')
          }
        );

        if (
  prefill?.sourceDocumentId
) {
  const sourceDocument =
    ctx.documents.find(
      document =>
        document.id ===
        prefill.sourceDocumentId
    );

  if (sourceDocument) {
    await Documents
      .saveAccountingDraftRef({
        document:
          sourceDocument,

        entityType:
          'journal',

        entityId:
          jid,

        userId:
          ctx.user.id
      });
  }
}

        closeModal();

        await reloadAndRender();

        toast(
          `${title} ثبت شد`
        );

      }catch(err){

        showError(err);
      }
    };
}

async function
runNaturalReport(
  queryOverride = null
) {
  const input =
    Q('nlReportQuery');

  const query =
    String(
      queryOverride ??
      input?.value ??
      ''
    ).trim();

  reportState.nlQuery =
    query;

  const submit =
    Q('nlReportSubmit');

  if (submit) {
    submit.disabled =
      true;

    submit.textContent =
      'در حال محاسبه…';
  }

  try {

    const intent =
      parsePersianReportIntent({
        query,

        todayIso:
          today(),

        fiscalYearFrom:
          ctx.fiscalYear
            ?.date_from ||
          null,

        fiscalYearTo:
          ctx.fiscalYear
            ?.date_to ||
          null,

        accounts:
          ctx.accounts
      });

    const result =
      await executeReportIntent({
        intent,

        workspaceId:
          ctx.workspace.id,

        rpc:
          (
            name,
            params
          ) =>
            C.rpc(
              name,
              params
            ),

        agingContext: {
          roles:
            ctx.roles,

          parties:
            ctx.parties,

          entries:
            ctx.entries,

          lines:
            ctx.lines,

          invoices:
            ctx.invoices
        }
      });

    reportState.nlResult = {
      intent,
      result
    };

    await renderReports();

  } catch (err) {

    reportState.nlResult =
      null;

    showError(
      err,
      'naturalReport'
    );

  } finally {

    if (
      submit &&
      submit.isConnected
    ) {
      submit.disabled =
        false;

      submit.textContent =
        'اجرای گزارش';
    }
  }
}
  
function reportToolbar(){return `<div class="report-toolbar card"><div class="field"><label>از تاریخ</label><input id="reportFrom" type="date" value="${reportState.from}"><small>${dateFa(reportState.from)}</small></div><div class="field"><label>تا تاریخ</label><input id="reportTo" type="date" value="${reportState.to}"><small>${dateFa(reportState.to)}</small></div><button class="primary" id="applyReportRange">اعمال بازه</button></div>`}
async function renderReports(){
  setTitle('گزارش‌ها');const tab=reportState.tab,wid=ctx.workspace.id,from=reportState.from||ctx.fiscalYear.date_from,to=reportState.to||today();page('<div class="loading">در حال محاسبه گزارش از Ledger…</div>');
  let body='';
  if(tab==='trial'){
    const r=await C.rpc('report_trial_balance',{wid,dfrom:from,dto:to});let td=0n,tc=0n;const rows=r.filter(x=>acct(x.account_id)?.is_postable).map(x=>{td+=bi(x.debit_turnover);tc+=bi(x.credit_turnover);return `<tr><td>${esc(x.account_code)} — ${esc(x.account_name)}</td><td class="num">${money(x.debit_turnover)}</td><td class="num">${money(x.credit_turnover)}</td><td class="num">${money(x.net)}</td></tr>`}).join('');body=`<table><thead><tr><th>حساب</th><th>گردش بدهکار</th><th>گردش بستانکار</th><th>مانده خالص</th></tr></thead><tbody>${rows}</tbody></table><div class="summary-strip section"><span class="summary-pill">بدهکار ${money(td)}</span><span class="summary-pill">بستانکار ${money(tc)}</span><span class="summary-pill ${td===tc?'pos':'neg'}">${td===tc?'متوازن':'نامتوازن'}</span></div>`;
  }else if(tab==='journal'){
    const r=await C.rpc('report_journal',{wid,dfrom:from,dto:to});body=r.length?`<table><thead><tr><th>سند</th><th>تاریخ</th><th>حساب</th><th>شرح</th><th>طرف‌حساب</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.journal_no}</td><td>${dateFa(x.entry_date)}</td><td>${esc(x.account_code)} — ${esc(x.account_name)}</td><td>${esc(x.line_description||x.entry_description)}</td><td>${esc(x.party_name||'—')}</td><td class="num">${money(x.debit)}</td><td class="num">${money(x.credit)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">در این بازه سندی وجود ندارد.</div>';
  }else if(tab==='pnl'){
    const r=await C.rpc('report_profit_loss',{wid,dfrom:from,dto:to}),m=Object.fromEntries(r.map(x=>[x.category,bi(x.amount)])),profit=(m.income||0n)-(m.expense||0n);body=`<div class="grid4"><div class="card"><div class="kpi-label">درآمد</div><div class="kpi-value pos">${money(m.income||0)}</div></div><div class="card"><div class="kpi-label">هزینه</div><div class="kpi-value neg">${money(m.expense||0)}</div></div><div class="card"><div class="kpi-label">سود/زیان</div><div class="kpi-value ${profit>=0n?'pos':'neg'}">${money(profit)}</div></div></div>`;
  }else if(tab==='balance'){
    const r=await C.rpc('report_balance_sheet',{wid,as_of:to}),m=Object.fromEntries(r.map(x=>[x.category,bi(x.amount)])),rhs=(m.liability||0n)+(m.equity||0n)+(m.current_profit||0n),diff=(m.asset||0n)-rhs;body=`<div class="grid4"><div class="card"><div class="kpi-label">دارایی</div><div class="kpi-value">${money(m.asset||0)}</div></div><div class="card"><div class="kpi-label">بدهی</div><div class="kpi-value">${money(m.liability||0)}</div></div><div class="card"><div class="kpi-label">حقوق مالکانه + سود جاری</div><div class="kpi-value">${money((m.equity||0n)+(m.current_profit||0n))}</div></div><div class="card"><div class="kpi-label">اختلاف تراز</div><div class="kpi-value ${diff===0n?'pos':'neg'}">${money(diff)}</div></div></div>`;
  }else if(tab==='cash'){
    const r=await C.rpc('report_cash_bank_balances',{wid,as_of:to});body=r.length?`<table><thead><tr><th>نوع</th><th>حساب</th><th>مانده تا ${dateFa(to)}</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.kind==='bank'?'بانک':'صندوق'}</td><td>${esc(x.account_code)} — ${esc(x.account_name)}</td><td class="num">${money(x.amount)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">حساب نقد/بانکی وجود ندارد.</div>';
  }else if(tab==='ledger'){
    const selected=reportState.ledgerAccount||activePostable()[0]?.id||'';reportState.ledgerAccount=selected;body=`<div class="field ledger-select"><label>حساب تفصیلی</label><select id="ledgerAccount">${accountOptions(selected,a=>a.is_active&&a.is_postable)}</select></div><div class="section" id="ledgerBody"></div>`;
  }
  page(`
  ${naturalReportBoxHtml({
    query:
      reportState.nlQuery,
    esc
  })}

  ${naturalReportResultHtml({
    payload:
      reportState.nlResult,
    money,
    dateFa,
    esc
  })}

  ${reportToolbar()}

  <div class="tabs">
    <button
      data-report="journal"
      class="${tab==='journal'?'active':''}"
    >
      دفتر روزنامه
    </button>

    <button
      data-report="trial"
      class="${tab==='trial'?'active':''}"
    >
      تراز آزمایشی
    </button>

    <button
      data-report="ledger"
      class="${tab==='ledger'?'active':''}"
    >
      گردش حساب
    </button>

    <button
      data-report="pnl"
      class="${tab==='pnl'?'active':''}"
    >
      سود و زیان
    </button>

    <button
      data-report="balance"
      class="${tab==='balance'?'active':''}"
    >
      ترازنامه
    </button>

    <button
      data-report="cash"
      class="${tab==='cash'?'active':''}"
    >
      بانک/صندوق
    </button>
  </div>

  ${body}
`);
  if(tab==='ledger')await refreshLedger();bind();
}
async function refreshLedger(){const aid=Q('ledgerAccount')?.value;if(!aid)return;reportState.ledgerAccount=aid;const r=await C.rpc('report_account_statement',{wid:ctx.workspace.id,aid,dfrom:reportState.from,dto:reportState.to});Q('ledgerBody').innerHTML=r.length?`<table><thead><tr><th>سند</th><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.journal_no}</td><td>${dateFa(x.entry_date)}</td><td>${esc(x.description)}</td><td class="num">${money(x.debit)}</td><td class="num">${money(x.credit)}</td><td class="num">${money(x.running_net)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">گردشی وجود ندارد.</div>'}

function renderDocuments(){
  setTitle('اسناد هوشمند');

  page(
    documentsPageHtml({
      documents:
        ctx.documents,

      parties:
        ctx.parties,

      dateFa,
      money,
      esc
    })
  );
}

function documentUploadModal(){

  openModal(
    documentUploadModalHtml({
      parties:
        ctx.parties,

      esc
    })
  );

  Q('cancelModal').onclick =
    closeModal;

  Q('documentUploadForm')
    .onsubmit =
      async e => {

        e.preventDefault();

        const form =
          e.target;

        const data =
          new FormData(form);

        const file =
          form.elements.file
            .files?.[0];

        const submit =
          Q(
            'documentUploadSubmit'
          );

        const status =
          Q(
            'documentUploadStatus'
          );

        submit.disabled =
          true;

        status.textContent =
          'در حال آپلود امن سند…';

        try {

          await Documents.upload({
            workspaceId:
              ctx.workspace.id,

            userId:
              ctx.user.id,

            file,

            documentType:
              data.get(
                'documentType'
              ),

            partyId:
              data.get(
                'partyId'
              ) || null
          });

          closeModal();

          await loadContext();

          currentPage =
            'documents';

          await render();

          toast(
            'سند با موفقیت آپلود شد'
          );

        } catch (err) {

          status.innerHTML =
            `<span class="error-box" style="display:block">${
              esc(
                errorMessageFa(
                  err
                )
              )
            }</span>`;

        } finally {

          submit.disabled =
            false;
        }
      };
}

async function openDocument(
  documentId
) {
  const document =
    ctx.documents.find(
      item =>
        item.id ===
        documentId
    );

  if (!document) {
    return toast(
      'سند پیدا نشد'
    );
  }

  try {

    const url =
      await Documents.signedUrl(
        document,
        300
      );

    const a =
      window.document
        .createElement('a');

    a.href =
      url;

    a.target =
      '_blank';

    a.rel =
      'noopener noreferrer';

    window.document.body
      .appendChild(a);

    a.click();

    a.remove();

  } catch (err) {
    showError(
      err,
      'openDocument'
    );
  }
} 

async function extractDocument(
  documentId,
  button = null
) {
  const document =
    ctx.documents.find(
      item =>
        item.id ===
        documentId
    );

  if (!document) {
    return toast(
      'سند پیدا نشد'
    );
  }

  if (
    document.status !==
      'uploaded'
  ) {
    return toast(
      'این سند قابل استخراج نیست'
    );
  }

  if (button) {
    button.disabled =
      true;

    button.textContent =
      'در حال آماده‌سازی OCR…';
  }

  try {

    const sourceUrl =
      await Documents.signedUrl(
        document,
        900
      );

    const ocr =
      await recognizeLocalDocument({
        sourceUrl,

        mimeType:
          document.mime_type,

        onProgress:
          progress => {

            if (
              !button ||
              !button.isConnected
            ) {
              return;
            }

            if (
              progress?.message
            ) {
              button.textContent =
                progress.message;
            } else {
              button.textContent =
                'در حال OCR…';
            }
          }
      });

    const extraction =
      buildLocalOcrExtraction({
        document,
        ocr,

        parties:
          ctx.parties,

        accounts:
          ctx.accounts
      });

    await Documents
      .saveLocalExtraction({
        document,
        extraction
      });

    await loadContext();

    currentPage =
      'documents';

    await render();

    toast(
      'OCR محلی و استخراج اطلاعات انجام شد'
    );

    documentReviewModal(
      documentId
    );

  } catch (err) {

    try {
      await loadContext();

      currentPage =
        'documents';

      await render();
    } catch {
      // keep original OCR error
    }

    showError(
      err,
      'localDocumentExtract'
    );

  } finally {

    if (
      button &&
      button.isConnected
    ) {
      button.disabled =
        false;

      button.textContent =
        '✦ استخراج هوشمند';
    }
  }
}
  
function documentReviewModal(
  documentId
) {
  const document =
    ctx.documents.find(
      item =>
        item.id === documentId
    );

  if (!document) {
    return toast(
      'سند پیدا نشد'
    );
  }

  if (
    document.status === 'linked' ||
    document.linked_journal_entry_id
  ) {
    return toast(
      'سند متصل به Ledger قابل ویرایش نیست'
    );
  }

  const proposal =
    buildDocumentDraftProposal({
      document,

      extraction:
        document.extracted_data ||
        {},

      accounts:
        ctx.accounts,

      parties:
        ctx.parties
    });

  openModal(
    documentReviewModalHtml({
      document,
      proposal,

      parties:
        ctx.parties,

      accounts:
        ctx.accounts,

      dateFa,
      money,
      esc
    })
  );

  Q('cancelModal').onclick =
    closeModal;

  Q(
    'viewSourceDocumentBtn'
  ).onclick =
    () =>
      openDocument(
        document.id
      );

  Q(
    'documentReviewForm'
  ).onsubmit =
    async e => {

      e.preventDefault();

      const form =
        e.target;

      const data =
        new FormData(form);

      const submit =
        Q(
          'saveDocumentReviewBtn'
        );

      submit.disabled =
        true;

      try {

        await Documents.saveReview({
          document,

          userId:
            ctx.user.id,

          review: {
            action:
              data.get('action'),

            documentDate:
              data.get(
                'documentDate'
              ),

            documentNumber:
              data.get(
                'documentNumber'
              ),

            totalAmount:
              data.get(
                'totalAmount'
              ),

            taxAmount:
              data.get(
                'taxAmount'
              ),

            partyId:
              data.get(
                'partyId'
              ),

            accountId:
              data.get(
                'accountId'
              ),

            description:
              data.get(
                'description'
              )
          }
        });

        closeModal();

        await loadContext();

        currentPage =
          'documents';

        await render();

        toast(
          'بازبینی سند ذخیره شد'
        );

      } catch (err) {

        showError(
          err,
          'documentReview'
        );

      } finally {

        submit.disabled =
          false;
      }
    };
}


  function
documentAccountingDraft(
  documentId
) {
  const document =
    ctx.documents.find(
      item =>
        item.id ===
        documentId
    );

  if (!document) {
    return toast(
      'سند پیدا نشد'
    );
  }

  if (
    document.status !==
      'reviewed'
  ) {
    return toast(
      'ابتدا بازبینی سند را تأیید کنید'
    );
  }

  const extracted =
    (
      document.extracted_data &&
      typeof document
        .extracted_data ===
        'object'
    )
      ? document.extracted_data
      : {};

  const review =
    (
      extracted.review &&
      typeof extracted.review ===
        'object'
    )
      ? extracted.review
      : {};

  const draft =
    extracted.accounting_draft;

  if (
    draft?.entity_id
  ) {

    if (
      draft.entity_type ===
        'invoice'
    ) {
      const inv =
        ctx.invoices.find(
          item =>
            item.id ===
            draft.entity_id
        );

      if (!inv) {
        return toast(
          'پیش‌نویس فاکتور پیدا نشد'
        );
      }

      if (
        inv.status !==
          'draft'
      ) {
        return toast(
          'فاکتور ثبت قطعی شده؛ اکنون «اتصال به Ledger» را بزنید'
        );
      }

      return invoiceModal(
        inv.invoice_type,
        inv.id
      );
    }

    if (
      draft.entity_type ===
        'journal'
    ) {
      const entry =
        ctx.entries.find(
          item =>
            item.id ===
            draft.entity_id
        );

      if (!entry) {
        return toast(
          'پیش‌نویس سند حسابداری پیدا نشد'
        );
      }

      if (
        entry.status !==
          'draft'
      ) {
        return toast(
          'سند ثبت قطعی شده؛ اکنون «اتصال به Ledger» را بزنید'
        );
      }

      return journalModal(
        entry.id
      );
    }
  }

  const action =
    review.action;

  const amount =
    cleanAmount(
      document.total_amount ||
      extracted.total_amount ||
      ''
    );

  const date =
    document
      .source_document_date ||
    extracted.document_date ||
    today();

  const partyId =
    review.party_id ||
    document.party_id ||
    '';

  const accountId =
    review.account_id ||
    '';

  const description =
    String(
      extracted.description ||
      `ثبت از سند هوشمند ${document.file_name}`
    ).trim();

  if (
    !amount ||
    bi(amount) <= 0n
  ) {
    return toast(
      'مبلغ سند را در بازبینی تکمیل کنید'
    );
  }

  if (!accountId) {
    return toast(
      'حساب پیشنهادی را در بازبینی انتخاب کنید'
    );
  }

  if (
    action ===
      'purchase_invoice' ||
    action ===
      'sales_invoice'
  ) {

    if (!partyId) {
      return toast(
        'برای فاکتور، طرف‌حساب را انتخاب کنید'
      );
    }

    return invoiceModal(
      action ===
        'purchase_invoice'
        ? 'purchase'
        : 'sale',

      null,

      {
        sourceDocumentId:
          document.id,

        date,

        partyId,

        description,

        lines: [
          {
            account_id:
              accountId,

            description,

            quantity:
              '1',

            unit_price:
              amount,

            discount:
              '0'
          }
        ]
      }
    );
  }

  if (
    action ===
      'journal'
  ) {
    const account =
      acct(
        accountId
      );

    const debitSide =
      [
        'asset',
        'expense'
      ].includes(
        account?.category
      );

    return journalModal(
      null,

      {
        sourceDocumentId:
          document.id,

        date,

        description,

        lines: [
          {
            account_id:
              accountId,

            party_id:
              partyId ||
              null,

            debit:
              debitSide
                ? amount
                : '0',

            credit:
              debitSide
                ? '0'
                : amount
          },

          {}
        ]
      }
    );
  }

  return toast(
    'نوع عملیات حسابداری را در بازبینی مشخص کنید'
  );
}


async function
linkReviewedDocumentToLedger(
  documentId
) {
  const document =
    ctx.documents.find(
      item =>
        item.id ===
        documentId
    );

  if (!document) {
    return toast(
      'سند پیدا نشد'
    );
  }

  const draft =
    document
      ?.extracted_data
      ?.accounting_draft;

  if (
    !draft?.entity_id
  ) {
    return toast(
      'پیش‌نویس حسابداری برای این سند وجود ندارد'
    );
  }

  let journalEntryId =
    null;

  if (
    draft.entity_type ===
      'invoice'
  ) {
    const inv =
      ctx.invoices.find(
        item =>
          item.id ===
          draft.entity_id
      );

    if (
      !inv ||
      inv.status !==
        'posted' ||
      !inv.journal_entry_id
    ) {
      return toast(
        'ابتدا فاکتور پیش‌نویس را ثبت قطعی کنید'
      );
    }

    journalEntryId =
      inv.journal_entry_id;
  }

  if (
    draft.entity_type ===
      'journal'
  ) {
    const entry =
      ctx.entries.find(
        item =>
          item.id ===
          draft.entity_id
      );

    if (
      !entry ||
      entry.status !==
        'posted'
    ) {
      return toast(
        'ابتدا سند پیش‌نویس را ثبت قطعی کنید'
      );
    }

    journalEntryId =
      entry.id;
  }

  if (!journalEntryId) {
    return toast(
      'سند Ledger معتبر پیدا نشد'
    );
  }

  try {

    await Documents
      .linkToJournal({
        document,

        journalEntryId,

        userId:
          ctx.user.id
      });

    await loadContext();

    currentPage =
      'documents';

    await render();

    toast(
      'سند هوشمند با موفقیت به Ledger متصل شد'
    );

  } catch (err) {

    showError(
      err,
      'documentLedgerLink'
    );
  }
}
  
  function renderSettings(){
  setTitle('تنظیمات');const I=ctx.integrity||{},closed=ctx.periods.filter(p=>p.status==='closed');
  page(`<div class="grid4"><div class="card"><div class="kpi-label">فضای مالی</div><div class="kpi-value small-kpi">${esc(ctx.workspace.name)}</div></div><div class="card"><div class="kpi-label">نقش</div><div class="kpi-value small-kpi">${roleFa[ctx.workspaceRole]||esc(ctx.workspaceRole||'—')}</div></div><div class="card"><div class="kpi-label">اسناد نامتوازن Posted</div><div class="kpi-value ${Number(I.unbalanced_journals||0)===0?'pos':'neg'}">${I.unbalanced_journals??'—'}</div></div><div class="card"><div class="kpi-label">محل ذخیره</div><div class="kpi-value small-kpi">Supabase</div></div></div>
  <div class="section card"><div class="section-head"><div><h2>قفل دوره مالی</h2><span class="muted">Posting در بازه بسته توسط Database مسدود می‌شود.</span></div><button class="primary" id="closePeriodBtn">بستن یک بازه</button></div>${ctx.periods.length?`<table><thead><tr><th>نام</th><th>از</th><th>تا</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${ctx.periods.map(p=>`<tr><td>${esc(p.name)}</td><td>${dateFa(p.date_from)}</td><td>${dateFa(p.date_to)}</td><td><span class="badge ${p.status==='closed'?'reversed':'draft'}">${p.status==='closed'?'بسته':'باز'}</span></td><td>${p.status==='closed'?`<button class="ghost small" data-reopen-period="${p.id}">بازگشایی</button>`:'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">هنوز دوره‌ای قفل نشده است.</div>'}</div>
  <div class="section card"><h2>سلامت Core</h2><div class="summary-strip"><span class="summary-pill">حساب‌ها ${I.accounts??ctx.accounts.length}</span><span class="summary-pill">حساب نقد/بانک ${I.financial_accounts??ctx.financialAccounts.length}</span><span class="summary-pill">اسناد Posted/Reversed ${I.posted_or_reversed_journals??'—'}</span><span class="summary-pill ${Number(I.orphan_lines||0)===0?'pos':'neg'}">خط یتیم ${I.orphan_lines??'—'}</span><span class="summary-pill">دوره بسته ${closed.length}</span><span class="summary-pill">Workspace قابل مشاهده ${ctx.visibleWorkspaces}</span><span class="summary-pill">فاکتورها ${ctx.invoiceIntegrity?.invoices??ctx.invoices.length}</span><span class="summary-pill ${Number(ctx.invoiceIntegrity?.posted_without_journal||0)===0?'pos':'neg'}">فاکتور بدون سند ${ctx.invoiceIntegrity?.posted_without_journal??'—'}</span><span class="summary-pill ${Number(ctx.invoiceIntegrity?.total_mismatch||0)===0?'pos':'neg'}">اختلاف جمع فاکتور ${ctx.invoiceIntegrity?.total_mismatch??'—'}</span></div><p class="muted">داده‌های مالی از PostgreSQL/Supabase خوانده می‌شوند؛ LocalStorage فقط Session کاربر را نگه می‌دارد.</p></div>
  <div class="section card"><h2>حساب کاربری</h2><p class="muted">${esc(ctx.user.email||'—')}</p><button class="danger" id="logoutBtn">خروج از حساب</button></div>`);
}
function closePeriodModal(){openModal(`<h2>بستن دوره مالی</h2><form id="periodForm"><div class="form-grid"><div class="field"><label>نام دوره</label><input name="name" value="قفل تا ${dateFa(today())}" required></div><div class="field"><label>از تاریخ</label><input type="date" name="from" value="${ctx.fiscalYear.date_from}" required></div><div class="field"><label>تا تاریخ</label><input type="date" name="to" value="${today()}" required></div></div><div class="error-box">پس از بستن دوره، ثبت قطعی یا برگشت سند با تاریخ داخل این بازه مسدود می‌شود. Draft را می‌توان نگه داشت ولی Post نخواهد شد.</div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">بستن دوره</button></div></form>`);Q('cancelModal').onclick=closeModal;Q('periodForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await C.rpc('close_fiscal_period',{p_workspace_id:ctx.workspace.id,p_fiscal_year_id:ctx.fiscalYear.id,p_name:f.get('name'),p_date_from:f.get('from'),p_date_to:f.get('to')});closeModal();await reloadAndRender();toast('دوره مالی بسته شد')}catch(err){showError(err)}}}

function bind(){
  document
    .querySelectorAll('[data-page]')
    .forEach(
      b =>
        b.onclick = () =>
          navigate(
            b.dataset.page
          )
    );

  document
    .querySelectorAll('[data-action]')
    .forEach(
      b =>
        b.onclick = () =>
          operationModal(
            b.dataset.action
          )
    );

  document
    .querySelectorAll(
      '[data-why-number]'
    )
    .forEach(
      button =>
        button.onclick = () =>
          whyNumberModal(
            button.dataset.whyNumber,
            button.dataset.whyAmount
          )
    );

  document
  .querySelectorAll(
    '[data-nl-why-number]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        whyNumberModal(
          button.dataset
            .nlWhyNumber,

          button.dataset
            .nlWhyAmount,

          button.dataset
            .nlWhyFrom ||
            null,

          button.dataset
            .nlWhyTo ||
            null
        )
  );

  document
  .querySelectorAll(
    '[data-aging-party]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        agingDetailModal(
          button.dataset.agingSide,
          button.dataset.agingParty
        )
  );

const runBusinessAsk =
  query => {

    if (
      !dashboardIntelligence
    ) {
      return toast(
        'تحلیل مدیریتی هنوز آماده نیست'
      );
    }

    const cleanQuery =
      String(
        query || ''
      ).trim();

    if (!cleanQuery) {
      return toast(
        'سؤال مدیریتی را وارد کنید'
      );
    }

    const input =
      Q(
        'businessAskQuery'
      );

    if (input) {
      input.value =
        cleanQuery;
    }

    let answer;

    try {

      answer =
        answerBusinessQuestion({
          query:
            cleanQuery,

          snapshot:
            dashboardIntelligence
        });

    } catch (err) {

      return showError(
        err,
        'businessCopilot'
      );
    }

    const box =
      Q(
        'businessAskAnswer'
      );

    if (!box) {
      return;
    }

    box.innerHTML =
      businessAnswerHtml(
        answer,
        {
          money,
          esc
        }
      );

    box
      .querySelectorAll(
        '[data-business-why]'
      )
      .forEach(
        button =>
          button.onclick =
            () =>
              whyNumberModal(
                button.dataset
                  .businessWhy,

                button.dataset
                  .businessAmount
              )
      );
  };


if (
  Q('businessAskForm')
) {
  Q('businessAskForm')
    .onsubmit =
      event => {

        event.preventDefault();

        runBusinessAsk(
          Q(
            'businessAskQuery'
          )?.value
        );
      };
}


document
  .querySelectorAll(
    '[data-business-example]'
  )
  .forEach(
    button =>
      button.onclick =
        () =>
          runBusinessAsk(
            button.dataset
              .businessExample
          )
  );
  
if (Q('uploadDocumentBtn')) {
  Q('uploadDocumentBtn')
    .onclick =
      documentUploadModal;
}

document
  .querySelectorAll(
    '[data-view-document]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        openDocument(
          button.dataset
            .viewDocument
        )
  );

document
  .querySelectorAll(
    '[data-extract-document]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        extractDocument(
          button.dataset
            .extractDocument,
          button
        )
  );
  
  document
  .querySelectorAll(
    '[data-review-document]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        documentReviewModal(
          button.dataset
            .reviewDocument
        )
  );

  document
  .querySelectorAll(
    '[data-create-document-draft]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        documentAccountingDraft(
          button.dataset
            .createDocumentDraft
        )
  );


document
  .querySelectorAll(
    '[data-open-document-draft]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        documentAccountingDraft(
          button.dataset
            .openDocumentDraft
        )
  );


document
  .querySelectorAll(
    '[data-link-document-ledger]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        linkReviewedDocumentToLedger(
          button.dataset
            .linkDocumentLedger
        )
  );


document
  .querySelectorAll(
    '[data-view-linked-journal]'
  )
  .forEach(
    button =>
      button.onclick = () =>
        viewJournal(
          button.dataset
            .viewLinkedJournal
        )
  );
  
  document
    .querySelectorAll(
      '[data-edit-account]'
    )
    .forEach(
      b =>
        b.onclick = () =>
          accountModal(
            b.dataset.editAccount
          )
    );
  document.querySelectorAll('[data-archive-account]').forEach(b=>b.onclick=()=>toggleArchive(b.dataset.archiveAccount).catch(showError));
  document.querySelectorAll('[data-delete-account]').forEach(b=>b.onclick=()=>deleteAccount(b.dataset.deleteAccount));
  document.querySelectorAll('[data-opening]').forEach(b=>b.onclick=()=>openingModal(b.dataset.opening));
  document.querySelectorAll('[data-edit-party]').forEach(b=>b.onclick=()=>partyModal(b.dataset.editParty));
  document
  .querySelectorAll('[data-invoice-filter]')
  .forEach(
    b=>b.onclick=()=>{
      invoiceFilter=b.dataset.invoiceFilter;
      renderInvoices();
      bind();
    }
  );

document
  .querySelectorAll('[data-view-invoice]')
  .forEach(
    b=>b.onclick=()=>
      viewInvoice(
        b.dataset.viewInvoice
      )
  );

document
  .querySelectorAll('[data-edit-invoice]')
  .forEach(
    b=>b.onclick=()=>
      invoiceModal(
        null,
        b.dataset.editInvoice
      )
  );

document
  .querySelectorAll('[data-post-invoice]')
  .forEach(
    b=>b.onclick=async()=>{

      try{

        await C.rpc(
          'post_invoice',
          {
            iid:b.dataset.postInvoice
          }
        );

        await reloadAndRender();

        toast(
          'فاکتور ثبت قطعی شد'
        );

      }catch(e){
        showError(e);
      }
    }
  );

document
  .querySelectorAll('[data-delete-invoice]')
  .forEach(
    b=>b.onclick=async()=>{

      if(
        !confirm(
          'پیش‌نویس فاکتور حذف شود؟'
        )
      )
        return;

      try{

        await C.rpc(
          'delete_draft_invoice',
          {
            iid:b.dataset.deleteInvoice
          }
        );

        await reloadAndRender();

        toast(
          'پیش‌نویس فاکتور حذف شد'
        );

      }catch(e){
        showError(e);
      }
    }
  );

document
  .querySelectorAll('[data-reverse-invoice]')
  .forEach(
    b=>b.onclick=()=>
      reverseInvoiceModal(
        b.dataset.reverseInvoice
      )
  );
  document.querySelectorAll('[data-edit-journal]').forEach(b=>b.onclick=()=>journalModal(b.dataset.editJournal));
  document.querySelectorAll('[data-view-journal]').forEach(b=>b.onclick=()=>viewJournal(b.dataset.viewJournal));
  document.querySelectorAll('[data-post-journal]').forEach(b=>b.onclick=async()=>{try{await C.rpc('post_journal_entry',{jid:b.dataset.postJournal});await reloadAndRender();toast('سند ثبت قطعی شد')}catch(e){showError(e)}});
  document.querySelectorAll('[data-delete-journal]').forEach(b=>b.onclick=async()=>{if(!confirm('پیش‌نویس حذف شود؟'))return;try{await C.rpc('delete_draft_journal',{jid:b.dataset.deleteJournal});await reloadAndRender();toast('پیش‌نویس حذف شد')}catch(e){showError(e)}});
  document.querySelectorAll('[data-reverse-journal]').forEach(b=>b.onclick=()=>reverseModal(b.dataset.reverseJournal));
  if (
  Q('nlReportForm')
) {
  Q('nlReportForm')
    .onsubmit =
      async event => {

        event.preventDefault();

        await runNaturalReport();
      };
}

document
  .querySelectorAll(
    '[data-nl-example]'
  )
  .forEach(
    button =>
      button.onclick =
        async () => {

          const query =
            button.dataset
              .nlExample;

          const input =
            Q('nlReportQuery');

          if (input) {
            input.value =
              query;
          }

          await runNaturalReport(
            query
          );
        }
  );
  document.querySelectorAll('[data-report]').forEach(b=>b.onclick=async()=>{reportState.tab=b.dataset.report;await renderReports()});
  document.querySelectorAll('[data-reopen-period]').forEach(b=>b.onclick=async()=>{if(!confirm('این دوره دوباره باز شود؟'))return;try{await C.rpc('reopen_fiscal_period',{pid:b.dataset.reopenPeriod});await reloadAndRender();toast('دوره باز شد')}catch(e){showError(e)}});
 if(Q('addAccount'))
  Q('addAccount').onclick=()=>accountModal();

if(Q('addParty'))
  Q('addParty').onclick=()=>partyModal();

if(Q('newSaleInvoice'))
  Q('newSaleInvoice').onclick=()=>invoiceModal('sale');

if(Q('newPurchaseInvoice'))
  Q('newPurchaseInvoice').onclick=()=>invoiceModal('purchase');

if(Q('addJournal'))
  Q('addJournal').onclick=()=>journalModal();

if(Q('closePeriodBtn'))
  Q('closePeriodBtn').onclick=closePeriodModal;
  if(Q('applyReportRange'))Q('applyReportRange').onclick=async()=>{const f=Q('reportFrom').value,t=Q('reportTo').value;if(!f||!t||f>t)return toast('بازه گزارش معتبر نیست');reportState.from=f;reportState.to=t;await renderReports()};
  if(Q('ledgerAccount'))Q('ledgerAccount').onchange=()=>refreshLedger().catch(showError);
  if(Q('logoutBtn'))Q('logoutBtn').onclick=async()=>{await Auth.logout();location.reload()};
}

(async function boot(){

  if('serviceWorker'in navigator)
    navigator.serviceWorker
      .register('sw.js')
      .catch(()=>{});

  if(authCallback?.type==='recovery'){
    showAuth();
    passwordRecoveryModal();
    return;
  }

if(Auth.session()){
  try{
      await showApp();
    }catch(e){
      showError(e);
      showAuth();
    }
  }else{
    showAuth();
  }

})();
})();
