#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const sourceRel = "capture-security/stock-hunter-capture-v416/index.ts";
const outputRel = "cloud-v1/frozen-runtime/generated-hunt-v416.ts";
const sourcePath = path.join(root, sourceRel);
const outputPath = path.join(root, outputRel);
const marker = "function captureAdminKey(){";

const source = fs.readFileSync(sourcePath, "utf8");
const markerOffset = source.indexOf(marker);
if (markerOffset < 0) throw new Error("captureAdminKey marker not found; refusing generation");

let pure = source.slice(0, markerOffset);
pure = pure.replace(/^import .*?\n/, "");
if (/\bDeno\b|createClient\(|SUPABASE_/m.test(pure)) {
  throw new Error("impure server dependency found in generated scorer prefix");
}

const blobSha = execFileSync("git", ["hash-object", sourcePath], {
  encoding: "utf8",
}).trim();

const header = `// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: stock-hunter-v4/${sourceRel}
// Source Git blob SHA-1: ${blobSha}
// Generation rule: remove import line(s), retain exact source before captureAdminKey(), append exports.
// This keeps the previously parity-approved server scorer logic byte-derived from its reviewed source.

`;

const generated =
  header +
  pure.trimEnd() +
  "\n\nexport { evaluate, runParity, tparts, PARITY_FIXED_ISO };\n";

if (process.argv.includes("--check")) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== generated) {
    console.error("generated-hunt-v416.ts is stale or manually edited");
    process.exit(1);
  }
  console.log(`frozen-runtime-generation-check: PASS source_blob=${blobSha}`);
  process.exit(0);
}

fs.writeFileSync(outputPath, generated, "utf8");
console.log(`generated ${outputRel} from ${sourceRel} source_blob=${blobSha}`);
