import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const index = read('index.html');
const css = read('rc15-final-web-pwa.css');
const sw = read('sw.js');
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

// iPhone/PWA viewport polish.
assert.match(index, /viewport-fit=cover/);
assert.match(css, /min-height:100dvh/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /safe-area-inset-left/);
assert.match(css, /safe-area-inset-right/);
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.orientation, 'any', 'financial tables must not be locked to portrait mode');

// Offline correctness: HTML shell fallback is navigation-only.
assert.match(sw, /const CACHE='avan-staging-rc1-v84-settings-einvoice-live-fix'/);
assert.match(sw, /\.\/rc15-final-web-pwa\.css/);
assert.match(sw, /\.\/src\/ui\/settings\/settings-layout-v2\.js/);
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
