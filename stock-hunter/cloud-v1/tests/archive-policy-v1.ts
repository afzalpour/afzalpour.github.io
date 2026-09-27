import assert from "node:assert/strict";
import {
  RAW_ARCHIVE_DAILY_MAX_BYTES,
  RAW_ARCHIVE_DAILY_MAX_OBJECTS,
  archiveBudgetDecision,
  rawArchiveKey,
  recordArchiveBudget,
  tehranDateFromEpochSeconds,
  trimArchiveBudgetLedger,
} from "../cloudflare/src/archive-policy-v1.ts";

const ts=Math.floor(Date.parse("2026-09-24T08:00:00Z")/1000);
assert.equal(tehranDateFromEpochSeconds(ts),"2026-09-24");
const hash="a".repeat(64);
assert.equal(
  rawArchiveKey({observedAt:ts,collectorId:"iran-primary",streamId:"stream-1",sequence:42,bodyHash:hash}),
  `raw/v1/2026-09-24/iran-primary/stream-1/${ts}-42-${"a".repeat(16)}.json.gz`,
);

let ledger={};
const first=archiveBudgetDecision({ledger,date:"2026-09-24",bodyBytes:1234});
assert.equal(first.allowed,true);
ledger=recordArchiveBudget(ledger,"2026-09-24",first.next);
assert.deepStrictEqual(ledger["2026-09-24"],{bytes:1234,objects:1});

const byteStop=archiveBudgetDecision({
  ledger:{"2026-09-24":{bytes:RAW_ARCHIVE_DAILY_MAX_BYTES-100,objects:1}},
  date:"2026-09-24",bodyBytes:101,
});
assert.equal(byteStop.allowed,false);
assert.equal(byteStop.reason,"daily_byte_budget");

const objectStop=archiveBudgetDecision({
  ledger:{"2026-09-24":{bytes:100,objects:RAW_ARCHIVE_DAILY_MAX_OBJECTS}},
  date:"2026-09-24",bodyBytes:1,
});
assert.equal(objectStop.allowed,false);
assert.equal(objectStop.reason,"daily_object_budget");

const many={};
for(let i=1;i<=10;i++)many[`2026-09-${String(i).padStart(2,"0")}`]={bytes:i,objects:i};
const trimmed=trimArchiveBudgetLedger(many,7);
assert.equal(Object.keys(trimmed).length,7);
assert.equal(Boolean(trimmed["2026-09-10"]),true);
assert.equal(Boolean(trimmed["2026-09-03"]),false);

console.log("cloud-r2-archive-policy-v1: PASS");
