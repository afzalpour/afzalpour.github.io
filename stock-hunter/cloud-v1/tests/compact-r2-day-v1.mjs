#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import {spawnSync} from "node:child_process";

const root=fs.mkdtempSync(path.join(os.tmpdir(),"sh-pack-"));
const input=path.join(root,"raw"),output=path.join(root,"out");
fs.mkdirSync(input,{recursive:true});
const date="2026-09-24";
const base=Math.floor(Date.parse("2026-09-24T08:00:00Z")/1000);
for(let i=0;i<3;i++){
  const p={protocol:"stock-hunter-iran-ingest-v1",collector_id:"iran-primary",stream_id:"s1",sequence:i+1,observed_at:base+i*30,rows:[{id:"1",symbol:"تست",last_price:100+i}]};
  fs.writeFileSync(path.join(input,`${i}.json.gz`),zlib.gzipSync(Buffer.from(JSON.stringify(p))));
}
const script=path.resolve("..","historical","compact-r2-day-v1.mjs");
const r=spawnSync(process.execPath,[script,"--input",input,"--output",output,"--date",date],{encoding:"utf8"});
if(r.status!==0)throw new Error(r.stderr||r.stdout||`status ${r.status}`);
const m=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"),"utf8"));
if(m.snapshot_count!==3||m.total_rows!==3||m.streams[0].gaps.length!==0)throw new Error("manifest_mismatch");
const lines=zlib.gunzipSync(fs.readFileSync(path.join(output,"market-facts.ndjson.gz"))).toString("utf8").trim().split("\n");
if(lines.length!==3)throw new Error("pack_line_count_mismatch");
fs.rmSync(root,{recursive:true,force:true});
console.log("cloud-r2-day-compactor-v1: PASS");
