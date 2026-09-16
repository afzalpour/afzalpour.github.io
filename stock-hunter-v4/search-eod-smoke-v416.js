'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');

global.rows=[
  {id:'1',symbol:'فملی',company:'ملی صنایع مس ایران',analyzed:true,market:'بورس',assetType:'سهام / سایر',updated:'2026-09-16T08:30:00Z'},
  {id:'2',symbol:'وبملت',company:'بانک ملت',analyzed:true,market:'بورس',assetType:'سهام / سایر',updated:'2026-09-16T08:31:00Z'}
];
global.filtered=()=>[];global.updateSummary=()=>{};global.cfg={};global.headers=()=>({});global.render=()=>{};global.page=1;
global.normUniverse=(r,m)=>m.get(String(r.ins_code))||({id:String(r.ins_code),symbol:r.symbol,company:r.company_name,analyzed:false});
let controls={search:{value:'',textContent:''},hunt:{value:'',textContent:''},decision:{value:'',textContent:''},specialCount:{textContent:''},urgentCount:{textContent:''},buyCount:{textContent:''},topSymbol:{textContent:''},topMeta:{textContent:''},mobileList:{innerHTML:''}};
global.$=id=>controls[id]||{value:'',textContent:'',innerHTML:'',addEventListener:()=>{}};
global.cell=(k,x)=>k==='symbol'?String(x.symbol||''):'';global.renderMobile=()=>{};global.hc=v=>v==='شکار ویژه'?'special':v==='هشدار فوری'?'urgent':'watch';global.dc=()=>'';global.esc=s=>String(s??'');

const searchSrc=fs.readFileSync(__dirname+'/app-universal-search-v416.js','utf8');
vm.runInThisContext(searchSrc+'\n;globalThis.__searchV416={normalizeSearchV416,matchesUniversalSearchV416,universalRowsV416};');
assert(__searchV416.matchesUniversalSearchV416({symbol:'فملی',company_name:'ملی صنایع مس'},'فملی'));
assert(__searchV416.matchesUniversalSearchV416({symbol:'فملی',company_name:'ملی صنایع مس'},'ملي صنايع'));
assert.equal(__searchV416.universalRowsV416('ملت').length,1);
assert.equal(__searchV416.universalRowsV416('ملت')[0].symbol,'وبملت');

const noonTehran=Math.floor(Date.parse('2026-09-16T08:30:00Z')/1000);
const after17Tehran=Math.floor(Date.parse('2026-09-16T14:00:00Z')/1000);
global.tehranClockV413=()=>({wd:'Wed',hm:18*60,ymd:'2026-09-16'});
global.tehranYmdFromTsV413=()=> '2026-09-16';
global.todayTradeEvidenceV413=x=>x.tradeTs||0;
global.assetSessionV413=()=>({tradeStart:9*60,end:12*60+30});
global.sessionPhaseV413=()=>({phase:'closed'});
global.minutesLeftV416=()=>0;
global.applyHuntV416=x=>x;
global.fa=v=>String(Math.round(Number(v)||0));
rows=[
  {id:'1',symbol:'A',company:'A',tradeTs:noonTehran,volume:100,dayChangeV416:.2,hunt:'عادی',decision:'عدم ورود',huntScoreV416:40,todayOpportunityV416:45,fast:40,huntModeLabelV416:'شتاب مثبت',analyzed:true},
  {id:'2',symbol:'B',company:'B',tradeTs:noonTehran,volume:100,dayChangeV416:-.3,hunt:'هشدار فوری',decision:'ورود اولیه',huntScoreV416:75,todayOpportunityV416:80,fast:70,huntModeLabelV416:'برگشت منفی',analyzed:true},
  {id:'3',symbol:'C',company:'C',tradeTs:noonTehran,volume:100,dayChangeV416:.1,hunt:'شکار زودهنگام',decision:'',huntScoreV416:65,todayOpportunityV416:70,fast:60,huntModeLabelV416:'شتاب مثبت',analyzed:true},
  {id:'4',symbol:'D',company:'D',tradeTs:after17Tehran,volume:100,dayChangeV416:.1,hunt:'شکار ویژه',decision:'',huntScoreV416:95,todayOpportunityV416:95,fast:90,huntModeLabelV416:'شتاب مثبت',analyzed:true}
];
const eodSrc=fs.readFileSync(__dirname+'/app-eod-v416.js','utf8');
vm.runInThisContext(eodSrc+'\n;globalThis.__eodV416={isEndOfDayV416,hadActivity9to17V416,endOfDayPoolV416,persistentEndOfDayPoolV416,setArchive:(a)=>{persistentEodArchiveV416=a;persistentEodArchiveReadyV416=true;persistentEodArchiveDateV416=\'2026-09-16\';}};');
assert.equal(__eodV416.isEndOfDayV416(),true);
assert.equal(__eodV416.hadActivity9to17V416(rows[0]),true);
assert.equal(__eodV416.hadActivity9to17V416(rows[3]),false);
assert.equal(minutesLeftV416(rows[0]),30,'after close, feasibility clock should use last valid equity-session activity');

// Persistent archive must keep a symbol that was Special earlier even if its current live state is now normal.
__eodV416.setArchive([
  {symbol_id:'1',symbol:'A',company_name:'A',first_seen_at:'2026-09-16T06:00:00Z',last_seen_at:'2026-09-16T07:00:00Z',peak_seen_at:'2026-09-16T06:30:00Z',peak_state:'شکار ویژه',sample_count:5,peak_score:88,peak_today_opportunity:90,peak_day_change:.4,peak_mode:'acceleration',peak_decision:'ورود قوی',engine_version:'4.1.6-hunt-v2'},
  {symbol_id:'2',symbol:'B',company_name:'B',first_seen_at:'2026-09-16T07:30:00Z',last_seen_at:'2026-09-16T08:00:00Z',peak_seen_at:'2026-09-16T07:45:00Z',peak_state:'هشدار فوری',sample_count:3,peak_score:73,peak_today_opportunity:79,peak_day_change:-.2,peak_mode:'reversal',peak_decision:'ورود اولیه',engine_version:'4.1.6-hunt-v2'}
]);
const out=filtered();
assert.deepEqual(out.map(x=>x.symbol),['A','B']);
assert.equal(out[0].hunt,'شکار ویژه');
assert.equal(out[0].huntScoreV416,88);
assert.equal(out[0].eodSampleCountV416,5);
assert(cell('hunt',out[0]).includes('ثبت پایدار روزانه'));
updateSummary();
assert.equal(controls.specialCount.textContent,'۱');
assert.equal(controls.urgentCount.textContent,'۱');
assert.equal(controls.topSymbol.textContent,'A');
console.log('search-eod-v416 smoke: PASS');
