'use strict';

const UNIT_FA=Object.freeze({toman:'تومان',rial:'ریال'});
const PRINT_PAGES=new Set(['گزارش‌ها','فاکتورها','اسناد حسابداری']);
let scheduled=null;

function text(v){return String(v??'').replace(/\s+/g,' ').trim()}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function unit(){return window.AVAN_MONEY_DISPLAY_UNIT==='rial'?'rial':'toman'}
function unitFa(){return UNIT_FA[unit()]}
function latinDigits(v){return String(v??'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))}
function amount(v){const s=latinDigits(v).replace(/[٬,\s]/g,'').replace(/[^0-9-]/g,'');try{return BigInt(s||'0')}catch{return 0n}}
function grouped(v){let n=typeof v==='bigint'?v:amount(v),sign=n<0n?'-':'';if(n<0n)n=-n;return sign+n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'٬')}

function fixPortfolioActiveCard(){
  document.querySelectorAll('.avan-company-portfolio-card.active').forEach(card=>{
    const button=card.querySelector('[data-enter-company]');
    if(!button)return;
    const badge=document.createElement('span');
    badge.className='avan-current-company-indicator';
    badge.textContent='شرکت انتخاب‌شده';
    button.replaceWith(badge);
  });
}

function moneyColumnTitle(raw){
  const t=text(raw).replace(/\((تومان|ریال)\)$/,'').trim();
  return Boolean(t)&&/(بدهکار|بستانکار|مبلغ|مانده|خالص|جمع بدهکار|جمع بستانکار|جمع فروش|جمع خرید|درآمد|هزینه|دارایی|بدهی|حقوق مالکانه|سود|زیان|مالیات|تخفیف)/.test(t);
}

function annotateMoneyHeaders(root){
  if(!root?.querySelectorAll)return;
  root.querySelectorAll('table thead th').forEach(th=>{
    const raw=text(th.childNodes?.[0]?.nodeValue||th.textContent);
    if(!moneyColumnTitle(raw))return;
    let small=th.querySelector(':scope > .avan-table-money-unit');
    if(!small){small=document.createElement('small');small.className='avan-table-money-unit';th.append(small)}
    const desired=` (${unitFa()})`;
    if(small.textContent!==desired)small.textContent=desired;
  });
}

function ensureUnitChip(root,{detail=false}={}){
  if(!root)return;
  let chip=root.querySelector(':scope > .avan-output-money-unit');
  if(!chip){
    chip=document.createElement('div');
    chip.className='avan-output-money-unit';
    if(detail){const head=root.querySelector('.section-head');if(head)head.after(chip);else root.prepend(chip)}
    else {const toolbar=root.querySelector(':scope > .avan-export-toolbar');if(toolbar)toolbar.after(chip);else root.prepend(chip)}
  }
  if(chip.dataset.unit===unit())return;
  chip.dataset.unit=unit();
  chip.innerHTML=`<span>واحد مبالغ</span><strong>${esc(unitFa())}</strong>`;
}

function ensurePageUnits(){
  const content=document.getElementById('content');
  if(!content||!PRINT_PAGES.has(text(document.getElementById('pageTitle')?.textContent)))return;
  ensureUnitChip(content);annotateMoneyHeaders(content);
}

function journalTable(modal){
  if(!text(modal?.querySelector('h2')?.textContent).startsWith('سند '))return null;
  return [...modal.querySelectorAll('table')].find(table=>{
    const heads=[...table.querySelectorAll('thead th')].map(th=>text(th.textContent));
    return heads.some(x=>x.includes('بدهکار'))&&heads.some(x=>x.includes('بستانکار'));
  })||null;
}

function ensureJournalTotals(modal){
  const table=journalTable(modal);if(!table)return;
  const headers=[...table.querySelectorAll('thead th')].map(th=>text(th.childNodes?.[0]?.nodeValue||th.textContent));
  const debitIndex=headers.findIndex(x=>x.includes('بدهکار')),creditIndex=headers.findIndex(x=>x.includes('بستانکار'));
  if(debitIndex<0||creditIndex<0)return;
  let debit=0n,credit=0n;
  table.querySelectorAll('tbody tr').forEach(row=>{const cells=row.querySelectorAll('td');debit+=amount(cells[debitIndex]?.textContent);credit+=amount(cells[creditIndex]?.textContent)});
  const signature=`${debit}|${credit}|${unit()}`;
  let foot=table.querySelector('tfoot[data-avan-journal-total]');
  if(foot?.dataset.signature===signature)return;
  if(!foot){foot=document.createElement('tfoot');foot.dataset.avanJournalTotal='1';table.append(foot)}
  foot.dataset.signature=signature;
  const balanced=debit===credit&&debit>0n,diff=debit-credit,cols=headers.length,prefix=Math.max(1,Math.min(debitIndex,creditIndex));
  foot.innerHTML=`<tr class="avan-journal-total-row"><th colspan="${prefix}">جمع کل</th><th class="num">${grouped(debit)} ${esc(unitFa())}</th><th class="num">${grouped(credit)} ${esc(unitFa())}</th>${cols>prefix+2?`<th colspan="${cols-prefix-2}"></th>`:''}</tr><tr class="avan-journal-balance-row"><td colspan="${cols}"><strong class="${balanced?'avan-balanced':'avan-unbalanced'}">${balanced?'✓ سند تراز است':`⚠ سند تراز نیست — اختلاف: ${grouped(diff<0n?-diff:diff)} ${esc(unitFa())}`}</strong></td></tr>`;
}

function ensureDetailUnitsAndTotals(){
  const backdrop=document.getElementById('modalBackdrop'),modal=document.getElementById('modal');
  if(!modal||backdrop?.hidden)return;
  const heading=text(modal.querySelector('h2')?.textContent);
  if(!(heading.startsWith('سند ')||heading.startsWith('فاکتور')))return;
  ensureUnitChip(modal,{detail:true});annotateMoneyHeaders(modal);ensureJournalTotals(modal);
}

function installSignupPasswordGuard(){
  const form=document.getElementById('authForm');if(!form||form.dataset.avanPasswordGuard)return;
  form.dataset.avanPasswordGuard='1';
  form.addEventListener('submit',event=>{
    if(!document.getElementById('signupTab')?.classList.contains('active'))return;
    const password=document.getElementById('authPassword')?.value||'';
    if(password.length>=10&&/[A-Za-zآ-ی]/.test(password)&&/[0-9۰-۹]/.test(password))return;
    event.preventDefault();event.stopImmediatePropagation();
    const status=document.getElementById('authStatus');if(status)status.innerHTML='<span class="error-box" style="display:block">برای حساب جدید، رمز حداقل ۱۰ کاراکتر و شامل حرف و عدد انتخاب کنید.</span>';
  },true);
}

function run(){fixPortfolioActiveCard();ensurePageUnits();ensureDetailUnitsAndTotals()}
function schedule(){if(scheduled)clearTimeout(scheduled);scheduled=setTimeout(()=>{scheduled=null;run()},60)}
function install(){
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('avan:money-unit-changed',schedule);window.addEventListener('avan:company-context-changed',schedule);
  installSignupPasswordGuard();run();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
