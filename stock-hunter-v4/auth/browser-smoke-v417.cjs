'use strict';

const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const BASE_URL=String(process.env.BASE_URL||'https://afzalpour.github.io/stock-hunter-v4').replace(/\/$/,'');
const EMAIL=process.env.SMOKE_EMAIL||'';
const PASSWORD=process.env.SMOKE_PASSWORD||'';
const SYMBOL_ID=process.env.SMOKE_SYMBOL_ID||'';
const SYMBOL=process.env.SMOKE_SYMBOL||'';
const RUN_ID=process.env.GITHUB_RUN_ID||'local';
const WATCHLIST_NAME='CI Browser Smoke '+RUN_ID;

function required(name,value){
  assert.ok(value,name+' is required');
}
required('SMOKE_EMAIL',EMAIL);
required('SMOKE_PASSWORD',PASSWORD);
required('SMOKE_SYMBOL_ID',SYMBOL_ID);
required('SMOKE_SYMBOL',SYMBOL);

async function waitPersonalReady(page){
  await page.waitForURL(/index-v417\.html(?:$|[?#])/, {timeout:30000});
  await page.waitForFunction(()=>{
    const gate=document.getElementById('v417AuthGate');
    return !document.body.classList.contains('v417-auth-pending') && gate && gate.hidden===true;
  },null,{timeout:30000});
  await page.locator('.personal-bar-v417').waitFor({state:'visible',timeout:10000});
  await page.locator('#personalSaveStateV417').waitFor({state:'visible'});
}

async function waitSynced(page){
  await page.waitForFunction(()=>{
    const el=document.getElementById('personalSaveStateV417');
    return el && el.dataset.state==='ok' && /همگام/.test(el.textContent||'');
  },null,{timeout:15000});
}

async function main(){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    locale:'fa-IR',
    timezoneId:'Asia/Tehran',
    viewport:{width:1440,height:1000}
  });
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e&&e.stack||e)));
  page.on('console',m=>{
    if(m.type()==='error') console.error('[browser console]',m.text());
  });

  try{
    await page.goto(BASE_URL+'/index-v417.html',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForURL(/auth-v417\.html\?next=index-v417\.html/, {timeout:20000});

    await page.fill('#email',EMAIL);
    await page.fill('#password',PASSWORD);
    await Promise.all([
      page.waitForURL(/index-v417\.html(?:$|[?#])/, {timeout:30000}),
      page.click('#authSubmit')
    ]);
    await waitPersonalReady(page);

    assert.equal((await page.locator('#personalNameV417').textContent()).trim(),'CI Browser Smoke');
    assert.equal((await page.locator('#personalRoleV417').textContent()).trim(),'کاربر');
    assert.equal(await page.locator('#personalAdminV417').isHidden(),true,'normal user admin link must stay hidden');

    await page.selectOption('#pageSize','50');
    await page.selectOption('#hunt','__all__');
    await page.selectOption('#decision',{label:'تحت نظر'});
    await waitSynced(page);

    page.once('dialog',async dialog=>{
      assert.equal(dialog.type(),'prompt');
      await dialog.accept(WATCHLIST_NAME);
    });
    await page.click('#createWatchlistV417');
    await page.waitForFunction(name=>{
      const s=document.getElementById('personalWatchlistV417');
      return s && [...s.options].some(o=>o.textContent===name) && s.options[s.selectedIndex]?.textContent===name;
    },WATCHLIST_NAME,{timeout:15000});

    await page.fill('#search',SYMBOL);
    const star=page.locator('button.personal-star-v417[data-watch-id="'+SYMBOL_ID+'"]').first();
    await star.waitFor({state:'visible',timeout:30000});
    assert.equal(await star.getAttribute('class').then(v=>String(v).includes('saved')),false);
    await star.click();
    await page.waitForFunction(id=>{
      const x=document.querySelector('button.personal-star-v417[data-watch-id="'+id+'"]');
      return x && x.classList.contains('saved');
    },SYMBOL_ID,{timeout:15000});
    await page.waitForFunction(()=>{
      const x=document.getElementById('watchlistCountV417');
      return x && !/^۰\s/.test((x.textContent||'').trim());
    },null,{timeout:10000});

    await page.click('#watchlistOnlyV417');
    assert.equal(await page.locator('#watchlistOnlyV417').getAttribute('aria-pressed'),'true');
    await star.waitFor({state:'visible'});

    await page.reload({waitUntil:'domcontentloaded',timeout:30000});
    await waitPersonalReady(page);
    assert.equal(await page.locator('#pageSize').inputValue(),'50');
    assert.equal(await page.locator('#hunt').inputValue(),'__all__');
    assert.equal(await page.locator('#decision').inputValue(),'تحت نظر');
    await page.waitForFunction(name=>{
      const s=document.getElementById('personalWatchlistV417');
      return s && [...s.options].some(o=>o.textContent===name);
    },WATCHLIST_NAME,{timeout:15000});

    await page.fill('#search',SYMBOL);
    const persistedStar=page.locator('button.personal-star-v417[data-watch-id="'+SYMBOL_ID+'"]').first();
    await persistedStar.waitFor({state:'visible',timeout:30000});
    assert.equal(String(await persistedStar.getAttribute('class')).includes('saved'),true,'watchlist item must persist after reload');

    await page.goto(BASE_URL+'/admin-v417.html',{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#adminMessage').waitFor({state:'visible',timeout:20000});
    assert.match((await page.locator('#adminMessage').textContent())||'',/دسترسی مدیریتی ندارد/);
    assert.equal(await page.locator('#adminGrid').isHidden(),true,'normal user must not receive admin console');

    await page.goto(BASE_URL+'/index-v417.html',{waitUntil:'domcontentloaded',timeout:30000});
    await waitPersonalReady(page);
    await page.selectOption('#hunt','__all__');
    await page.fill('#search',SYMBOL);
    const removeStar=page.locator('button.personal-star-v417[data-watch-id="'+SYMBOL_ID+'"]').first();
    await removeStar.waitFor({state:'visible',timeout:30000});
    assert.equal(String(await removeStar.getAttribute('class')).includes('saved'),true);
    await removeStar.click();
    await page.waitForFunction(id=>{
      const x=document.querySelector('button.personal-star-v417[data-watch-id="'+id+'"]');
      return x && !x.classList.contains('saved');
    },SYMBOL_ID,{timeout:15000});

    await Promise.all([
      page.waitForURL(/auth-v417\.html(?:$|[?#])/, {timeout:20000}),
      page.click('#personalSignOutV417')
    ]);
    await page.locator('#authForm').waitFor({state:'visible',timeout:10000});
    assert.equal(await page.locator('#alreadySignedIn').isHidden(),true,'signed-out session must not remain active');

    const relevantErrors=pageErrors.filter(x=>/app-personal-v417|Cannot (read|set)|null|undefined/i.test(x));
    assert.deepEqual(relevantErrors,[], 'unexpected browser page errors: '+relevantErrors.join(' | '));

    console.log(JSON.stringify({
      result:'stock-hunter-v417-authenticated-browser-smoke: PASS',
      preference_persistence:true,
      watchlist_create_add_reload_remove:true,
      admin_isolation:true,
      logout:true
    }));
  }finally{
    await context.close();
    await browser.close();
  }
}

main().catch(err=>{
  console.error(err&&err.stack||err);
  process.exit(1);
});
