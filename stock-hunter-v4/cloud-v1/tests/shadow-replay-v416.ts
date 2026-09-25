import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import {execFileSync} from "node:child_process";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"sh-shadow-"));
const input=path.join(root,"market-facts.ndjson.gz");
const output=path.join(root,"report.json");
const start=Math.floor(Date.parse("2026-09-23T06:00:00Z")/1000);
const pa=[99,99.2,99.5,99.8,100.1,100.2];
const pb=[100.1,100.3,100.6,100.8,101.1,101.2];

function row(id:string,symbol:string,last:number,volume:number){
  return {
    id,symbol,company_name:`شرکت ${symbol}`,last_price:last,closing_price:last,
    yesterday_price:100,low_price:98,high_price:102,min_allowed:90,max_allowed:110,
    tno:20,volume,value:Math.round(last*volume),flow:1,cs:"300",pf:0,yval:"300",
    best_limits:[
      {level:1,buy_orders:5,sell_orders:2,bid_price:last-.1,ask_price:last+.1,bid_qty:1400,ask_qty:500},
      {level:2,buy_orders:4,sell_orders:2,bid_price:last-.2,ask_price:last+.2,bid_qty:1200,ask_qty:450},
      {level:3,buy_orders:3,sell_orders:2,bid_price:last-.3,ask_price:last+.3,bid_qty:1000,ask_qty:400},
      {level:4,buy_orders:2,sell_orders:1,bid_price:last-.4,ask_price:last+.4,bid_qty:800,ask_qty:350},
      {level:5,buy_orders:2,sell_orders:1,bid_price:last-.5,ask_price:last+.5,bid_qty:600,ask_qty:300},
    ],
    client_type:{
      individual_buy_count:10,corporate_buy_count:1,individual_buy_volume:20000,corporate_buy_volume:1000,
      individual_sell_count:10,corporate_sell_count:1,individual_sell_volume:10000,corporate_sell_volume:1000,
    },
  };
}
const lines=[];
for(let i=0;i<pa.length;i++){
  lines.push(JSON.stringify({
    protocol:"stock-hunter-iran-ingest-v1",collector_id:"iran-primary",stream_id:"fixture",
    sequence:i+1,observed_at:start+i*30,
    rows:[row("1","الف",pa[i],1000+i*500),row("2","ب",pb[i],1200+i*550)],
  }));
}
fs.writeFileSync(input,zlib.gzipSync(Buffer.from(lines.join("\n")+"\n")));
const tsx=path.resolve("node_modules",".bin","tsx");
const script=path.resolve("..","historical","shadow-replay-v416.ts");
execFileSync(tsx,[script,"--input",input,"--output",output,"--date","2026-09-23"],{stdio:"pipe"});
const report=JSON.parse(fs.readFileSync(output,"utf8"));
assert.equal(report.schema,"stock-hunter-live-shadow-v416");
assert.equal(report.engine,"4.1.6-hunt-v2");
assert.equal(report.integrated_viewdef_md5,"09f820b9692f94010a5391c489ac9c96");
assert.equal(report.prospective_capture_only,true);
assert.equal(report.no_future_features,true);
assert.equal(report.snapshots,6);
assert.equal(report.distinct_symbols,2);
assert.equal(report.objectives.reversal.pool_events,1);
assert.equal(report.objectives.reversal.scorable_events,1);
assert.equal(report.objectives.acceleration.pool_events,1);
assert.equal(report.objectives.acceleration.scorable_events,1);
assert.ok(report.evaluated_rows>0);
fs.rmSync(root,{recursive:true,force:true});
console.log("cloud-live-shadow-replay-v416: PASS");
