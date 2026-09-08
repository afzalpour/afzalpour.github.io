import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const textExtensions = new Set(['.js', '.mjs', '.html']);
const ignoredDirs = new Set(['.git', 'node_modules', 'tests', 'scripts']);
const findings = [];

// AC-1 closure: direct replacement of shared cloud-client methods is no longer
// permitted anywhere in staging. Cross-cutting behavior must use operations.
const legacyOverwriteAllowlist = new Map();

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (textExtensions.has(path.extname(entry.name))) inspect(full);
  }
}

function inspect(file) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);

  const rules = [
    {
      code: 'DIRECT_CLIENT_METHOD_OVERWRITE',
      re: /\b(?:C|client|AvanCloud)\.(rpc|select|insert|update|remove)\s*=/,
      severity: 'high'
    },
    {
      code: 'MUTATION_OBSERVER',
      re: /new\s+MutationObserver\s*\(/,
      severity: 'medium'
    }
  ];

  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.re.test(line)) {
        findings.push({
          code: rule.code,
          severity: rule.severity,
          file: rel,
          line: index + 1,
          excerpt: line.trim().slice(0, 180)
        });
      }
    }
  });
}

walk(root);

const appPath = path.join(root, 'app.js');
const indexPath = path.join(root, 'index.html');
const directOverwrites = findings.filter(f => f.code === 'DIRECT_CLIENT_METHOD_OVERWRITE');
const observers = findings.filter(f => f.code === 'MUTATION_OBSERVER');
const bodyWideObservers = observers.filter(f => /document\.body/.test(f.excerpt));
const unauthorizedOverwrites = [...directOverwrites];

const metrics = {
  app_js_bytes: fs.existsSync(appPath) ? fs.statSync(appPath).size : null,
  index_html_bytes: fs.existsSync(indexPath) ? fs.statSync(indexPath).size : null,
  direct_client_method_overwrites: directOverwrites.length,
  quarantined_legacy_overwrites: 0,
  unauthorized_client_overwrites: unauthorizedOverwrites.length,
  mutation_observers: observers.length,
  body_wide_mutation_observers: bodyWideObservers.length,
  high_findings: findings.filter(f => f.severity === 'high').length
};

console.log(JSON.stringify({
  metrics,
  legacy_overwrite_allowlist: {},
  findings
}, null, 2));

if (directOverwrites.length > 0) {
  console.error('Architecture gate failed: direct shared client overwrite detected.');
  console.error(`Direct overwrite(s): ${directOverwrites.length}`);
  process.exitCode = 1;
}
