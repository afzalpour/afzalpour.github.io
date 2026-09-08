import assert from 'node:assert/strict';
import { installUiLifecycle } from '../src/ui/runtime/lifecycle.js';

class FakeCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.connected = false;
  }
  observe() { this.connected = true; }
  disconnect() { this.connected = false; }
}

const events = [];
const fakeDocument = {
  querySelector(selector) {
    return selector === '#content' || selector === '#modal' ? { selector } : null;
  },
  dispatchEvent(event) {
    events.push(event);
    return true;
  }
};

const fakeWindow = {
  Node: { ELEMENT_NODE: 1 },
  MutationObserver: FakeMutationObserver,
  CustomEvent: FakeCustomEvent,
  setTimeout,
  clearTimeout
};

const lifecycle = installUiLifecycle({
  globalObject: fakeWindow,
  documentObject: fakeDocument,
  debounceMs: 1000
});

assert.equal(typeof lifecycle.use, 'function');
assert.equal(typeof lifecycle.remove, 'function');
assert.equal(typeof lifecycle.run, 'function');
assert.equal(typeof lifecycle.schedule, 'function');

const calls = [];
assert.equal(lifecycle.use('late', () => calls.push('late'), { priority: 200 }), true);
assert.equal(lifecycle.use('early', () => calls.push('early'), { priority: 100 }), true);
assert.equal(lifecycle.use('early', () => calls.push('duplicate'), { priority: 1 }), false);

await lifecycle.run('unit', 'test');
assert.deepEqual(calls, ['early', 'late']);

const snapshot = lifecycle.snapshot();
assert.deepEqual(snapshot.handlers.map(item => item.id), ['early', 'late']);
assert.equal(snapshot.observer_count, 2);

assert.equal(lifecycle.remove('early'), true);
calls.length = 0;
await lifecycle.run('unit-2', 'test');
assert.deepEqual(calls, ['late']);

lifecycle.emit('manual-event', 'test');
assert.equal(events.at(-1)?.type, 'avan:ui-changed');
assert.equal(events.at(-1)?.detail?.surface, 'manual-event');

lifecycle.stop();
console.log('lifecycle.spec PASS');
