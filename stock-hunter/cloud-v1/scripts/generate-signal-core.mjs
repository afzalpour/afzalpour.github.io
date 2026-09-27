#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const appRoot=path.resolve(here,"../..");
const sourceRel="legacy-security/stock-hunter-market-scan-v4/index.ts";
const outputRel="cloud-v1/live-features/generated-signal-core-v401.ts";
const sourcePath=path.join(appRoot,sourceRel);
const outputPath=path.join(appRoot,outputRel);
const source=fs.readFileSync(sourcePath,"utf8");

const typeEnd=source.indexOf("const CDN=");
const utilStart=source.indexOf("const n=");
const utilEnd=source.indexOf("async function fj");
const funcsStart=source.indexOf("function ema(");
const funcsEnd=source.indexOf("function ah(");
if([typeEnd,utilStart,utilEnd,funcsStart,funcsEnd].some(x=>x<0)){
  throw new Error("legacy feature extraction markers changed");
}

const pure=
  source.slice(0,typeEnd).trimEnd()+"\n"+
  source.slice(utilStart,utilEnd).trimEnd()+"\n"+
  source.slice(funcsStart,funcsEnd).trimEnd();

if(/https?:\/\/|\bfetch\s*\(|Deno\.|createClient\(|SUPABASE_/i.test(pure)){
  throw new Error("network/backend dependency leaked into pure signal core");
}

const blobSha=execFileSync("git",["hash-object",sourcePath],{encoding:"utf8"}).trim();
const header=`// GENERATED FILE — DO NOT EDIT.
// Pure signal/rolling-feature core mechanically extracted from:
// stock-hunter-v4/${sourceRel}
// Source Git blob SHA-1: ${blobSha}
// Extraction deliberately excludes CDN/network/database/Hunt transport code.
// NOTE: score() also emits legacy hunt/decision fields; cloud wrapper MUST discard those.

`;
const generated=header+pure+"\n\nexport { score as legacySignalScoreV401 };\n";

if(process.argv.includes("--check")){
  const current=fs.existsSync(outputPath)?fs.readFileSync(outputPath,"utf8"):"";
  if(current!==generated){
    console.error("generated-signal-core-v401.ts is stale or manually edited");
    process.exit(1);
  }
  console.log(`signal-core-generation-check: PASS source_blob=${blobSha}`);
  process.exit(0);
}
fs.writeFileSync(outputPath,generated,"utf8");
console.log(`generated ${outputRel} source_blob=${blobSha}`);
