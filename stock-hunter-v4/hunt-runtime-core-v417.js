'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StockHunterRuntimeCoreV417=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const VERSION='4.1.7-runtime-core-v1';
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
  const finite=v=>Number.isFinite(Number(v));

  function normalizeWeights(row){
    if(!row)return null;
    const w={
      orderPressure:Number(row.order_pressure),
      impulse:Number(row.impulse),
      feasibility:Number(row.feasibility),
      flowVolume:Number(row.flow_volume),
      marketContext:Number(row.market_context),
      continuationMin:Number(row.continuation_modifier_min),
      continuationMax:Number(row.continuation_modifier_max)
    };
    if(!Object.values(w).every(finite))return null;
    const sum=w.orderPressure+w.impulse+w.feasibility+w.flowVolume+w.marketContext;
    if(Math.abs(sum-1)>.000001)return null;
    if([w.orderPressure,w.impulse,w.feasibility,w.flowVolume,w.marketContext].some(v=>v<0||v>1))return null;
    if(w.continuationMin<0||w.continuationMax>1.25||w.continuationMin>w.continuationMax)return null;
    return w;
  }

  function scoreFromComponents(c,w){
    if(!c||!w)return null;
    const riskPenalty=Math.max(0,Number(c.risk||0)-40)*.23+Math.max(0,Number(c.cancel||0)-60)*.10;
    const today=clamp(
      w.orderPressure*Number(c.orderPressure||0)+
      w.impulse*Number(c.impulse||0)+
      w.feasibility*Number(c.feasibility||0)+
      w.flowVolume*Number(c.flowVolume||0)+
      w.marketContext*Number(c.marketContext||0)-riskPenalty
    );
    const cont=clamp(c.continuation||0);
    const modifier=w.continuationMin+(w.continuationMax-w.continuationMin)*(cont/100);
    return {todayOpportunity:today,huntScore:clamp(today*modifier),riskPenalty,continuationModifier:modifier};
  }

  function fnv1a32(input){
    const s=String(input??'');
    let h=0x811c9dc5;
    for(let i=0;i<s.length;i++){
      h^=s.charCodeAt(i);
      h=Math.imul(h,0x01000193)>>>0;
    }
    return h>>>0;
  }

  function bucket100(key){return fnv1a32(key)%100;}

  function shouldUseChallenger({routingMode,trafficPercent,killSwitch,runtimeRoutingEnabled,challengerAvailable,key}){
    if(!runtimeRoutingEnabled||killSwitch||!challengerAvailable)return false;
    const mode=String(routingMode||'CHAMPION_ONLY');
    const pct=Math.max(0,Math.min(100,Number(trafficPercent)||0));
    if(mode==='CHALLENGER_ONLY')return pct===100;
    if(mode!=='CANARY'||pct<=0)return false;
    return bucket100(key)<pct;
  }

  return {VERSION,clamp,normalizeWeights,scoreFromComponents,fnv1a32,bucket100,shouldUseChallenger};
});
