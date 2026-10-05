'use strict';
/* Stock Hunter Replay activity window v4.3.4 — UI/data presentation only.
   Frozen Hunt engine 4.1.6-hunt-v2 is untouched. */
(function(){
  if(window.STOCK_HUNTER_REPLAY_SESSION_V433)return;
  const TEHRAN='Asia/Tehran';
  const baseLoadReplay=typeof loadReplay==='function'?loadReplay:null;
  if(!baseLoadReplay)return;
  const faTime=m=>{
    const h=Math.floor(m/60),min=m%60;
    return (String(h).padStart(2,'0')+':'+String(min).padStart(2,'0')).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  };
  const localSeconds=iso=>{
    const d=new Date(iso);if(!Number.isFinite(d.getTime()))return null;
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TEHRAN,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const g=t=>Number(parts.find(p=>p.type===t)?.value||0);
    return g('hour')*3600+g('minute')*60+g('second');
  };
  function movementChanged(a,b){
    if(!a||!b)return false;
    const av=Number(a.last_volume),bv=Number(b.last_volume);
    if(Number.isFinite(av)&&Number.isFinite(bv)&&bv>0&&av!==bv)return true;
    return ['close_price','high_price','low_price'].some(k=>{
      const x=Number(a[k]),y=Number(b[k]);
      return Number.isFinite(x)&&Number.isFinite(y)&&x!==y;
    });
  }
  function profile(rows){
    if(!rows.length)return {key:'ACTUAL_ACTIVITY',start:0,end:0,start_ms:null,end_ms:null,first_index:0,last_index:-1,label:'حرکت واقعی نماد'};
    let first=Number(rows[0]?.last_volume)>0?0:-1,last=first;
    for(let i=1;i<rows.length;i++){
      if(movementChanged(rows[i-1],rows[i])){
        if(first<0)first=i;
        last=i;
      }
    }
    if(first<0){first=0;last=rows.length-1;}
    if(last<first)last=first;
    const startSec=localSeconds(rows[first]?.bucket_at),endSec=localSeconds(rows[last]?.bucket_at);
    const startMs=new Date(rows[first]?.bucket_at||0).getTime(),endMs=new Date(rows[last]?.bucket_at||0).getTime();
    return {
      key:'ACTUAL_ACTIVITY',
      start:Number.isFinite(startSec)?Math.floor(startSec/60):0,
      end:Number.isFinite(endSec)?Math.floor(endSec/60):0,
      start_ms:Number.isFinite(startMs)?startMs:null,
      end_ms:Number.isFinite(endMs)?endMs:null,
      first_index:first,last_index:last,
      label:'حرکت واقعی نماد'
    };
  }
  function applySessionWindow(){
    if(!Array.isArray(replayRows))return;
    const raw=[...replayRows],sid=document.getElementById('replaySymbol')?.value||'';
    const meta=(typeof symbolMeta!=='undefined'&&Array.isArray(symbolMeta))?symbolMeta.find(x=>String(x.symbol_id)===String(sid)):null;
    const tradeDate=R.readJalaliInput(document.getElementById('replayDate'),R.todayIso());
    const p=profile(raw);
    replayRows=p.last_index>=p.first_index?raw.slice(p.first_index,p.last_index+1):[];
    index=Math.min(Math.max(0,index||0),Math.max(0,replayRows.length-1));
    const slider=document.getElementById('replaySlider');if(slider)slider.max=String(Math.max(0,replayRows.length-1));
    const state={version:'4.3.4',profile:p.key,profile_label:p.label,trade_date:tradeDate,start_minute:p.start,end_minute:p.end,start_label:faTime(p.start),end_label:faTime(p.end),start_ms:p.start_ms,end_ms:p.end_ms,raw_rows:raw.length,kept_rows:replayRows.length,removed_rows:Math.max(0,raw.length-replayRows.length),asset_type:meta?.asset_type||'',symbol:meta?.symbol||''};
    window.STOCK_HUNTER_REPLAY_SESSION_V433.current=state;
    renderTable();renderCurrent();renderMilestones();
    if(replayRows.length){
      const name=meta?.symbol||document.getElementById('replaySymbol')?.selectedOptions?.[0]?.textContent?.split(' — ')[0]||'نماد';
      const res=[...new Set(replayRows.map(x=>Number(x.bucket_seconds)||30))].sort((a,b)=>a-b).map(resolutionFa).join(' / ');
      R.setStatus('بازپخش '+name+' — '+R.fa(replayRows.length)+' نما · بازه حرکت واقعی '+state.start_label+' تا '+state.end_label+' · '+(res||'تفکیک نامشخص'),'ok');
    }else if(raw.length){
      R.setStatus('برای این نماد نمونه Market Tape وجود دارد، اما حرکت معاملاتی قابل تشخیص نیست.','warn');
    }
    return state;
  }
  async function loadReplayV433(){
    const result=await baseLoadReplay.apply(this,arguments);
    applySessionWindow();
    return result;
  }
  loadReplay=loadReplayV433;
  const sel=document.getElementById('replaySymbol');if(sel)sel.onchange=loadReplayV433;
  window.STOCK_HUNTER_REPLAY_SESSION_V433={version:'4.3.4',mode:'ACTUAL_SYMBOL_ACTIVITY_WINDOW',timezone:TEHRAN,current:null,apply:applySessionWindow};
  setTimeout(()=>{try{if(Array.isArray(replayRows)&&replayRows.length&&!window.STOCK_HUNTER_REPLAY_SESSION_V433.current)applySessionWindow();}catch{}},1200);
})();
