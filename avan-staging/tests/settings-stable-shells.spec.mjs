import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const accessWrapper = read('rc11-access.js');
const supportWrapper = read('rc13-support-access.js');
const access = read('src/ui/settings/workspace-access-settings.js');
const support = read('src/ui/settings/support-access-settings.js');
const money = read('src/ui/money/money-settings-card.js');
const layout = read('src/ui/settings/settings-layout-v2.js');
const sw = read('sw.js');

assert.match(accessWrapper, /workspace-access-settings\.js/);
assert.match(supportWrapper, /support-access-settings\.js/);
assert.doesNotMatch(accessWrapper, /MutationObserver/,
  'legacy access wrapper must not reinstall a body-wide observer');
assert.doesNotMatch(supportWrapper, /MutationObserver/,
  'legacy support wrapper must not reinstall its private observer');

assert.match(access, /installUiLifecycle/);
assert.match(support, /installUiLifecycle/);
assert.doesNotMatch(access, /new MutationObserver|MutationObserver\s*\(/,
  'workspace access must use the central lifecycle, not a private DOM observer');
assert.doesNotMatch(support, /new MutationObserver|MutationObserver\s*\(/,
  'support access must use the central lifecycle, not a private DOM observer');
assert.doesNotMatch(access, /outerHTML\s*=|replaceWith\(/,
  'the access card shell must not be replaced after it mounts');
assert.doesNotMatch(support, /outerHTML\s*=|replaceWith\(/,
  'the support card shell must not be replaced after it mounts');
assert.match(access, /data-avan-access-body/,
  'access updates must target an inner stable body');
assert.match(support, /data-avan-support-list/,
  'support updates must target only the session list below the static heading/copy');
assert.match(access, /companyContext\.ensure\(\)/,
  'access state must follow the central active-company context');
assert.match(access, /loadAccessModel\(forceAccess\)/,
  'access data should be prefetched without a loading-card replacement cycle');

assert.match(layout, /data-avan-support-slot/);
assert.match(layout, /data-avan-access-slot/);
assert.match(layout, /min-height:410px/,
  'access slot must reserve a stable vertical footprint while async data loads');
assert.match(layout, /min-height:190px/,
  'support slot must reserve a stable vertical footprint while async data loads');
assert.ok(
  layout.indexOf("stack.append(accessSlot)") < layout.indexOf("stack.append(supportSlot)"),
  'support access must stay below users/access in a deterministic slot order'
);

assert.match(money, /MoneyRuntime\.isReady\(\)/);
assert.match(money, /MoneyRuntime\.snapshot\(\)/,
  'money settings must render from the already-ready runtime snapshot');
assert.match(money, /queueMicrotask/,
  'money settings must mount after the final slot is prepared but before paint');
assert.doesNotMatch(money, /Lifecycle\.schedule\('money-settings-page'/,
  'money settings must not wait for the 40ms lifecycle debounce after page render');

assert.match(sw, /avan-staging-rc1-v85-settings-stable-shells/);
assert.match(sw, /src\/ui\/settings\/workspace-access-settings\.js/);
assert.match(sw, /src\/ui\/settings\/support-access-settings\.js/);

console.log('settings-stable-shells.spec.mjs: PASS');
