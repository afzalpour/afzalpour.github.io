'use strict';
const assert=require('assert');
const core=require('../hunt-runtime-core-v417.js');

const base={
  killSwitch:false,
  runtimeRoutingEnabled:true,
  challengerAvailable:true,
  key:'2026-09-19|12345'
};

assert.strictEqual(core.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100}),true);
assert.strictEqual(core.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:50}),false);
assert.strictEqual(core.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100,killSwitch:true}),false);
assert.strictEqual(core.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100,runtimeRoutingEnabled:false}),false);
assert.strictEqual(core.shouldUseChallenger({...base,routingMode:'CHALLENGER_ONLY',trafficPercent:100,challengerAvailable:false}),false);

console.log('stock-hunter-full-activation-runtime-v417: PASS');
