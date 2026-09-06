'use strict';

const UNIT_FA=Object.freeze({toman:'تومان',rial:'ریال'});
const PRINT_PAGES=new Set(['گزارش‌ها','فاکتورها','اسناد حسابداری']);
const COMMON_PASSWORDS=new Set([
  'password123!','password1234!','qwerty123456!','admin123456!','welcome12345!',
  '1234567890a!','123456789012!','avan12345678!'
]);
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
    badge.setAttribute('aria-current','true');
    badge.textContent='شرکت انتخاب‌شده';
    button.replaceWith(badge);
  });
}

function moneyColumnTitle(raw){
  const t=text(raw).replace(/\((تومان|ریال)\)$/,'').trim();
  return Boolean(t)&&/(بدهکار|بستانکار|مبلغ|مانده|خالص|جمع|فی|قیمت|ارزش|فروش|خرید|درآمد|هزینه|دارایی|بدهی|حقوق مالکانه|سود|زیان|مالیات|تخفیف)/.test(t);
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
  chip.dataset.unit=unit();
  chip.innerHTML=`<span>واحد مبالغ</span><strong>${esc(unitFa())}</strong>`;
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
  const signature=`${debit}|${credit}|${unit()}|${headers.length}`;
  let foot=table.querySelector('tfoot[data-avan-journal-total]');
  if(foot?.dataset.signature===signature)return;
  if(!foot){foot=document.createElement('tfoot');foot.dataset.avanJournalTotal='1';table.append(foot)}
  foot.dataset.signature=signature;
  const balanced=debit===credit&&debit>0n,diff=debit>=credit?debit-credit:credit-debit,cols=headers.length;
  const first=Math.min(debitIndex,creditIndex),last=Math.max(debitIndex,creditIndex);
  const totalCells=[];
  if(first>0)totalCells.push(`<th colspan="${first}">جمع کل</th>`);
  else totalCells.push('<th>جمع کل</th>');
  for(let i=first;i<=last;i++){
    if(i===debitIndex)totalCells.push(`<th class="num">${grouped(debit)} ${esc(unitFa())}</th>`);
    else if(i===creditIndex)totalCells.push(`<th class="num">${grouped(credit)} ${esc(unitFa())}</th>`);
    else totalCells.push('<th></th>');
  }
  if(last<cols-1)totalCells.push(`<th colspan="${cols-last-1}"></th>`);
  foot.innerHTML=`<tr class="avan-journal-total-row">${totalCells.join('')}</tr><tr class="avan-journal-balance-row"><td colspan="${cols}"><strong class="${balanced?'avan-balanced':'avan-unbalanced'}">${balanced?'✓ سند تراز است':`⚠ سند تراز نیست — اختلاف: ${grouped(diff)} ${esc(unitFa())}`}</strong></td></tr>`;
}

function preparePageOutput(){
  const content=document.getElementById('content');
  if(!content)return;
  const pageTitle=text(document.getElementById('pageTitle')?.textContent);
  if(PRINT_PAGES.has(pageTitle)){ensureUnitChip(content);annotateMoneyHeaders(content)}
}

function prepareDetailOutput(){
  const backdrop=document.getElementById('modalBackdrop'),modal=document.getElementById('modal');
  if(!modal||backdrop?.hidden)return;
  const heading=text(modal.querySelector('h2')?.textContent);
  if(!(heading.startsWith('سند ')||heading.startsWith('فاکتور')))return;
  ensureUnitChip(modal,{detail:true});annotateMoneyHeaders(modal);ensureJournalTotals(modal);
}

function strongPassword(password){
  const p=String(password||'');
  if(p.length<12)return false;
  if(!/[A-Za-zآ-ی]/.test(p)||!/[0-9۰-۹]/.test(p)||!/[!@#$%^&*()_+\-=\[\]{};:'"\\|,.<>?\/`~]/.test(p))return false;
  return !COMMON_PASSWORDS.has(p.toLowerCase());
}

function passwordError(){return 'رمز جدید باید حداقل ۱۲ کاراکتر و شامل حرف، عدد و نماد باشد و از الگوهای بسیار رایج استفاده نکند.'}

function installPasswordGuard(){
  document.addEventListener('submit',event=>{
    const form=event.target;
    if(!(form instanceof HTMLFormElement))return;
    let password=null,status=null;
    if(form.id==='authForm'&&document.getElementById('signupTab')?.classList.contains('active')){
      password=document.getElementById('authPassword')?.value||'';
      status=document.getElementById('authStatus');
    }else if(form.id==='recoveryForm'){
      password=document.getElementById('newPassword')?.value||'';
      status=document.getElementById('recoveryStatus');
    }else return;
    if(strongPassword(password))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(status)status.innerHTML=`<span class="error-box" style="display:block">${passwordError()}</span>`;
  },true);
}

function syncPasswordInputs(){
  const signup=document.getElementById('signupTab')?.classList.contains('active');
  const authPassword=document.getElementById('authPassword');
  if(authPassword)authPassword.minLength=signup?12:6;
  document.querySelectorAll('#newPassword,#newPassword2').forEach(input=>input.minLength=12);
}

function prepareBeforeExport(event){
  const button=event.target?.closest?.('button');
  if(!button)return;
  const label=text(button.textContent);
  const isExport=button.hasAttribute('data-avan-print-detail')||/چاپ|PDF|CSV|خروجی/.test(label);
  if(!isExport)return;
  preparePageOutput();prepareDetailOutput();
}

function run(){fixPortfolioActiveCard();preparePageOutput();prepareDetailOutput();syncPasswordInputs()}
function schedule(){if(scheduled)clearTimeout(scheduled);scheduled=setTimeout(()=>{scheduled=null;run()},40)}
function install(){
  const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
  document.addEventListener('click',prepareBeforeExport,true);
  document.addEventListener('avan:money-unit-changed',schedule);window.addEventListener('avan:company-context-changed',schedule);
  installPasswordGuard();run();
  window.AvanOutputIntegrity=Object.freeze({prepare:run,unit:unitFa,strongPassword});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
