(function(){
'use strict';
const Q=id=>document.getElementById(id), C=window.AvanCloud;
let authMode='login', currentPage='dashboard';
let reportState={tab:'trial',from:null,to:null,ledgerAccount:null};
let ctx={user:null,workspace:null,fiscalYear:null,accounts:[],roles:{},parties:[],entries:[],lines:[],financialAccounts:[],periods:[],transactions:[],health:null,integrity:null,workspaceRole:null,visibleWorkspaces:0};

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

function msgFor(e){
  const m=String(e?.message||e||'خطای نامشخص');
  const map={
    'AUTH_REQUIRED':'ابتدا وارد حساب کاربری شوید.','Invalid login credentials':'ایمیل یا رمز عبور صحیح نیست.',
    'Email not confirmed':'ابتدا ایمیل ثبت‌نام را تأیید کنید.','User already registered':'این ایمیل قبلاً ثبت شده است.',
    'ACCOUNT_HAS_ACTIVITY':'این حساب گردش دارد و حذف نمی‌شود؛ آن را بایگانی کنید.',
    'ACCOUNT_HAS_CHILDREN':'این حساب زیرحساب دارد و قابل حذف نیست.','ACCOUNT_HAS_ACTIVE_CHILDREN':'ابتدا زیرحساب‌های فعال را بایگانی کنید.',
    'SYSTEM_ACCOUNT_PROTECTED':'حساب سیستمی قابل تغییر یا حذف نیست.','ACCOUNT_CODE_NAME_REQUIRED':'کد و نام حساب الزامی است.',
    'POSTED_ENTRY_IMMUTABLE':'سند ثبت‌شده قابل ویرایش مستقیم نیست.','POSTED_TRANSACTION_IMMUTABLE':'تراکنش ثبت‌شده قابل ویرایش مستقیم نیست.',
    'ENTRY_NOT_BALANCED':'سند برای ثبت قطعی باید حداقل دو ردیف و جمع بدهکار/بستانکار برابر داشته باشد.','MIN_TWO_LINES':'حداقل دو ردیف لازم است.','ACCOUNT_REQUIRED':'برای ردیف سند، انتخاب حساب الزامی است.','INVALID_DRAFT_LINE':'ردیف پیش‌نویس باید فقط بدهکار یا فقط بستانکار و دارای مبلغ مثبت باشد.','PERIOD_CLOSED':'این تاریخ در یک دوره بسته قرار دارد.',
    'FISCAL_YEAR_INVALID':'تاریخ سند خارج از سال مالی باز است.','FISCAL_YEAR_CLOSED':'سال مالی بسته است.',
    'ACCOUNT_NOT_POSTABLE':'فقط حساب تفصیلی فعال قابل ثبت است.','ACCOUNT_ARCHIVED':'حساب بایگانی‌شده قابل ثبت نیست.',
    'PRIMARY_ACCOUNT_NOT_FINANCIAL':'حساب اصلی باید بانک یا صندوق باشد.','COUNTERPART_ACCOUNT_NOT_FINANCIAL':'در انتقال، حساب مقصد نیز باید بانک یا صندوق باشد.',
    'SAME_ACCOUNT_NOT_ALLOWED':'حساب مبدأ و مقصد نمی‌توانند یکسان باشند.','OPENING_TARGET_INVALID':'حساب سرمایه افتتاحیه نمی‌تواند خودش مانده افتتاحیه بگیرد.','USE_TRANSFER_FOR_FINANCIAL_ACCOUNTS':'برای جابه‌جایی بین بانک/صندوق از «انتقال» استفاده کنید.','COUNTERPART_ACCOUNT_REQUIRED':'حساب مقابل را انتخاب کنید.',
    'AMOUNT_INVALID':'مبلغ معتبر و صحیح وارد کنید.','PARTY_NOT_FOUND':'طرف‌حساب معتبر نیست.','ROLE_NOT_ALLOWED':'سطح دسترسی شما برای این عملیات کافی نیست.',
    'PERIOD_OVERLAPS_CLOSED':'این بازه با یک دوره بسته هم‌پوشانی دارد.','PERIOD_OUTSIDE_FISCAL_YEAR':'بازه قفل باید داخل سال مالی باشد.',
    'PERIOD_RANGE_INVALID':'بازه دوره معتبر نیست.','PERIOD_NAME_REQUIRED':'نام دوره الزامی است.','PATCH_B4_REQUIRED':'Patch Gate B-4 روی دیتابیس اجرا نشده است.',
    'CLOUD_CONFIG_MISSING':'تنظیمات اتصال Supabase ناقص است.'
  };
  return map[m]||m;
}
function toast(t){const el=Q('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2800)}
function showError(e,where=''){console.error(where,e);toast(msgFor(e))}
function openModal(html){Q('modal').innerHTML=html;Q('modalBackdrop').hidden=false;document.body.classList.add('mobile-scroll-lock')}
function closeModal(){Q('modalBackdrop').hidden=true;Q('modal').innerHTML='';document.body.classList.remove('mobile-scroll-lock')}
Q('modalBackdrop').addEventListener('click',e=>{if(e.target===Q('modalBackdrop'))closeModal()});
function setTitle(t){Q('pageTitle').textContent=t;Q('breadcrumb').textContent=`آوان › ${t}`}
function setNav(page){document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page))}
function page(html){Q('content').innerHTML=html}
const acct=id=>ctx.accounts.find(a=>a.id===id);
const party=id=>ctx.parties.find(p=>p.id===id);
const role=k=>ctx.roles[k];
const activePostable=()=>ctx.accounts.filter(a=>a.is_active&&a.is_postable);
const financialLedgerIds=()=>new Set(ctx.financialAccounts.filter(f=>f.is_active).map(f=>f.ledger_account_id));
const financialPostable=()=>{const ids=financialLedgerIds();return activePostable().filter(a=>ids.has(a.id))};
const accountOptions=(selected='',filter=()=>true)=>ctx.accounts.filter(filter).map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.code)} — ${esc(a.name)}</option>`).join('');
const partyOptions=(selected='')=>`<option value="">بدون طرف‌حساب</option>`+ctx.parties.filter(p=>p.is_active).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');

async function loadContext(){
  ctx.user=await C.user(); if(!ctx.user)throw new Error('AUTH_REQUIRED');
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
  if(!reportState.from&&ctx.fiscalYear){reportState.from=ctx.fiscalYear.date_from;reportState.to=today()}
}
async function reloadAndRender(){await loadContext();await render()}
async function showApp(){
  Q('authShell').hidden=true;Q('appShell').hidden=false;Q('bottomNav').hidden=false;
  try{await reloadAndRender()}catch(e){
    if(e.message==='PATCH_B4_REQUIRED')page(`<div class="error-box"><b>Gate B-4 هنوز روی دیتابیس نصب نشده است.</b><br>فایل <code>GATE_B_4_PATCH.sql</code> را در SQL Editor اجرا کنید و سپس Refresh کنید.</div>`);
    else showError(e,'showApp');
  }
}
function showAuth(){Q('authShell').hidden=false;Q('appShell').hidden=true;Q('bottomNav').hidden=true}
function setAuthMode(mode){authMode=mode;Q('loginTab').classList.toggle('active',mode==='login');Q('signupTab').classList.toggle('active',mode==='signup');Q('authSubmit').textContent=mode==='login'?'ورود':'ساخت حساب';Q('authPassword').autocomplete=mode==='login'?'current-password':'new-password';Q('authStatus').textContent=''}
Q('loginTab').onclick=()=>setAuthMode('login');Q('signupTab').onclick=()=>setAuthMode('signup');
Q('authForm').onsubmit=async e=>{e.preventDefault();const email=Q('authEmail').value.trim(),password=Q('authPassword').value;Q('authSubmit').disabled=true;Q('authStatus').textContent='در حال ارتباط با Supabase…';try{if(authMode==='login'){await C.login(email,password);Q('authStatus').textContent='ورود موفق';await showApp()}else{const r=await C.signup(email,password);if(r?.access_token){Q('authStatus').textContent='حساب ساخته شد.';await showApp()}else{setAuthMode('login');Q('authStatus').innerHTML='<span class="success-box" style="display:block">ثبت‌نام انجام شد. در صورت فعال بودن تأیید ایمیل، ابتدا ایمیل را تأیید کنید.</span>'}}}catch(err){Q('authStatus').innerHTML=`<span class="error-box" style="display:block">${esc(msgFor(err))}</span>`}finally{Q('authSubmit').disabled=false}};

async function navigate(p){currentPage=p;setNav(p);closeModal();await render()}
async function render(){try{if(currentPage==='dashboard')await renderDashboard();else if(currentPage==='accounts')renderAccounts();else if(currentPage==='parties')renderParties();else if(currentPage==='journal')renderJournal();else if(currentPage==='reports')await renderReports();else renderSettings();bind()}catch(e){page(`<div class="error-box">${esc(msgFor(e))}</div>`);console.error(e)}}

async function renderDashboard(){
  setTitle('داشبورد');page('<div class="loading">در حال محاسبه از Ledger…</div>');
  const wid=ctx.workspace.id,from=ctx.fiscalYear.date_from,to=today();
  const [bs,pnl,cash]=await Promise.all([C.rpc('report_balance_sheet',{wid,as_of:to}),C.rpc('report_profit_loss',{wid,dfrom:from,dto:to}),C.rpc('report_cash_bank_balances',{wid,as_of:to})]);
  const B=Object.fromEntries((bs||[]).map(x=>[x.category,bi(x.amount)])),P=Object.fromEntries((pnl||[]).map(x=>[x.category,bi(x.amount)]));
  const assets=B.asset||0n,liab=B.liability||0n,equity=(B.equity||0n)+(B.current_profit||0n),profit=(P.income||0n)-(P.expense||0n),cashTotal=(cash||[]).reduce((s,x)=>s+bi(x.amount),0n);
  const recent=ctx.entries.filter(e=>e.status!=='draft').slice(0,6);
  page(`<div class="grid4"><div class="card"><div class="kpi-label">دارایی</div><div class="kpi-value">${money(assets)}</div></div><div class="card"><div class="kpi-label">بانک و صندوق</div><div class="kpi-value">${money(cashTotal)}</div></div><div class="card"><div class="kpi-label">بدهی</div><div class="kpi-value">${money(liab)}</div></div><div class="card"><div class="kpi-label">سود/زیان سال</div><div class="kpi-value ${profit>=0n?'pos':'neg'}">${money(profit)}</div></div></div>
  <div class="section card"><div class="section-head"><div><h2>آخرین اسناد</h2><span class="muted">حقوق مالکانه + سود جاری: ${money(equity)}</span></div><span class="cloud-badge">● Ledger زنده</span></div>${recent.length?`<table><thead><tr><th>شماره</th><th>تاریخ</th><th>شرح</th><th>منبع</th><th>وضعیت</th></tr></thead><tbody>${recent.map(e=>`<tr><td>${e.journal_no??'—'}</td><td>${dateFa(e.entry_date)}</td><td>${esc(e.description)}</td><td>${esc(e.source_type)}</td><td><span class="badge ${e.status}">${statusFa[e.status]||esc(e.status)}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty">هنوز سندی ثبت نشده است.</div>'}</div>`);
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

function renderJournal(){
  setTitle('اسناد حسابداری');
  const rows=ctx.entries.map(e=>`<tr><td>${e.journal_no??'پیش‌نویس'}</td><td>${dateFa(e.entry_date)}</td><td>${esc(e.description)}</td><td>${esc(e.source_type)}</td><td><span class="badge ${e.status}">${statusFa[e.status]||esc(e.status)}</span></td><td><div class="row-actions"><button class="ghost small" data-view-journal="${e.id}">مشاهده</button>${e.status==='draft'?`<button class="ghost small" data-edit-journal="${e.id}">ویرایش</button><button class="good-btn small" data-post-journal="${e.id}">ثبت قطعی</button><button class="danger small" data-delete-journal="${e.id}">حذف</button>`:e.status==='posted'?`<button class="danger small" data-reverse-journal="${e.id}">برگشت سند</button>`:''}</div></td></tr>`).join('');
  page(`<div class="section-head"><div><h2>چرخه اسناد</h2><span class="muted">Draft → Posted → Reversed؛ سند Posted و خطوط آن Immutable هستند.</span></div><button class="primary" id="addJournal">＋ سند دستی</button></div>${rows?`<table><thead><tr><th>شماره</th><th>تاریخ</th><th>شرح</th><th>منبع</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="empty">هنوز سندی وجود ندارد.</div>'}`);
}
function lineRow(l={}){return `<div class="journal-line" data-line-row><div class="field"><label>حساب</label><select name="account"><option value="">انتخاب حساب…</option>${accountOptions(l.account_id||'',a=>a.is_active&&a.is_postable)}</select></div><div class="field"><label>طرف‌حساب</label><select name="party">${partyOptions(l.party_id||'')}</select></div><div class="field"><label>بدهکار</label><input name="debit" inputmode="numeric" value="${esc(l.debit&&String(l.debit)!=='0'?l.debit:'')}"></div><div class="field"><label>بستانکار</label><input name="credit" inputmode="numeric" value="${esc(l.credit&&String(l.credit)!=='0'?l.credit:'')}"></div><button type="button" class="danger small" data-remove-line>×</button></div>`}
function bindLines(){document.querySelectorAll('[data-remove-line]').forEach(b=>b.onclick=()=>{b.closest('[data-line-row]').remove();updateLineTotals()});document.querySelectorAll('[data-line-row] input,[data-line-row] select').forEach(i=>i.oninput=updateLineTotals);updateLineTotals()}
function updateLineTotals(){const rows=[...document.querySelectorAll('[data-line-row]')],d=rows.reduce((s,r)=>s+bi(r.querySelector('[name=debit]').value),0n),c=rows.reduce((s,r)=>s+bi(r.querySelector('[name=credit]').value),0n),complete=rows.filter(r=>r.querySelector('[name=account]').value&&(bi(r.querySelector('[name=debit]').value)>0n||bi(r.querySelector('[name=credit]').value)>0n)).length;Q('lineTotals').innerHTML=`جمع بدهکار: <b>${money(d)}</b> | جمع بستانکار: <b>${money(c)}</b> | ${d>0n&&d===c&&complete>=2?'<span class="pos">آماده ثبت قطعی</span>':'<span class="warn">پیش‌نویس — هنوز آماده Post نیست</span>'}`}
function journalModal(id=null){
  const e=id?ctx.entries.find(x=>x.id===id):null;if(e&&e.status!=='draft')return toast('فقط پیش‌نویس قابل ویرایش است');const ls=e?ctx.lines.filter(l=>l.journal_entry_id===e.id):[];
  openModal(`<h2>${e?'ویرایش پیش‌نویس':'سند دستی جدید'}</h2><div class="info-box">پیش‌نویس لازم نیست متوازن باشد. تراز بودن، حداقل دو ردیف و اعتبار حساب‌ها هنگام «ثبت قطعی» کنترل می‌شود.</div><form id="journalForm"><div class="form-grid"><div class="field"><label>تاریخ</label><input type="date" name="date" value="${e?.entry_date||today()}" required></div><div class="field"><label>شرح سند</label><input name="description" value="${esc(e?.description||'سند دستی')}" required></div></div><div class="journal-lines" id="journalLines">${(ls.length?ls:[{},{}]).map(lineRow).join('')}</div><div class="line-total" id="lineTotals"></div><div class="form-actions"><button type="button" class="ghost" id="addLine">＋ ردیف</button><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">ذخیره پیش‌نویس</button></div></form>`);
  Q('addLine').onclick=()=>{Q('journalLines').insertAdjacentHTML('beforeend',lineRow());bindLines()};Q('cancelModal').onclick=closeModal;bindLines();
  Q('journalForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),rawRows=[...document.querySelectorAll('[data-line-row]')].map(r=>({account_id:r.querySelector('[name=account]').value,party_id:r.querySelector('[name=party]').value||null,debit:cleanAmount(r.querySelector('[name=debit]').value)||'0',credit:cleanAmount(r.querySelector('[name=credit]').value)||'0'}));for(const r of rawRows){const d=bi(r.debit),c=bi(r.credit);if((d>0n||c>0n)&&!r.account_id)return toast('برای ردیفی که مبلغ دارد، حساب را انتخاب کنید');if(d>0n&&c>0n)return toast('هر ردیف فقط می‌تواند بدهکار یا بستانکار باشد، نه هر دو');}const rows=rawRows.filter(r=>r.account_id&&(bi(r.debit)>0n||bi(r.credit)>0n));try{await C.rpc('save_draft_journal',{p_workspace_id:ctx.workspace.id,p_fiscal_year_id:ctx.fiscalYear.id,p_journal_id:e?.id||null,p_entry_date:f.get('date'),p_description:f.get('description'),p_lines:rows});closeModal();await reloadAndRender();const d=rows.reduce((s,x)=>s+bi(x.debit),0n),c=rows.reduce((s,x)=>s+bi(x.credit),0n);toast(rows.length>=2&&d>0n&&d===c?'پیش‌نویس متوازن ذخیره شد':'پیش‌نویس ذخیره شد؛ برای ثبت قطعی هنوز باید تکمیل و متوازن شود')}catch(err){showError(err)}};
}
function viewJournal(id){
  const e=ctx.entries.find(x=>x.id===id),ls=ctx.lines.filter(l=>l.journal_entry_id===id);openModal(`<div class="section-head"><div><h2>سند ${e.journal_no??'پیش‌نویس'}</h2><span class="muted">${dateFa(e.entry_date)} — ${esc(e.description)}</span></div><span class="badge ${e.status}">${statusFa[e.status]}</span></div><table><thead><tr><th>حساب</th><th>طرف‌حساب</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>${ls.map(l=>`<tr><td>${esc(acct(l.account_id)?.code||'')} — ${esc(acct(l.account_id)?.name||'')}</td><td>${esc(party(l.party_id)?.name||'—')}</td><td class="num">${money(l.debit)}</td><td class="num">${money(l.credit)}</td></tr>`).join('')}</tbody></table><div class="form-actions"><button class="ghost" id="cancelModal">بستن</button></div>`);Q('cancelModal').onclick=closeModal;
}
function reverseModal(id){
  const e=ctx.entries.find(x=>x.id===id);openModal(`<h2>برگشت سند ${e.journal_no}</h2><form id="reverseForm"><div class="form-grid"><div class="field"><label>تاریخ برگشت</label><input type="date" name="date" value="${today()}" required></div><div class="field"><label>علت</label><input name="reason" value="برگشت سند" required></div></div><div class="error-box">سند اصلی حذف یا ویرایش نمی‌شود؛ یک سند معکوس جدید Posted خواهد شد.</div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="danger">ثبت سند برگشتی</button></div></form>`);Q('cancelModal').onclick=closeModal;Q('reverseForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);try{await C.rpc('reverse_journal_entry',{jid:id,reverse_date:f.get('date'),reason:f.get('reason')});closeModal();await reloadAndRender();toast('سند برگشتی ثبت شد')}catch(err){showError(err)}};
}

function operationModal(kind){
  if(kind==='quick'){openModal(`<h2>ثبت سریع</h2><div class="summary-strip"><button class="good-btn" data-op="receipt">دریافت</button><button class="danger" data-op="payment">پرداخت</button><button class="ghost" data-op="transfer">انتقال</button><button class="primary" data-op="journal">سند دستی</button></div>`);document.querySelectorAll('[data-op]').forEach(b=>b.onclick=async()=>{if(b.dataset.op==='journal'){await navigate('journal');journalModal()}else operationModal(b.dataset.op)});return}
  const fin=financialPostable();if(!fin.length)return toast('حساب بانک/صندوق فعال پیدا نشد');const title=kind==='receipt'?'دریافت':kind==='payment'?'پرداخت':'انتقال',defCounter=kind==='receipt'?role('default_income'):role('default_expense');
  const finIds=new Set(fin.map(a=>a.id));
  openModal(`<h2>${title}</h2><form id="opForm"><div class="form-grid"><div class="field"><label>تاریخ</label><input type="date" name="date" value="${today()}" required><small>جلالی: ${dateFa(today())}</small></div><div class="field"><label>مبلغ</label><input name="amount" inputmode="numeric" required></div>${kind==='receipt'?`<div class="field"><label>واریز به</label><select name="primary">${accountOptions(role('bank'),a=>finIds.has(a.id))}</select></div><div class="field"><label>حساب مقابل</label><select name="counter">${accountOptions(defCounter,a=>a.is_active&&a.is_postable)}</select></div>`:kind==='payment'?`<div class="field"><label>پرداخت از</label><select name="primary">${accountOptions(role('bank'),a=>finIds.has(a.id))}</select></div><div class="field"><label>حساب هزینه/مقابل</label><select name="counter">${accountOptions(defCounter,a=>a.is_active&&a.is_postable)}</select></div>`:`<div class="field"><label>از حساب</label><select name="primary">${accountOptions(role('bank'),a=>finIds.has(a.id))}</select></div><div class="field"><label>به حساب</label><select name="counter">${accountOptions(role('cash'),a=>finIds.has(a.id))}</select></div>`}<div class="field"><label>طرف‌حساب</label><select name="party">${partyOptions()}</select></div><div class="field"><label>شرح</label><input name="description" value="${title}" required></div></div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">ثبت قطعی</button></div></form>`);
  Q('cancelModal').onclick=closeModal;Q('opForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),amt=cleanAmount(f.get('amount')),primary=f.get('primary'),counter=f.get('counter');if(bi(amt)<=0n)return toast('مبلغ معتبر وارد کنید');if(primary===counter)return toast('حساب مبدأ و مقصد/مقابل باید متفاوت باشند');try{await C.rpc('post_financial_operation',{p_workspace_id:ctx.workspace.id,p_fiscal_year_id:ctx.fiscalYear.id,p_tx_date:f.get('date'),p_tx_type:kind,p_amount:amt,p_primary_account_id:primary,p_counterpart_account_id:counter,p_party_id:f.get('party')||null,p_description:f.get('description')});closeModal();await reloadAndRender();toast(`${title} ثبت شد`)}catch(err){showError(err)}};
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
  page(`${reportToolbar()}<div class="tabs"><button data-report="journal" class="${tab==='journal'?'active':''}">دفتر روزنامه</button><button data-report="trial" class="${tab==='trial'?'active':''}">تراز آزمایشی</button><button data-report="ledger" class="${tab==='ledger'?'active':''}">گردش حساب</button><button data-report="pnl" class="${tab==='pnl'?'active':''}">سود و زیان</button><button data-report="balance" class="${tab==='balance'?'active':''}">ترازنامه</button><button data-report="cash" class="${tab==='cash'?'active':''}">بانک/صندوق</button></div>${body}`);
  if(tab==='ledger')await refreshLedger();bind();
}
async function refreshLedger(){const aid=Q('ledgerAccount')?.value;if(!aid)return;reportState.ledgerAccount=aid;const r=await C.rpc('report_account_statement',{wid:ctx.workspace.id,aid,dfrom:reportState.from,dto:reportState.to});Q('ledgerBody').innerHTML=r.length?`<table><thead><tr><th>سند</th><th>تاریخ</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.journal_no}</td><td>${dateFa(x.entry_date)}</td><td>${esc(x.description)}</td><td class="num">${money(x.debit)}</td><td class="num">${money(x.credit)}</td><td class="num">${money(x.running_net)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">گردشی وجود ندارد.</div>'}

function renderSettings(){
  setTitle('تنظیمات');const I=ctx.integrity||{},closed=ctx.periods.filter(p=>p.status==='closed');
  page(`<div class="grid4"><div class="card"><div class="kpi-label">فضای مالی</div><div class="kpi-value small-kpi">${esc(ctx.workspace.name)}</div></div><div class="card"><div class="kpi-label">نقش</div><div class="kpi-value small-kpi">${roleFa[ctx.workspaceRole]||esc(ctx.workspaceRole||'—')}</div></div><div class="card"><div class="kpi-label">اسناد نامتوازن Posted</div><div class="kpi-value ${Number(I.unbalanced_journals||0)===0?'pos':'neg'}">${I.unbalanced_journals??'—'}</div></div><div class="card"><div class="kpi-label">محل ذخیره</div><div class="kpi-value small-kpi">Supabase</div></div></div>
  <div class="section card"><div class="section-head"><div><h2>قفل دوره مالی</h2><span class="muted">Posting در بازه بسته توسط Database مسدود می‌شود.</span></div><button class="primary" id="closePeriodBtn">بستن یک بازه</button></div>${ctx.periods.length?`<table><thead><tr><th>نام</th><th>از</th><th>تا</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>${ctx.periods.map(p=>`<tr><td>${esc(p.name)}</td><td>${dateFa(p.date_from)}</td><td>${dateFa(p.date_to)}</td><td><span class="badge ${p.status==='closed'?'reversed':'draft'}">${p.status==='closed'?'بسته':'باز'}</span></td><td>${p.status==='closed'?`<button class="ghost small" data-reopen-period="${p.id}">بازگشایی</button>`:'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">هنوز دوره‌ای قفل نشده است.</div>'}</div>
  <div class="section card"><h2>سلامت Core</h2><div class="summary-strip"><span class="summary-pill">حساب‌ها ${I.accounts??ctx.accounts.length}</span><span class="summary-pill">حساب نقد/بانک ${I.financial_accounts??ctx.financialAccounts.length}</span><span class="summary-pill">اسناد Posted/Reversed ${I.posted_or_reversed_journals??'—'}</span><span class="summary-pill ${Number(I.orphan_lines||0)===0?'pos':'neg'}">خط یتیم ${I.orphan_lines??'—'}</span><span class="summary-pill">دوره بسته ${closed.length}</span><span class="summary-pill">Workspace قابل مشاهده ${ctx.visibleWorkspaces}</span></div><p class="muted">داده‌های مالی از PostgreSQL/Supabase خوانده می‌شوند؛ LocalStorage فقط Session کاربر را نگه می‌دارد.</p></div>
  <div class="section card"><h2>حساب کاربری</h2><p class="muted">${esc(ctx.user.email||'—')}</p><button class="danger" id="logoutBtn">خروج از حساب</button></div>`);
}
function closePeriodModal(){openModal(`<h2>بستن دوره مالی</h2><form id="periodForm"><div class="form-grid"><div class="field"><label>نام دوره</label><input name="name" value="قفل تا ${dateFa(today())}" required></div><div class="field"><label>از تاریخ</label><input type="date" name="from" value="${ctx.fiscalYear.date_from}" required></div><div class="field"><label>تا تاریخ</label><input type="date" name="to" value="${today()}" required></div></div><div class="error-box">پس از بستن دوره، ثبت قطعی یا برگشت سند با تاریخ داخل این بازه مسدود می‌شود. Draft را می‌توان نگه داشت ولی Post نخواهد شد.</div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">بستن دوره</button></div></form>`);Q('cancelModal').onclick=closeModal;Q('periodForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await C.rpc('close_fiscal_period',{p_workspace_id:ctx.workspace.id,p_fiscal_year_id:ctx.fiscalYear.id,p_name:f.get('name'),p_date_from:f.get('from'),p_date_to:f.get('to')});closeModal();await reloadAndRender();toast('دوره مالی بسته شد')}catch(err){showError(err)}}}

function bind(){
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>operationModal(b.dataset.action));
  document.querySelectorAll('[data-edit-account]').forEach(b=>b.onclick=()=>accountModal(b.dataset.editAccount));
  document.querySelectorAll('[data-archive-account]').forEach(b=>b.onclick=()=>toggleArchive(b.dataset.archiveAccount).catch(showError));
  document.querySelectorAll('[data-delete-account]').forEach(b=>b.onclick=()=>deleteAccount(b.dataset.deleteAccount));
  document.querySelectorAll('[data-opening]').forEach(b=>b.onclick=()=>openingModal(b.dataset.opening));
  document.querySelectorAll('[data-edit-party]').forEach(b=>b.onclick=()=>partyModal(b.dataset.editParty));
  document.querySelectorAll('[data-edit-journal]').forEach(b=>b.onclick=()=>journalModal(b.dataset.editJournal));
  document.querySelectorAll('[data-view-journal]').forEach(b=>b.onclick=()=>viewJournal(b.dataset.viewJournal));
  document.querySelectorAll('[data-post-journal]').forEach(b=>b.onclick=async()=>{try{await C.rpc('post_journal_entry',{jid:b.dataset.postJournal});await reloadAndRender();toast('سند ثبت قطعی شد')}catch(e){showError(e)}});
  document.querySelectorAll('[data-delete-journal]').forEach(b=>b.onclick=async()=>{if(!confirm('پیش‌نویس حذف شود؟'))return;try{await C.rpc('delete_draft_journal',{jid:b.dataset.deleteJournal});await reloadAndRender();toast('پیش‌نویس حذف شد')}catch(e){showError(e)}});
  document.querySelectorAll('[data-reverse-journal]').forEach(b=>b.onclick=()=>reverseModal(b.dataset.reverseJournal));
  document.querySelectorAll('[data-report]').forEach(b=>b.onclick=async()=>{reportState.tab=b.dataset.report;await renderReports()});
  document.querySelectorAll('[data-reopen-period]').forEach(b=>b.onclick=async()=>{if(!confirm('این دوره دوباره باز شود؟'))return;try{await C.rpc('reopen_fiscal_period',{pid:b.dataset.reopenPeriod});await reloadAndRender();toast('دوره باز شد')}catch(e){showError(e)}});
  if(Q('addAccount'))Q('addAccount').onclick=()=>accountModal();if(Q('addParty'))Q('addParty').onclick=()=>partyModal();if(Q('addJournal'))Q('addJournal').onclick=()=>journalModal();if(Q('closePeriodBtn'))Q('closePeriodBtn').onclick=closePeriodModal;
  if(Q('applyReportRange'))Q('applyReportRange').onclick=async()=>{const f=Q('reportFrom').value,t=Q('reportTo').value;if(!f||!t||f>t)return toast('بازه گزارش معتبر نیست');reportState.from=f;reportState.to=t;await renderReports()};
  if(Q('ledgerAccount'))Q('ledgerAccount').onchange=()=>refreshLedger().catch(showError);
  if(Q('logoutBtn'))Q('logoutBtn').onclick=async()=>{await C.logout();location.reload()};
}

(async function boot(){
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(C.session()){try{await showApp()}catch(e){showError(e);showAuth()}}else showAuth();
})();
})();
