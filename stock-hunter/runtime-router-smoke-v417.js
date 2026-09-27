'use strict';
const fs=require('fs');
const path=require('path');
const core=require('./hunt-runtime-core-v417.js');
const hunt=fs.readFileSync(path.join(__dirname,'app-hunt-v416.js'),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const near=(a,b,eps=1e-9)=>Math.abs(Number(a)-Number(b))<=eps;

assert(hunt.includes("? .28*x.orderPressureV416+.27*x.impulseV416+.20*x.feasibilityV416+.15*x.flowVolumeV416+.10*x.marketContextV416".replace('? ',''))||hunt.includes("? .28*x.orderPressureV416+.27*x.impulseV416+.20*x.feasibilityV416+.15*x.flowVolumeV416+.10*x.marketContextV416"),'reversal baseline formula changed');
assert(hunt.includes(": .30*x.orderPressureV416+.30*x.impulseV416+.15*x.feasibilityV416+.15*x.flowVolumeV416+.10*x.marketContextV416"),'acceleration baseline formula changed');
assert(hunt.includes("today*(.82+.18*x.continuation12V416/100)"),'continuation modifier changed');
assert(hunt.includes("Math.max(0,Number(x.risk||0)-40)*.23+Math.max(0,Number(x.cancel||0)-60)*.10"),'risk penalty changed');

const rev=core.normalizeWeights({order_pressure:.28,impulse:.27,feasibility:.20,flow_volume:.15,market_context:.10,continuation_modifier_min:.82,continuation_modifier_max:1});
const acc=core.normalizeWeights({order_pressure:.30,impulse:.30,feasibility:.15,flow_volume:.15,market_context:.10,continuation_modifier_min:.82,continuation_modifier_max:1});
assert(rev&&acc,'baseline weights rejected');
const c={orderPressure:81,impulse:74,feasibility:63,flowVolume:57,marketContext:52,continuation:68,risk:49,cancel:66};
const riskPenalty=Math.max(0,c.risk-40)*.23+Math.max(0,c.cancel-60)*.10;
const revExpected=Math.max(0,Math.min(100,.28*c.orderPressure+.27*c.impulse+.20*c.feasibility+.15*c.flowVolume+.10*c.marketContext-riskPenalty));
const accExpected=Math.max(0,Math.min(100,.30*c.orderPressure+.30*c.impulse+.15*c.feasibility+.15*c.flowVolume+.10*c.marketContext-riskPenalty));
const modifier=.82+.18*c.continuation/100;
const rs=core.scoreFromComponents(c,rev),as=core.scoreFromComponents(c,acc);
assert(near(rs.todayOpportunity,revExpected),'reversal today parity mismatch');
assert(near(rs.huntScore,revExpected*modifier),'reversal hunt score parity mismatch');
assert(near(as.todayOpportunity,accExpected),'acceleration today parity mismatch');
assert(near(as.huntScore,accExpected*modifier),'acceleration hunt score parity mismatch');

assert(core.shouldUseChallenger({routingMode:'CANARY',trafficPercent:100,killSwitch:false,runtimeRoutingEnabled:true,challengerAvailable:true,key:'x'})===true,'100% canary should route challenger');
assert(core.shouldUseChallenger({routingMode:'CANARY',trafficPercent:100,killSwitch:true,runtimeRoutingEnabled:true,challengerAvailable:true,key:'x'})===false,'kill switch must force champion');
assert(core.shouldUseChallenger({routingMode:'CHALLENGER_ONLY',trafficPercent:100,killSwitch:false,runtimeRoutingEnabled:true,challengerAvailable:true,key:'x'})===true,'challenger-only should route challenger');
assert(core.shouldUseChallenger({routingMode:'CHAMPION_ONLY',trafficPercent:100,killSwitch:false,runtimeRoutingEnabled:true,challengerAvailable:true,key:'x'})===false,'champion-only must not route challenger');
assert(core.shouldUseChallenger({routingMode:'CANARY',trafficPercent:50,killSwitch:false,runtimeRoutingEnabled:false,challengerAvailable:true,key:'x'})===false,'disconnected runtime must force champion');
assert(core.shouldUseChallenger({routingMode:'CANARY',trafficPercent:50,killSwitch:false,runtimeRoutingEnabled:true,challengerAvailable:false,key:'x'})===false,'missing challenger config must force champion');
const b1=core.bucket100('2026-09-17|12345'),b2=core.bucket100('2026-09-17|12345');
assert(b1===b2&&b1>=0&&b1<100,'routing bucket must be deterministic');
assert(core.normalizeWeights({order_pressure:.5,impulse:.5,feasibility:.5,flow_volume:0,market_context:0,continuation_modifier_min:.82,continuation_modifier_max:1})===null,'invalid weight sum must be rejected');
console.log('runtime-router-v417-smoke: PASS');
