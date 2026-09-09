import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const index = read('index.html');
const css = read('rc15-final-web-pwa.css');
const sw = read('sw.js');
const businessView = read('src/ui/intelligence/business-copilot-view.js');
const manifest = JSON.parse(read('manifest.webmanifest'));

// Typography: the loaded Vazirmatn face must actually own the final font stack.
assert.match(index, /Vazirmatn-Variable-font-face\.css/);
assert.match(index, /rc15-final-web-pwa\.css/);
assert.ok(
  index.indexOf('styles.css') < index.indexOf('rc15-final-web-pwa.css'),
  'final typography/mobile CSS must load after the legacy base stylesheet'
);
assert.match(css, /--avan-font-stack:'Vazirmatn'/);
assert.match(css, /-apple-system/);
assert.match(css, /BlinkMacSystemFont/);
assert.match(css, /font-family:var\(--avan-font-stack\)/);

// Dashboard financial-analysis presentation must mirror the stable risk-card pattern:
// label/title first, value below, and long numbers constrained inside the card.
assert.match(businessView, /cloud-badge/,
  'financial analysis block must expose its scoped intelligence marker');
assert.match(businessView, /<div class="grid4 section">/,
  'financial analysis insights must remain in the four-card dashboard grid');
assert.match(css, /\.section\.card > \.section-head:has\(\.cloud-badge\) \+ \.grid4\.section > \.card > \.section-head\{[\s\S]*flex-direction:column/,
  'financial analysis card heading/value stack must be vertical');
assert.match(css, /\.section\.card > \.section-head:has\(\.cloud-badge\) \+ \.grid4\.section > \.card > \.section-head \.summary-pill\{[\s\S]*width:100%/,
  'financial analysis value must stay inside the card width');
assert.match(css, /\.section\.card > \.section-head:has\(\.cloud-badge\) \+ \.grid4\.section > \.card > \.section-head \.summary-pill\{[\s\S]*overflow-wrap:anywhere/,
  'long financial values must wrap instead of escaping the box');

// iPhone/PWA viewport polish.
assert.match(index, /viewport-fit=cover/);
assert.match(css, /min-height:100dvh/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /safe-area-inset-left/);
assert.match(css, /safe-area-inset-right/);
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.orientation, 'any', 'financial tables must not be locked to portrait mode');

// Offline correctness: cache identity must be versioned, but this regression must
// not hard-code one release number and break every legitimate cache bump.
assert.match(sw, /const CACHE_PREFIX='avan-staging-rc1-'/);
assert.match(sw, /const CACHE='avan-staging-rc1-v\d+[^']*'/,
  'PWA cache must keep an explicit versioned Avan staging identity');
assert.match(sw, /\.\/rc15-final-web-pwa\.css/);
assert.match(sw, /\.\/src\/ui\/settings\/settings-layout-v2\.js/);
assert.match(sw, /\.\/src\/ui\/settings\/workspace-access-settings\.js/);
assert.match(sw, /\.\/src\/ui\/settings\/support-access-settings\.js/);
assert.match(sw, /\.\/src\/ui\/einvoice\/einvoice-preflight-ui\.js/);
assert.match(sw, /async function networkFirst\(request\)/);
assert.match(sw, /if\(request\.mode==='navigate'\)/,
  'index.html fallback must be limited to document navigation');
assert.match(sw, /throw error/,
  'missing JS/CSS/image requests must fail rather than receive HTML masquerading as an asset');
assert.doesNotMatch(sw, /catch\(\(\)=>caches\.match\(e\.request\)\.then\(r=>r\|\|caches\.match\('\.\/index\.html'\)\)\)/,
  'legacy unconditional HTML fallback must not return');
assert.match(sw, /url\.origin!==location\.origin/,
  'cross-origin font/CDN traffic must stay outside the app service-worker cache');

console.log('final-web-pwa-polish.spec.mjs: PASS');
