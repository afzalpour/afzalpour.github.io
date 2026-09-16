'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');

global.rows=[
  {id:'1',symbol:'فملی',company:'ملی صنایع مس ایران',analyzed:true,market:'بورس',assetType:'سهام / سایر',updated:'2026-09-16T08:30:00Z'},
  {id:'2',symbol:'وبملت',company:'بانک ملت',analyzed:true,market:'بورس',assetType:'سهام / سایر',updated:'2026-09-16T08:31:00Z'}
];
global.filtered=()=>[];global.updateSummary=()=>{};global.cfg={};global.headers=()=>({});global.render=()=>{};global.page=1;
global.setTimeout=()=>0;global.setInterval=()=>0;
global.normUniverse=(r,m)=>m.get(String(r.ins_code))||({id:String(r.ins_code),symbol:r.symbol,company:r.company_name,analyzed:false});
let controls={search:{value:'',textContent:''},hunt:{value:'',textContent:''},decision:{value:'',textContent:''},specialCount:{textContent:''},urgentCount:{textContent:''},buyCount:{textContent:''},topSymbol:{textContent:''},topMeta:{textContent:''}};
global.$=id=>controls[id]||{value:'',textContent:'',addEventListener:()=>{}};

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
  {id:'1',symbol:'A',company:'A',tradeTs:noonTehran,volume:100,dayChangeV416:.2,hunt:'شکار ویژه',decision:'',huntScoreV416:90,todayOpportunityV416:90,fast:80,huntModeLabelV416:'شتاب مثبت'},
  {id:'2',symbol:'B',company:'B',tradeTs:noonTehran,volume:100,dayChangeV416:-.3,hunt:'هشدار فوری',decision:'',huntScoreV416:75,todayOpportunityV416:80,fast:70,huntModeLabelV416:'برگشت منفی'},
  {id:'3',symbol:'C',company:'C',tradeTs:noonTehran,volume:100,dayChangeV416:.1,hunt:'شکار زودهنگام',decision:'',huntScoreV416:65,todayOpportunityV416:70,fast:60,huntModeLabelV416:'شتاب مثبت'},
  {id:'4',symbol:'D',company:'D',tradeTs:after17Tehran,volume:100,dayChangeV416:.1,hunt:'شکار ویژه',decision:'',huntScoreV416:95,todayOpportunityV416:95,fast:90,huntModeLabelV416:'شتاب مثبت'}
];
const eodSrc=fs.readFileSync(__dirname+'/app-eod-v416.js','utf8');
vm.runInThisContext(eodSrc+'\n;globalThis.__eodV416={isEndOfDayV416,hadActivity9to17V416,endOfDayPoolV416,strongestLedgerEventsV416,mergeEodLedgerV416};');
assert.equal(__eodV416.isEndOfDayV416(),true);
assert.equal(__eodV416.hadActivity9to17V416(rows[0]),true);
assert.equal(__eodV416.hadActivity9to17V416(rows[3]),false);
assert.equal(minutesLeftV416(rows[0]),30,'after close, feasibility clock should use last valid equity-session activity');
const fallback=filtered();
assert.deepEqual(fallback.map(x=>x.symbol),['A','B']);

const events=[
  {symbol_id:'1',hunt_state:'هشدار فوری',hunt_mode:'acceleration',max_hunt_score:79,max_today_opportunity:82,day_change:.3,evidence_count:3,dynamic_evidence_count:2,first_seen_at:'2026-09-16T07:00:00Z',last_seen_at:'2026-09-16T07:10:00Z'},
  {symbol_id:'1',hunt_state:'شکار ویژه',hunt_mode:'acceleration',max_hunt_score:88,max_today_opportunity:90,day_change:.5,evidence_count:5,dynamic_evidence_count:3,first_seen_at:'2026-09-16T08:00:00Z',last_seen_at:'2026-09-16T08:05:00Z'},
  {symbol_id:'2',hunt_state:'هشدار فوری',hunt_mode:'reversal',max_hunt_score:74,max_today_opportunity:78,day_change:-.4,evidence_count:4,dynamic_evidence_count:2,first_seen_at:'2026-09-16T08:10:00Z',last_seen_at:'2026-09-16T08:20:00Z'}
];
const merged=__eodV416.mergeEodLedgerV416(events,rows);
assert.deepEqual(merged.map(x=>[x.symbol,x.hunt]),[['A','شکار ویژه'],['B','هشدار فوری']]);
assert.equal(merged[0].eodArchivedV416,true);
assert.equal(applyHuntV416(merged[0]).hunt,'شکار ویژه','archived status must not be recomputed away after close');
console.log('search-eod-v416 smoke: PASS');
