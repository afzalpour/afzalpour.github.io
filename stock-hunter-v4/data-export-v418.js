'use strict';
(function(){
  const VERSION='4.1.8-export-v1';
  const FA='۰۱۲۳۴۵۶۷۸۹',AR='٠١٢٣٤٥٦٧٨٩';
  const latin=s=>String(s??'').replace(/[۰-۹]/g,d=>String(FA.indexOf(d))).replace(/[٠-٩]/g,d=>String(AR.indexOf(d))).replace(/٬/g,',').replace(/٫/g,'.');
  const clean=s=>String(s??'').replace(/\u200c/g,'‌').replace(/\s+/g,' ').trim();
  const escXml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const hasDigit=s=>/[0-9۰-۹٠-٩]/.test(String(s||''));
  const visible=el=>!!el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
  const safeName=s=>clean(s).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').slice(0,80)||'گزارش';
  const nowFa=()=>new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\//g,'-');
  const sectionTitle=(root,fallback='داده')=>{
    const h=root.matches?.('section,article,div')?root.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > .panel-title-row h2,:scope > .saved-head h2'):null;
    if(h)return clean(h.textContent);
    if(root.classList?.contains('summary-row'))return 'خلاصه بازار';
    if(root.classList?.contains('cards'))return 'شاخص‌های خلاصه';
    if(root.id==='detailDialog')return 'جزئیات نماد '+clean(document.getElementById('dSymbol')?.textContent||'');
    return fallback;
  };
  function valueOf(text){
    const raw=clean(text),x=latin(raw).replace(/,/g,'');
    if(/^[-+]?\d+(?:\.\d+)?$/.test(x))return Number(x);
    if(/^[-+]?\d+(?:\.\d+)?%$/.test(x))return Number(x.slice(0,-1))/100;
    return raw;
  }
  function tableDataset(table,index){
    const headers=[...table.querySelectorAll('thead th')].map(th=>clean(th.textContent));
    const rows=[...table.querySelectorAll('tbody tr')].filter(visible).map(tr=>[...tr.querySelectorAll('th,td')].map(td=>valueOf(td.textContent)));
    if(!rows.length)return null;
    let head=headers.length?headers:Array.from({length:Math.max(...rows.map(r=>r.length))},(_,i)=>'ستون '+(i+1));
    return {name:clean(table.dataset.exportName||table.getAttribute('aria-label')||'جدول '+index),rows:[head,...rows]};
  }
  function cardDatasets(root){
    const selectors=['.summary-row article','.card','.health-item','.retention-item','.metric','.detail-hunt-metrics span','.integrated-banner>div','.expert-grid>div','.forecast-box','.mobile-metrics>div'];
    const nodes=[...root.querySelectorAll(selectors.join(','))].filter(visible);
    const seen=new Set(),rows=[['عنوان','مقدار','توضیح']];
    for(const el of nodes){
      if(seen.has(el))continue;seen.add(el);
      if(el.closest('.data-export-toolbar-v418'))continue;
      const label=clean(el.querySelector('span,small,label')?.textContent||el.getAttribute('aria-label')||'شاخص');
      const strong=clean(el.querySelector('b,strong')?.textContent||'');
      const full=clean(el.textContent);
      const value=strong||full.replace(label,'').trim();
      if(!hasDigit(value)&&!hasDigit(full))continue;
      const note=clean([...el.querySelectorAll('small,p')].map(x=>x.textContent).join(' | '));
      rows.push([label||'شاخص',valueOf(value),note]);
    }
    return rows.length>1?{name:'شاخص‌ها',rows}:null;
  }
  function textDataset(root){
    const nodes=[...root.querySelectorAll('.ai-output-v417,.detail-ai-output,.detail-ai-similar,.section-note,.research-status,.footnote')].filter(visible);
    const rows=[['بخش','متن']];
    for(const el of nodes){
      const txt=clean(el.textContent);if(!txt||!hasDigit(txt))continue;
      const parent=el.closest('.panel,.detail-ai-v417')||root;
      rows.push([sectionTitle(parent,'تحلیل'),txt]);
    }
    return rows.length>1?{name:'تحلیل‌های عددی',rows}:null;
  }
  function collect(root=document){
    const out=[];
    let idx=1;
    for(const table of [...root.querySelectorAll('table')].filter(visible)){
      const d=tableDataset(table,idx++);if(d)out.push(d);
    }
    const c=cardDatasets(root);if(c)out.unshift(c);
    const t=textDataset(root);if(t)out.push(t);
    if(!out.length){
      const txt=clean(root.innerText||root.textContent||'');
      if(hasDigit(txt))out.push({name:sectionTitle(root,'نمای فعلی'),rows:[['نمای فعلی'],[txt]]});
    }
    return out;
  }
  function uniqueSheetName(name,used){
    let base=clean(name).replace(/[\\/?*\[\]:]/g,' ').slice(0,31)||'داده',n=1,x=base;
    while(used.has(x)){const suffix=' '+(++n);x=base.slice(0,31-suffix.length)+suffix;}
    used.add(x);return x;
  }
  function filename(root,ext){
    const title=sectionTitle(root,document.title||'شکارچی سهم');
    return safeName('شکارچی-سهم-'+title+'-'+nowFa())+'.'+ext;
  }
  function download(blob,name){
    const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function csvCell(v){
    let s=typeof v==='number'?String(v):String(v??'');
    if(/[",\r\n]/.test(s))s='"'+s.replace(/"/g,'""')+'"';return s;
  }
  function exportCsv(root){
    const sets=collect(root);if(!sets.length)return;
    const lines=[];
    for(const s of sets){
      lines.push('### '+s.name);
      for(const row of s.rows)lines.push(row.map(csvCell).join(','));
      lines.push('');
    }
    download(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),filename(root,'csv'));
  }
  function exportXml(root){
    const sets=collect(root);if(!sets.length)return;
    let xml='<?xml version="1.0" encoding="UTF-8"?>\n<stockHunterExport version="'+VERSION+'" generated="'+escXml(new Date().toISOString())+'">';
    for(const s of sets){
      xml+='\n  <dataset name="'+escXml(s.name)+'">';
      for(const row of s.rows){
        xml+='\n    <row>'+row.map((v,i)=>'<cell index="'+(i+1)+'" type="'+(typeof v==='number'?'number':'text')+'">'+escXml(v)+'</cell>').join('')+'</row>';
      }
      xml+='\n  </dataset>';
    }
    xml+='\n</stockHunterExport>';
    download(new Blob([xml],{type:'application/xml;charset=utf-8'}),filename(root,'xml'));
  }
  function ensureXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(window.__stockHunterXlsxPromise)return window.__stockHunterXlsxPromise;
    window.__stockHunterXlsxPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('کتابخانه اکسل بارگذاری نشد'));
      s.onerror=()=>reject(new Error('دسترسی به کتابخانه اکسل برقرار نشد'));
      document.head.appendChild(s);
    });
    return window.__stockHunterXlsxPromise;
  }
  async function exportXlsx(root){
    const sets=collect(root);if(!sets.length)return;
    try{
      const XLSX=await ensureXlsx(),wb=XLSX.utils.book_new(),used=new Set();
      for(const s of sets){
        const ws=XLSX.utils.aoa_to_sheet(s.rows);
        ws['!cols']=s.rows[0]?.map((_,i)=>({wch:Math.min(42,Math.max(10,...s.rows.slice(0,80).map(r=>clean(r[i]).length+2)))}))||[];
        XLSX.utils.book_append_sheet(wb,ws,uniqueSheetName(s.name,used));
      }
      XLSX.writeFile(wb,filename(root,'xlsx'),{compression:true});
    }catch(e){
      console.error(e);alert('ساخت فایل XLSX ممکن نشد. خروجی CSV و XML همچنان در دسترس است.');
    }
  }
  function injectStyle(){
    if(document.getElementById('stockHunterExportStyleV418'))return;
    const s=document.createElement('style');s.id='stockHunterExportStyleV418';s.textContent=`
      .data-export-toolbar-v418{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin:8px 0;padding:7px 9px;border:1px solid #3b4651;border-radius:10px;background:linear-gradient(135deg,rgba(45,58,70,.78),rgba(24,29,34,.78));direction:rtl}
      .data-export-toolbar-v418>span{margin-left:auto;font-size:10px;font-weight:800;color:#d6dde4}
      .data-export-toolbar-v418 button{min-width:54px;border:1px solid #536879!important;border-radius:8px!important;background:#1d2c38!important;color:#eef7ff!important;padding:6px 9px!important;font-size:10px!important;font-weight:800!important;cursor:pointer!important;box-shadow:0 3px 12px rgba(0,0,0,.16)}
      .data-export-toolbar-v418 button[data-export-xlsx]{border-color:#3b8b62!important;color:#a9efc7!important;background:#153326!important}
      .data-export-toolbar-v418 button[data-export-csv]{border-color:#b18a3e!important;color:#ffe1a0!important;background:#352c18!important}
      .data-export-toolbar-v418 button[data-export-xml]{border-color:#6e62a9!important;color:#d7ceff!important;background:#27223d!important}
      .data-export-toolbar-v418 button:hover{transform:translateY(-1px);filter:brightness(1.14)}
      .summary-export-v418{grid-column:1/-1!important}
      .detail-actions>.data-export-toolbar-v418{margin:0;padding:4px 6px;background:transparent;border-color:#35404a}
      .detail-actions>.data-export-toolbar-v418>span{display:none}.detail-actions>.data-export-toolbar-v418 button{min-width:45px;padding:5px 7px!important}
      @media(max-width:760px){.data-export-toolbar-v418{justify-content:center}.data-export-toolbar-v418>span{width:100%;margin:0;text-align:center}.data-export-toolbar-v418 button{flex:1 1 72px}}
      @media print{.data-export-toolbar-v418{display:none!important}}
    `;document.head.appendChild(s);
  }
  function addToolbar(root,mode='section'){
    if(!root||root.dataset.exportReadyV418==='1')return;
    if(!hasDigit(root.innerText||root.textContent||'')&&!root.querySelector('table'))return;
    root.dataset.exportReadyV418='1';
    const bar=document.createElement('div');bar.className='data-export-toolbar-v418 '+(mode==='summary'?'summary-export-v418':'');
    bar.innerHTML='<span>خروجی داده</span><button type="button" data-export-xlsx>XLSX</button><button type="button" data-export-csv>CSV</button><button type="button" data-export-xml>XML</button>';
    bar.querySelector('[data-export-xlsx]').onclick=e=>{e.stopPropagation();exportXlsx(root);};
    bar.querySelector('[data-export-csv]').onclick=e=>{e.stopPropagation();exportCsv(root);};
    bar.querySelector('[data-export-xml]').onclick=e=>{e.stopPropagation();exportXml(root);};
    if(mode==='before'){
      root.insertAdjacentElement('beforebegin',bar);
    }else if(mode==='detail'){
      const head=root.querySelector('.detail-actions');if(head)head.prepend(bar);else root.prepend(bar);
    }else if(mode==='summary'){
      root.prepend(bar);
    }else{
      const anchor=root.querySelector(':scope > .panel-title-row,:scope > .saved-head,:scope > h2,:scope > h3');
      if(anchor)anchor.insertAdjacentElement('afterend',bar);else root.prepend(bar);
    }
  }
  function wire(){
    document.querySelectorAll('.panel').forEach(x=>addToolbar(x));
    document.querySelectorAll('.cards,.perf-cards,.summary-row,.health-grid,.retention-grid').forEach(x=>{
      if(!x.closest('.panel'))addToolbar(x,'summary');
    });
    document.querySelectorAll('section').forEach(x=>{
      if(x.classList.contains('panel')||x.classList.contains('table-panel'))return;
      if(x.querySelector('table'))addToolbar(x);
    });
    const tablePanel=document.querySelector('.table-panel');if(tablePanel)addToolbar(tablePanel,'before');
    const detail=document.getElementById('detailDialog');if(detail&&visible(detail))addToolbar(detail,'detail');
  }
  window.StockHunterExportV418={version:VERSION,collect,exportXlsx,exportCsv,exportXml,wire};
  injectStyle();wire();
  let scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;wire();});}).observe(document.body,{childList:true,subtree:true,characterData:true});
})();