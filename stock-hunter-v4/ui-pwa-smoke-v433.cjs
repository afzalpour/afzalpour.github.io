'use strict';
const {chromium}=require('playwright');
const BASE=String(process.env.BASE_URL||'https://afzalpour.github.io/stock-hunter').replace(/\/$/,'');
function fail(msg,data){throw new Error(msg+(data?' '+JSON.stringify(data):''));}
function localSeconds(iso){const d=new Date(iso),p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d),g=t=>Number(p.find(x=>x.type===t)?.value||0);return g('hour')*3600+g('minute')*60+g('second');}
(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'fa-IR',viewport:{width:1440,height:960}});
  const page=await context.newPage();
  try{
    await page.goto(BASE+'/index.html?smoke433='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.STOCK_HUNTER_PWA_V433?.version==='4.3.3-pwa1',null,{timeout:30000});
    await page.waitForSelector('.ux-grouped-nav-v421 details',{timeout:30000});
    const first=page.locator('.ux-grouped-nav-v421 details').first();await first.click();
    const nav=await page.evaluate(()=>{const summary=document.querySelector('.ux-grouped-nav-v421 details summary'),menu=document.querySelector('.ux-grouped-nav-menu-v421'),a=menu?.querySelector('a'),cs=x=>x?getComputedStyle(x):null;return {summary_font:parseFloat(cs(summary)?.fontSize||0),link_font:parseFloat(cs(a)?.fontSize||0),menu_bg:cs(menu)?.backgroundColor||'',link_color:cs(a)?.color||'',menu_width:menu?.getBoundingClientRect().width||0};});
    if(nav.summary_font<12||nav.link_font<13||nav.menu_width<250||/rgba\(0, 0, 0, 0\)/.test(nav.menu_bg))fail('grouped navigation readability contract failed',nav);
    const manifest=await page.evaluate(async()=>await (await fetch(new URL('manifest.webmanifest',location.href))).json());
    if(manifest.display!=='standalone'||!Array.isArray(manifest.icons)||manifest.icons.length<2||!Array.isArray(manifest.shortcuts)||manifest.shortcuts.length<4)fail('manifest contract failed',manifest);
    const sw=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return {scope:reg.scope,active:reg.active?.state||null,pwa:window.STOCK_HUNTER_PWA_V433?.version||null};});
    if(!sw.scope.endsWith('/stock-hunter/')||sw.active!=='activated')fail('service worker not active',sw);
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:30000});

    await page.goto(BASE+'/replay/?smoke433='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.getElementById('researchStatus')?.dataset.state!=='warn'&&document.querySelectorAll('#replaySymbol option').length>3000,null,{timeout:60000});
    const shafam=await page.locator('#replaySymbol option').evaluateAll(opts=>{const o=opts.find(x=>String(x.textContent||'').trim().startsWith('شفام'));return o?.value||null;});
    if(!shafam)fail('شفام not found in replay catalog');
    await page.selectOption('#replaySymbol',shafam);
    await page.waitForFunction(()=>window.STOCK_HUNTER_REPLAY_SESSION_V433?.current?.symbol==='شفام'&&window.STOCK_HUNTER_REPLAY_SESSION_V433.current.kept_rows>1,null,{timeout:60000});
    const replay=await page.evaluate(()=>{
      const s=window.STOCK_HUNTER_REPLAY_SESSION_V433.current,v=window.STOCK_HUNTER_REPLAY_VISUAL_V433;
      const labels=[...document.querySelectorAll('#replayChart .axis-label')],axis=document.querySelector('#replayChart .chart-y-axis');
      return {session:s,visual:v,axis_x:axis?Number(axis.getAttribute('x1')):0,label_x:labels.map(x=>Number(x.getAttribute('x'))),label_font:labels[0]?parseFloat(getComputedStyle(labels[0]).fontSize):0,label_count:labels.length,times:replayRows.map(x=>x.bucket_at)};
    });
    if(replay.session.profile!=='EQUITY'||replay.session.start_minute!==540||replay.session.end_minute!==750)fail('شفام session profile wrong',replay);
    if(!(replay.session.removed_rows>0&&replay.session.raw_rows>replay.session.kept_rows))fail('pre/post market rows were not clipped',replay.session);
    if(replay.visual?.axis_mode!=='RESERVED_GUTTER'||replay.visual?.time_scale!=='ACTUAL_SESSION_TIME'||replay.axis_x!==96||replay.label_font<13||replay.label_count<2||replay.label_x.some(x=>x<60||x>=96))fail('Y axis readability contract failed',replay);
    if(replay.times.some(t=>{const s=localSeconds(t);return s<9*3600||s>12*3600+30*60;}))fail('شفام contains samples outside 09:00-12:30',replay.times);

    await page.goto(BASE+'/index.html?offline-prep='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.STOCK_HUNTER_PWA_V433?.version==='4.3.3-pwa1'&&navigator.serviceWorker.controller!==null,null,{timeout:30000});
    await page.waitForTimeout(800);
    await context.setOffline(true);
    await page.goto(BASE+'/offline.html',{waitUntil:'domcontentloaded',timeout:30000});
    const offlineText=String(await page.locator('body').textContent()||'');
    if(!offlineText.includes('شکارچی سهم آفلاین است')||!offlineText.includes('هیچ داده ساختگی'))fail('offline fallback contract failed');
    await context.setOffline(false);
    console.log(JSON.stringify({nav,sw,manifest:{display:manifest.display,icons:manifest.icons.length,shortcuts:manifest.shortcuts.length},replay:{symbol:replay.session.symbol,profile:replay.session.profile,start:replay.session.start_label,end:replay.session.end_label,raw:replay.session.raw_rows,kept:replay.session.kept_rows,removed:replay.session.removed_rows,axis_x:replay.axis_x,label_font:replay.label_font,time_scale:replay.visual.time_scale},offline:'PASS'}));
    console.log('stock-hunter-ui-pwa-v433: PASS');
  }finally{await context.setOffline(false).catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
