import assert from "node:assert/strict";
import {
  STOCK_HUNTER_CLOUD_CLIENT_PROTOCOL,
  StockHunterCloudClientV1,
  cloudSnapshotFreshnessV1,
  cloudWsUrlV1,
  validateCloudSnapshotV1,
} from "../client/cloud-market-client-v1.js";

assert.equal(cloudWsUrlV1("https://market.example.test/"),"wss://market.example.test/v1/ws");
assert.throws(()=>cloudWsUrlV1("http://market.example.test"),/https/);

const now=1_790_272_800_000;
assert.deepStrictEqual(
  cloudSnapshotFreshnessV1(1_790_272_700,now,180),
  {fresh:true,ageSeconds:100,reason:"fresh"},
);
assert.deepStrictEqual(
  cloudSnapshotFreshnessV1(1_790_272_500,now,180),
  {fresh:false,ageSeconds:300,reason:"stale"},
);

assert.equal(validateCloudSnapshotV1({
  sequence:1,observed_at:1,rows:[],
}).sequence,1);
assert.throws(()=>validateCloudSnapshotV1({sequence:1,observed_at:1}),/rows/);

class FakeWebSocket {
  static instances=[];
  constructor(url){
    this.url=url;
    this.readyState=0;
    FakeWebSocket.instances.push(this);
    queueMicrotask(()=>{this.readyState=1;this.onopen?.({});});
  }
  close(code=1000,reason=""){
    this.readyState=3;
    this.onclose?.({code,reason});
  }
  push(value){this.onmessage?.({data:JSON.stringify(value)});}
}

const ts=Math.floor(Date.now()/1000);
let latestSequence=4;
const fetches=[];
const fetchImpl=async (url)=>{
  fetches.push(String(url));
  if(String(url).endsWith("/v1/health")){
    return Response.json({
      status:"fresh",
      latest:{sequence:latestSequence,observed_at:ts,accepted_at:ts,row_count:2},
    });
  }
  if(String(url).endsWith("/v1/latest")){
    return Response.json({
      protocol:"stock-hunter-iran-ingest-v1",
      collector_id:"iran-primary",
      stream_id:"s",
      sequence:latestSequence,
      observed_at:ts,
      source:{},
      rows:[{id:"1"},{id:"2"}],
    });
  }
  return new Response("",{status:404});
};

const snapshots=[];
const states=[];
const client=new StockHunterCloudClientV1({
  apiBase:"https://market.example.test",
  fetchImpl,
  WebSocketImpl:FakeWebSocket,
  onSnapshot:x=>snapshots.push(x),
  onState:x=>states.push(x),
});
async function main(){
  await client.start();
  await new Promise(r=>setTimeout(r,0));
  
  assert.equal(snapshots.length,1);
  assert.equal(snapshots[0].fresh,true);
  assert.equal(snapshots[0].activeHuntAllowed,true);
  assert.equal(snapshots[0].payload.sequence,4);
  assert.equal(FakeWebSocket.instances.length,1);
  assert.equal(FakeWebSocket.instances[0].url,"wss://market.example.test/v1/ws");
  
  latestSequence=5;
  FakeWebSocket.instances[0].push({
    protocol:STOCK_HUNTER_CLOUD_CLIENT_PROTOCOL,
    type:"snapshot_available",
    sequence:5,
    observed_at:ts,
    accepted_at:ts,
    row_count:2,
    body_sha256:"a".repeat(64),
    collector_id:"iran-primary",
  });
  await new Promise(r=>setTimeout(r,10));
  assert.equal(snapshots.at(-1).payload.sequence,5);
  assert.ok(fetches.filter(x=>x.endsWith("/v1/latest")).length>=2);
  
  client.stop();
  assert.equal(client.running,false);
  
  console.log("staging-cloud-market-client: PASS");
  
}

main().catch(error=>{console.error(error);process.exit(1);});
