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
  console.log(JSON.stringify({label,url,state,status,option_count:count,catalog_mode:mode}));
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
   const page=await browser.newPage({locale:'fa-IR'});
   await check(page,'/replay/','clean-route');
   await check(page,'/market-replay-v416.html','legacy-route');
   console.log('stock-hunter-replay-public-browser-v431: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
