import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../rc15-c1-4-mutation-stability.js', import.meta.url), 'utf8');

class FakeNativeMutationObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    FakeNativeMutationObserver.instances.push(this);
  }

  observe(target, options) {
    this.observed.push({ target, options });
  }

  disconnect() {}
  takeRecords() { return []; }
  emit(records) { this.callback(records, this); }
}

const body = { id: 'body' };
const other = { id: 'other' };
const Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
const windowObject = { MutationObserver: FakeNativeMutationObserver, Node };
const documentObject = { body };

vm.runInNewContext(source, {
  window: windowObject,
  document: documentObject,
  Object,
  TypeError
});

assert.equal(windowObject.__avanMutationStabilityGuard?.active, true);
assert.notEqual(windowObject.MutationObserver, FakeNativeMutationObserver);

let bodyCalls = 0;
const bodyObserver = new windowObject.MutationObserver(() => { bodyCalls += 1; });
bodyObserver.observe(body, { childList: true, subtree: true });
const bodyNative = FakeNativeMutationObserver.instances.at(-1);

bodyNative.emit([{ type: 'childList', addedNodes: [{ nodeType: 3 }], removedNodes: [] }]);
assert.equal(bodyCalls, 0, 'body-wide text-only mutation must be ignored');

bodyNative.emit([{ type: 'childList', addedNodes: [{ nodeType: 1 }], removedNodes: [] }]);
assert.equal(bodyCalls, 1, 'body-wide element mutation must be delivered');

bodyNative.emit([{ type: 'attributes', addedNodes: [], removedNodes: [] }]);
assert.equal(bodyCalls, 2, 'body-wide attribute mutation must be delivered');

let otherCalls = 0;
const otherObserver = new windowObject.MutationObserver(() => { otherCalls += 1; });
otherObserver.observe(other, { childList: true, subtree: true });
const otherNative = FakeNativeMutationObserver.instances.at(-1);
otherNative.emit([{ type: 'childList', addedNodes: [{ nodeType: 3 }], removedNodes: [] }]);
assert.equal(otherCalls, 1, 'non-body observers must keep native text mutation behavior');

console.log('mutation-stability.spec.mjs: PASS');
