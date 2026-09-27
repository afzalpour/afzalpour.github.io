import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { runParity } from "../frozen-runtime/generated-hunt-v416.ts";

const browserRaw = execFileSync(
  process.execPath,
  ["../../hunt-parity-v416.js", "--json"],
  {
    cwd: new URL(".", import.meta.url).pathname,
    encoding: "utf8",
  },
);
const browser = JSON.parse(browserRaw);
const cloud = runParity();

assert.deepStrictEqual(cloud, browser);
assert.equal(cloud.protocol, "4.1.6-browser-server-parity-v1");
assert.equal(cloud.results.length, 9);

const byId = Object.fromEntries(cloud.results.map((x: any) => [x.id, x]));
assert.equal(byId["106"].captured, true);
assert.equal(byId["107"].captured, true);
assert.equal(byId["108"].captured, true);
assert.equal(byId["109"].captured, false);

console.log("frozen-hunt-browser-cloud-parity: PASS");
