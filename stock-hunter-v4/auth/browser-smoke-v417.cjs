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

async function waitProfileReady(page){
  await page.waitForURL(/profile-v417\.html(?:$|[?#])/, {timeout:30000});
  await page.locator('#profilePage').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>{
    const title=document.getElementById('profileDisplayTitle');
    const role=document.getElementById('profileRole');
    const status=document.getElementById('profileStatus');
    return title && title.textContent && title.textContent!=='کاربر شکارچی سهم' &&
      role && role.textContent && status && status.textContent==='active';
  },null,{timeout:20000});
}

async function waitSynced(page){
  await page.waitForFunction(()=>{
    const el=document.getElementById('personalSaveStateV417');
    return el && el.dataset.state==='ok' && /همگام/.test(el.textContent||'');
  },null,{timeout:15000});
}

async function assertStandaloneScroll(page,path){
  await page.goto(BASE_URL+'/'+path,{waitUntil:'domcontentloaded',timeout:30000});
  const state=await page.evaluate(()=>({
    htmlOverflowY:getComputedStyle(document.documentElement).overflowY,
    bodyOverflowY:getComputedStyle(document.body).overflowY,
    scrollHeight:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),
    viewportHeight:window.innerHeight
  }));
  assert.notEqual(state.htmlOverflowY,'hidden',path+' html overflow must allow vertical scrolling');
  assert.notEqual(state.bodyOverflowY,'hidden',path+' body overflow must allow vertical scrolling');
  assert.ok(state.scrollHeight>state.viewportHeight+40,path+' must have scrollable document height');
  await page.evaluate(()=>window.scrollTo(0,Math.min(500,Math.max(1,document.documentElement.scrollHeight-window.innerHeight))));
  await page.waitForTimeout(120);
  assert.ok(await page.evaluate(()=>window.scrollY>0),path+' must actually scroll in Chromium');
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
    await page.setViewportSize({width:1280,height:600});
    await assertStandaloneScroll(page,'performance.html');
    const performanceContract=await page.evaluate(()=>({
      jalali:typeof perfJalaliDateV416==='function'?perfJalaliDateV416('2026-09-25'):null,
      background:getComputedStyle(document.body).backgroundColor,
      neutralTheme:!!document.querySelector('link[href*="neutral-theme-v416.css"]')
    }));
    assert.equal(performanceContract.jalali,'1405/07/03','performance trade date must render in Jalali calendar');
    assert.equal(performanceContract.neutralTheme,true,'performance must load neutral gray theme');
    assert.equal(performanceContract.background,'rgb(17, 19, 21)','performance background must be neutral gray');

    await assertStandaloneScroll(page,'calibration.html');
    const calibrationTheme=await page.evaluate(()=>({
      background:getComputedStyle(document.body).backgroundColor,
      neutralTheme:!!document.querySelector('link[href*="neutral-theme-v416.css"]')
    }));
    assert.equal(calibrationTheme.neutralTheme,true,'calibration must load neutral gray theme');
    assert.equal(calibrationTheme.background,'rgb(17, 19, 21)','calibration background must be neutral gray');
    await page.setViewportSize({width:1440,height:1000});

    await page.goto(BASE_URL+'/index.html',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>typeof forecastFibonacci==='function'&&typeof forecastModels==='function'&&typeof marketFaDateTimeV416==='function',null,{timeout:10000});
    const forecastContract=await page.evaluate(()=>({
      fibonacciType:typeof forecastFibonacci,
      keys:forecastModels({candles:[],last:0}).map(m=>m.key),
      marketDateTime:marketFaDateTimeV416('2026-09-25T04:45:23Z'),
      feedSources:marketBaseCandidatesV416().map(x=>x.source),
      neutralTheme:!!document.querySelector('link[href*="neutral-theme-v416.css"]'),
      background:getComputedStyle(document.body).backgroundColor
    }));
    assert.equal(forecastContract.fibonacciType,'function','Fibonacci model must be loaded');
    assert.deepEqual(forecastContract.keys,['ichi','gann','fib','boll','macd','obv'],'forecastModels must expose exactly six diagnostic models');
    assert.equal(forecastContract.marketDateTime,'1405/07/03 ساعت 08:15:23','market status timestamp must use Jalali date and Tehran time');
    assert.deepEqual(forecastContract.feedSources,['supabase'],'public production feed must use Supabase only; stale localhost fallback is disabled');
    await page.waitForFunction(()=>{
      const s=document.getElementById('scanTimes');
      return s && /مسیر اصلی/.test(s.textContent||'') && /14\d{2}\/\d{2}\/\d{2}/.test(s.textContent||'');
    },null,{timeout:30000});
    const liveFeedText=((await page.locator('#scanTimes').textContent())||'').trim();
    assert.match(liveFeedText,/مسیر اصلی/,'published page must use primary Supabase feed');
    assert.match(liveFeedText,/14\d{2}\/\d{2}\/\d{2} ساعت \d{2}:\d{2}:\d{2}/,'published market status must show Jalali date and HH:MM:SS');
    assert.doesNotMatch(liveFeedText,/بازارهای فعال:/,'market status copy must remain compact');
    assert.equal(forecastContract.neutralTheme,true,'main page must load neutral gray theme');
    assert.equal(forecastContract.background,'rgb(17, 19, 21)','main background must be neutral gray');

    await page.setViewportSize({width:1280,height:640});
    const mainLayout=await page.evaluate(()=>({
      bodyOverflowY:getComputedStyle(document.body).overflowY,
      tableOverflowY:getComputedStyle(document.querySelector('.table-wrap')).overflowY,
      tablePanelHeight:getComputedStyle(document.querySelector('.table-panel')).height,
      activeFilterIncludesEarly:String(filtered).includes('isRadarEarlyV416'),
      validationInjected:String(detailHTML).includes('forecast-validation-gate-v430')
    }));
    assert.notEqual(mainLayout.bodyOverflowY,'hidden','main identification page must not lock vertical scrolling');
    assert.equal(mainLayout.tableOverflowY,'auto','hunt table must keep its own vertical scrolling');
    assert.notEqual(mainLayout.tablePanelHeight,'0px','hunt table panel must retain visible height');
    assert.equal(mainLayout.activeFilterIncludesEarly,true,'default active-hunt filter must include early hunts');
    assert.equal(mainLayout.validationInjected,false,'forecast validation gate must not be injected into end-user details');
    await page.setViewportSize({width:1440,height:1000});

    const printContract=await page.evaluate(()=>{
      const candles=Array.from({length:60},(_,i)=>({t:Math.floor(Date.UTC(2026,6,1+i)/1000),open:1000+i*3,high:1020+i*3,low:980+i*3,close:1005+i*3,volume:100000+i*1000}));
      let captured='';
      const oldOpen=window.open;
      window.open=()=>({document:{write:s=>{captured+=String(s)},close:()=>{}}});
      try{
        currentDetail={id:'print-smoke',symbol:'TEST',company:'نماد آزمایشی',analyzed:false,last:1182,close:1182,yesterday:1179,candles,snapshots:[]};
        printDetail();
      }finally{
        window.open=oldOpen;
        currentDetail=null;
      }
      return {
        hasDailyReport:captured.includes('گزارش روزانه'),
        hasPdfLabel:captured.includes('چاپ / ذخیره PDF'),
        hasSixModels:captured.includes('شش سناریوی تشخیصی ۱۰ روز کاری')
      };
    });
    assert.equal(printContract.hasDailyReport,true,'daily-only detail must generate printable report');
    assert.equal(printContract.hasPdfLabel,true,'print report must expose PDF save label');
    assert.equal(printContract.hasSixModels,true,'daily-only PDF must include six diagnostic models');
    const accountLink=page.locator('a.top-link[href="profile-v417.html"]');
    await accountLink.waitFor({state:'visible',timeout:10000});
    await Promise.all([
      page.waitForURL(/auth-v417\.html\?next=profile-v417\.html/, {timeout:20000}),
      accountLink.click()
    ]);

    assert.equal(await page.locator('#displayNameWrap').isHidden(),true,'sign-in must hide display name');
    assert.equal(await page.locator('#confirmPasswordWrap').isHidden(),true,'sign-in must hide confirm password');
    assert.equal(await page.locator('#newPasswordWrap').isHidden(),true,'sign-in must hide reset/new-password field');
    assert.equal(await page.locator('#email').isVisible(),true,'sign-in must show email');
    assert.equal(await page.locator('#password').isVisible(),true,'sign-in must show password');
    assert.equal(await page.locator('[data-password-toggle="password"]').isVisible(),true,'sign-in password eye must be visible');
    assert.equal(await page.locator('#password').getAttribute('type'),'password');
    await page.click('[data-password-toggle="password"]');
    assert.equal(await page.locator('#password').getAttribute('type'),'text','password eye must reveal password');
    assert.equal(await page.locator('[data-password-toggle="password"]').getAttribute('aria-pressed'),'true');
    await page.click('[data-password-toggle="password"]');
    assert.equal(await page.locator('#password').getAttribute('type'),'password','password eye must hide password');

    await page.click('[data-auth-tab="signup"]');
    assert.equal(await page.locator('#displayNameWrap').isVisible(),true,'signup must show display name');
    assert.equal(await page.locator('#confirmPasswordWrap').isVisible(),true,'signup must require confirm password');
    assert.equal(await page.locator('#newPasswordWrap').isHidden(),true,'signup must not show reset/new-password field');
    assert.equal(await page.locator('[data-password-toggle="confirmPassword"]').isVisible(),true,'confirm-password eye must be visible');
    await page.fill('#email','signup-check@example.invalid');
    await page.fill('#password','SignupCheck-123');
    await page.fill('#confirmPassword','SignupCheck-124');
    await page.click('#authSubmit');
    await page.locator('#authMessage').waitFor({state:'visible',timeout:5000});
    assert.match((await page.locator('#authMessage').textContent())||'',/یکسان نیستند/,'signup must reject mismatched passwords');

    await page.click('[data-auth-tab="recovery"]');
    assert.equal(await page.locator('#passwordWrap').isHidden(),true,'recovery must hide password');
    assert.equal(await page.locator('#confirmPasswordWrap').isHidden(),true,'recovery must hide confirm password');
    assert.equal(await page.locator('#newPasswordWrap').isHidden(),true,'recovery must hide new password');
    await page.fill('#email','not-an-email');
    await page.click('#authSubmit');
    await page.locator('#authMessage').waitFor({state:'visible',timeout:5000});
    assert.match((await page.locator('#authMessage').textContent())||'',/این ایمیل نامعتبر است/,'recovery must reject malformed email locally');

    await page.goto(BASE_URL+'/auth-v417.html?mode=reset&next=profile-v417.html',{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(await page.locator('#newPasswordWrap').isVisible(),true,'reset must show new password');
    assert.equal(await page.locator('#passwordWrap').isHidden(),true,'reset must hide current password');
    assert.equal(await page.locator('#confirmPasswordWrap').isHidden(),true,'reset must hide signup confirm password');
    assert.equal(await page.locator('[data-password-toggle="newPassword"]').isVisible(),true,'new-password eye must be visible');
    assert.equal(await page.locator('#newPassword').getAttribute('type'),'password');
    await page.click('[data-password-toggle="newPassword"]');
    assert.equal(await page.locator('#newPassword').getAttribute('type'),'text','new-password eye must reveal password');
    await page.click('[data-password-toggle="newPassword"]');

    await page.goto(BASE_URL+'/auth-v417.html?next=profile-v417.html',{waitUntil:'domcontentloaded',timeout:30000});
    await page.fill('#email',EMAIL);
    await page.fill('#password',PASSWORD);
    await Promise.all([
      page.waitForURL(/profile-v417\.html(?:$|[?#])/, {timeout:30000}),
      page.click('#authSubmit')
    ]);
    await waitProfileReady(page);

    assert.equal((await page.locator('#profileDisplayTitle').textContent()).trim(),'CI Browser Smoke');
    assert.equal((await page.locator('#profileRole').textContent()).trim(),'user');
    assert.equal((await page.locator('#profileStatus').textContent()).trim(),'active');
    assert.equal(await page.locator('#adminConsoleLink').isHidden(),true,'normal user profile must hide admin link');
    assert.match((await page.locator('#profileEmail').textContent())||'',/@example\.invalid$/);

    await Promise.all([
      page.waitForURL(/index-v417\.html(?:$|[?#])/, {timeout:30000}),
      page.click('a.profile-primary-link[href="index-v417.html"]')
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
      password_confirmation_and_eye_controls:true,
      malformed_recovery_email_guard:true,
      jalali_dates_and_market_timestamp:true,
      supabase_primary_feed:true,
      neutral_gray_theme:true,
      daily_pdf_print:true,
      public_account_to_own_profile:true,
      profile_to_personal_market:true,
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
