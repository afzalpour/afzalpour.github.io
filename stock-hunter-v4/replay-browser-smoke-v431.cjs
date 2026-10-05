'use strict';
const { chromium }=require('playwright');
const BASE=String(process.env.BASE_URL||'https://afzalpour.github.io/stock-hunter').replace(/\/$/,'');
const minSymbols=Number(process.env.MIN_REPLAY_SYMBOLS||3000);
async function check(page,path,label){
  const url=BASE+path+(path.includes('?')?'&':'?')+'smoke='+Date.now();
  const errors=[];
  page.removeAllListeners('console');
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>{
    const s=document.getElementById('researchStatus');
    const sel=document.getElementById('replaySymbol');
    return s&&sel&&s.dataset.state!=='warn';
  },null,{timeout:60000});
  const state=await page.locator('#researchStatus').getAttribute('data-state');
  const status=String(await page.locator('#researchStatus').textContent()||'').trim();
  const count=await page.locator('#replaySymbol option').count();
  const mode=await page.evaluate(()=>window.STOCK_HUNTER_REPLAY_CATALOG_V431?.mode||null);
  if(state!=='ok')throw new Error(label+': researchStatus='+state+' · '+status);
  if(/ناموفق|خطا|۵۰۰|500/i.test(status))throw new Error(label+': error status text · '+status);
  if(count<minSymbols)throw new Error(label+': replay symbol options '+count+' < '+minSymbols);
  if(mode!=='PAGINATED_REST')throw new Error(label+': resilient catalog mode missing: '+mode);
  if(errors.some(x=>/REPLAY_CATALOG_V431_FAILED|خطای دریافت کاتالوگ|status.?500/i.test(x)))throw new Error(label+': console replay error · '+errors.join(' | '));

  await page.waitForFunction(()=>Number(document.getElementById('replaySlider')?.max||0)>0&&document.querySelector('#replayChart svg'),null,{timeout:60000});
  await page.locator('#replayChart').scrollIntoViewIfNeeded();
  const startY=await page.evaluate(()=>window.scrollY);
  await page.locator('#replayPlay').click();
  await page.waitForFunction(()=>Number(document.getElementById('replaySlider')?.value||0)>0,null,{timeout:15000});
  await page.waitForTimeout(1100);
  const visual=await page.evaluate(()=>{
    const seg=document.querySelector('#replayChart .chart-segment');
    const label=document.querySelector('#replayChart .chart-label');
    const chart=document.getElementById('replayChart');
    const v433=window.STOCK_HUNTER_REPLAY_VISUAL_V433||null,v432=window.STOCK_HUNTER_REPLAY_VISUAL_V432||null;
    return {
      version:v433?.version||v432?.version||null,
      page_scroll_lock:v432?.page_scroll_lock||null,
      chart_mode:v433?.chart_mode||v432?.chart_mode||null,
      axis_mode:v433?.axis_mode||null,
      time_scale:v433?.time_scale||null,
      scroll_y:window.scrollY,
      slider_value:Number(document.getElementById('replaySlider')?.value||0),
      segment_count:document.querySelectorAll('#replayChart .chart-segment').length,
      stroke_width:seg?parseFloat(getComputedStyle(seg).strokeWidth):0,
      label_font_size:label?parseFloat(getComputedStyle(label).fontSize):0,
      chart_height:chart?chart.getBoundingClientRect().height:0,
      legend_count:document.querySelectorAll('.replay-legend span').length
    };
  });
  if(await page.locator('#replayPlay').getAttribute('class').then(x=>String(x||'').includes('active')))await page.locator('#replayPlay').click();
  if(!['4.3.2','4.3.3'].includes(visual.version))throw new Error(label+': visual layer missing '+JSON.stringify(visual));
  if(visual.page_scroll_lock!=='TABLE_INTERNAL_ONLY'||visual.chart_mode!=='PROGRESSIVE_SIGN_SEGMENTS')throw new Error(label+': visual contract mismatch '+JSON.stringify(visual));
  if(visual.version==='4.3.3'&&(visual.axis_mode!=='RESERVED_GUTTER'||visual.time_scale!=='ACTUAL_SESSION_TIME'))throw new Error(label+': v4.3.3 axis/session contract mismatch '+JSON.stringify(visual));
  if(Math.abs(visual.scroll_y-startY)>4)throw new Error(label+': page moved during replay start='+startY+' end='+visual.scroll_y);
  if(visual.segment_count<1||visual.slider_value<1)throw new Error(label+': progressive chart did not advance '+JSON.stringify(visual));
  if(visual.stroke_width<3.5)throw new Error(label+': trend line too thin '+visual.stroke_width);
  if(visual.label_font_size<11)throw new Error(label+': chart labels too small '+visual.label_font_size);
  if(visual.chart_height<250||visual.legend_count!==3)throw new Error(label+': replay chart layout incomplete '+JSON.stringify(visual));
  console.log(JSON.stringify({label,url,state,status,option_count:count,catalog_mode:mode,visual}));
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const page=await browser.newPage({locale:'fa-IR',viewport:{width:1366,height:900}});
   await check(page,'/replay/','clean-route');
   await check(page,'/market-replay-v416.html','legacy-route');
   console.log('stock-hunter-replay-public-browser-v433: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
