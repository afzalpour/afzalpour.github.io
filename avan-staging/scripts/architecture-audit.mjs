import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const textExtensions = new Set(['.js', '.mjs', '.html']);
const ignoredDirs = new Set(['.git', 'node_modules']);
const findings = [];

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
      code: 'GLOBAL_MUTATION_OBSERVER',
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
const metrics = {
  app_js_bytes: fs.existsSync(appPath) ? fs.statSync(appPath).size : null,
  index_html_bytes: fs.existsSync(indexPath) ? fs.statSync(indexPath).size : null,
  direct_client_method_overwrites: findings.filter(f => f.code === 'DIRECT_CLIENT_METHOD_OVERWRITE').length,
  mutation_observers: findings.filter(f => f.code === 'GLOBAL_MUTATION_OBSERVER').length,
  high_findings: findings.filter(f => f.severity === 'high').length
};

console.log(JSON.stringify({ metrics, findings }, null, 2));

// Migration-mode audit: report debt without failing the build yet.
// ADR-0016 will allow turning high findings into a non-zero exit code after
// all known legacy patches have been migrated.
