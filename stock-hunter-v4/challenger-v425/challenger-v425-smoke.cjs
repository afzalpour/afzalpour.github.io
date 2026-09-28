'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');

global.window={};
global.detailHTML=()=>'<div class="detail-grid"></div>';
global.esc=v=>String(v??'');
global.fa=v=>String(Number(v||0));
global.pctH416=(a,b)=>Number(b)>0?(Number(a)/Number(b)-1)*100:0;
global.zeroRecoveryV416=x=>Number(x.recovery||50);
global.technicalImpulseScoreV416=()=>50;
global.continuationScoreV416=x=>Number(x.cont||50);
global.marketContextScoreV416=()=>50;
global.feasibilityScoreV416=(x,mode)=>({score:mode==='reversal'?65:70,left:60,distance:0,runway:1});

const src=fs.readFileSync('stock-hunter-v4/app-hunt-challenger-v425.js','utf8');
vm.runInThisContext(src,{filename:'app-hunt-challenger-v425.js'});
const api=window.StockHunterChallengerV425;
assert.equal(api.version,'4.2.5-challenger-shadow-v1');
assert.equal(typeof api.reversal,'function');
assert.equal(typeof api.acceleration,'function');

function row(extra={}){
  return {
    analyzed:true,updated:'2026-09-28T06:00:00Z',last:99,yesterday:100,volume:1000,
    recovery:60,pv:.08,tradeAccel:30,realFlow:1.3,cont:60,
    bookImbalance3V425:.15,mlofi3V425:.10,bookPersistenceV425:.75,cancelProxyV425:.10,
    rvolTodV425:1.4,rvolTodSamplesV425:3,bookLevelsReadyV425:true,depthRatio:9.9,
    ...extra
  };
}

const base=row();api.apply(base);
assert.equal(base.challengerModeV425,'reversal');
assert.equal(base.challengerComparableV425,true);

const low=row({mlofi3V425:-.2});api.apply(low);
const high=row({mlofi3V425:.5});api.apply(high);
assert.ok(high.challengerOrderV425>low.challengerOrderV425,'positive MLOFI must raise order score');

const cancelLow=row({cancelProxyV425:0});api.apply(cancelLow);
const cancelHigh=row({cancelProxyV425:.8});api.apply(cancelHigh);
assert.ok(cancelLow.challengerOrderV425>cancelHigh.challengerOrderV425,'cancellation proxy must lower order score');

const depthA=row({depthRatio:.2});api.apply(depthA);
const depthB=row({depthRatio:20});api.apply(depthB);
assert.equal(depthA.challengerOrderV425,depthB.challengerOrderV425,'DepthRatio must not be double-counted');

const immature=row({rvolTodSamplesV425:2});api.apply(immature);
assert.equal(immature.challengerComparableV425,false,'RVOL needs three prior same-time sessions');

const accel=row({last:100.5,yesterday:100});api.apply(accel);
assert.equal(accel.challengerModeV425,'acceleration');
assert.notEqual(api.reversal(base,-1).mode,api.acceleration(accel,.5).mode);

console.log('challenger-v425-smoke: PASS');
