'use strict';
(function(){
  const R=window.StockHunterResearchV416;
  if(!R)return;
  const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const week=['ش','ی','د','س','چ','پ','ج'];
  let active=null,viewY=1405,viewM=1,dialog=null,grid=null,title=null;

  function parts(iso){
    const s=R.jalaliDate(iso);const m=String(s||'').match(/(\d{4})\/(\d{2})\/(\d{2})/);
    return m?{y:+m[1],m:+m[2],d:+m[3]}:null;
  }
  function daysInMonth(y,m){
    if(m<=6)return 31;if(m<=11)return 30;
    return R.jalaliToIso(y+'/12/30')?30:29;
  }
  function firstOffset(y,m){
    const iso=R.jalaliToIso(y+'/'+String(m).padStart(2,'0')+'/01');
    if(!iso)return 0;const wd=new Date(iso+'T12:00:00Z').getUTCDay();
    return (wd+1)%7;
  }
  function move(delta){
    viewM+=delta;
    while(viewM<1){viewM=12;viewY--;}
    while(viewM>12){viewM=1;viewY++;}
    render();
  }
  function ensure(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='jalali-calendar-dialog-v417';
    dialog.innerHTML='<div class="jalali-cal-head"><button type="button" data-cal-next aria-label="ماه بعد">‹</button><b data-cal-title>—</b><button type="button" data-cal-prev aria-label="ماه قبل">›</button></div><div class="jalali-cal-week"></div><div class="jalali-cal-grid"></div><div class="jalali-cal-foot"><button type="button" data-cal-today>امروز</button><button type="button" data-cal-close>بستن</button></div>';
    document.body.appendChild(dialog);grid=dialog.querySelector('.jalali-cal-grid');title=dialog.querySelector('[data-cal-title]');
    dialog.querySelector('.jalali-cal-week').innerHTML=week.map(x=>'<span>'+x+'</span>').join('');
    dialog.querySelector('[data-cal-prev]').onclick=()=>move(-1);
    dialog.querySelector('[data-cal-next]').onclick=()=>move(1);
    dialog.querySelector('[data-cal-close]').onclick=()=>dialog.close();
    dialog.querySelector('[data-cal-today]').onclick=()=>{if(!active)return;selectIso(R.todayIso());};
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();const b=e.target.closest('[data-iso]');if(b)selectIso(b.dataset.iso);});
  }
  function render(){
    if(!dialog)return;title.textContent=months[viewM-1]+' '+Number(viewY).toLocaleString('fa-IR',{useGrouping:false});
    const selected=active?.dataset.iso||R.jalaliToIso(active?.value)||'',today=R.todayIso(),off=firstOffset(viewY,viewM),n=daysInMonth(viewY,viewM);
    let html='';for(let i=0;i<off;i++)html+='<span class="jalali-cal-empty"></span>';
    for(let d=1;d<=n;d++){
      const iso=R.jalaliToIso(viewY+'/'+String(viewM).padStart(2,'0')+'/'+String(d).padStart(2,'0'));
      if(!iso)continue;
      const cls=(iso===selected?' selected':'')+(iso===today?' today':'');
      html+='<button type="button" class="jalali-cal-day'+cls+'" data-iso="'+iso+'">'+Number(d).toLocaleString('fa-IR')+'</button>';
    }
    grid.innerHTML=html;
  }
  function selectIso(iso){
    if(!active||!iso)return;R.setJalaliInput(active,iso);dialog.close();
    active.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function openFor(input){
    ensure();active=input;const p=parts(input.dataset.iso||R.jalaliToIso(input.value)||R.todayIso())||parts(R.todayIso());
    viewY=p.y;viewM=p.m;render();dialog.showModal();
  }
  function wireInputs(root=document){
    root.querySelectorAll('.jalali-input').forEach(input=>{
      if(input.dataset.calendarReady==='1')return;
      input.dataset.calendarReady='1';input.readOnly=true;input.inputMode='none';input.autocomplete='off';
      input.setAttribute('aria-haspopup','dialog');input.title='برای انتخاب تاریخ، تقویم را باز کنید';
      input.addEventListener('click',()=>openFor(input));
      input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openFor(input);}});
      const trigger=document.createElement('button');trigger.type='button';trigger.className='jalali-calendar-trigger-v417';trigger.textContent='▦';trigger.title='انتخاب تاریخ از تقویم شمسی';trigger.setAttribute('aria-label','انتخاب تاریخ از تقویم شمسی');
      input.insertAdjacentElement('afterend',trigger);trigger.onclick=()=>openFor(input);
    });
  }
  function wireNav(){
    const nav=document.querySelector('.research-nav');if(!nav)return;
    if(!nav.querySelector('a[href="ai-center-v417.html"]')){
      const a=document.createElement('a');a.href='ai-center-v417.html';a.textContent='مرکز هوش مصنوعی';nav.appendChild(a);
    }
    if(!nav.querySelector('.research-print-btn-v417')){
      const b=document.createElement('button');b.type='button';b.className='research-print-btn-v417';b.textContent='چاپ / ذخیره PDF';b.onclick=()=>window.print();nav.appendChild(b);
    }
  }
  wireInputs();wireNav();
  new MutationObserver(()=>wireInputs()).observe(document.body,{childList:true,subtree:true});
})();