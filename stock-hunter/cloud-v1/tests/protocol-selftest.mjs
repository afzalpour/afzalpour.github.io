import { createHash, createHmac } from "node:crypto";

const secret = "test-secret";
const body = Buffer.from('{"hello":"world"}', "utf8");
const bodyHash = createHash("sha256").update(body).digest("hex");
const expectedHash = "93a23971a914e5eacbf0a8d25154cda309c3c1c72fbb9914d47c60f3cb681588";
if (bodyHash !== expectedHash) {
  throw new Error(`body hash mismatch: ${bodyHash}`);
}

const canonical = [
  "v1",
  "collector-test",
  "stream-test",
  "42",
  "1790272800",
  "nonce-abc",
  bodyHash,
].join("\n");

const actual = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
const expected = "12d01c804f06f283ebcfeffc52fab1cb5118e325e7268330571b3a275b2ee44d";
if (actual !== expected) {
  throw new Error(`signature mismatch: ${actual}`);
}

console.log("cloud-protocol-selftest: PASS");
