'use strict';
const assert=require('assert');
const core=require('../hunt-runtime-core-v417.js');

const fixtures=[
  ['2026-09-19','1',65],
  ['2026-09-19','12345',49],
  ['2026-09-20','12345',97],
  ['2026-10-01','987654321',82],
];

for(const [d,s,expected] of fixtures){
  assert.strictEqual(core.bucket100(`${d}|${s}`),expected,`${d}|${s}`);
}
assert.strictEqual(core.shouldUseChallenger({
  routingMode:'CHAMPION_ONLY',trafficPercent:0,killSwitch:true,
  runtimeRoutingEnabled:true,challengerAvailable:true,key:'2026-09-19|1'
}),false);
assert.strictEqual(core.shouldUseChallenger({
  routingMode:'CANARY',trafficPercent:5,killSwitch:false,
  runtimeRoutingEnabled:true,challengerAvailable:true,key:'2026-09-19|12345'
}),false); // bucket 49
assert.strictEqual(core.shouldUseChallenger({
  routingMode:'CANARY',trafficPercent:50,killSwitch:false,
  runtimeRoutingEnabled:true,challengerAvailable:true,key:'2026-09-19|12345'
}),true); // bucket 49

console.log('stock-hunter-staged-canary-route-parity-v417: PASS');
