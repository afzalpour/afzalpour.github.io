'use strict';
const assert=require('../hunt-runtime-core-v417.js');

const base={
  killSwitch:false,
  runtimeRoutingEnabled:true,
  challengerAvailable:true,
  key:'2026-09-19|12345'
};

assert.strictEqual(assert.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100}),true);
assert.strictEqual(assert.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:50}),false);
assert.strictEqual(assert.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100,killSwitch:true}),false);
assert.strictEqual(assert.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100,runtimeRoutingEnabled:false}),false);
assert.strictEqual(assert.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100,challengerAvailable:false}),false);

console.log('stock-hunter-full-activation-runtime-v417: PASS');
