'use strict';

/**
 * Transitional UI lifecycle adapter.
 *
 * Legacy app.js does not yet emit explicit page/modal lifecycle events. Until
 * the shell controller is migrated, this adapter centralizes DOM observation
 * into one scoped place instead of allowing each feature to observe document.body.
 */
export function installUiLifecycle({
  globalObject = window,
  documentObject = document,
  debounceMs = 40
} = {}) {
  if (globalObject.AvanUiLifecycle) return globalObject.AvanUiLifecycle;

  const observers = [];
  const pending = new Set();
  let timer = null;

  function emit(surface, reason = 'dom') {
    documentObject.dispatchEvent(new CustomEvent('avan:ui-changed', {
      detail: Object.freeze({ surface, reason })
    }));
  }

  function schedule(surface) {
    pending.add(surface);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const surfaces = [...pending];
      pending.clear();
      for (const surface of surfaces) emit(surface);
    }, debounceMs);
  }

  function hasElementChange(mutations) {
    return mutations.some(mutation =>
      [...mutation.addedNodes, ...mutation.removedNodes]
        .some(node => node.nodeType === Node.ELEMENT_NODE)
    );
  }

  function observe(selector, surface) {
    const node = documentObject.querySelector(selector);
    if (!node) return;
    const observer = new MutationObserver(mutations => {
      if (hasElementChange(mutations)) schedule(surface);
    });
    observer.observe(node, { childList: true, subtree: true });
    observers.push(observer);
  }

  observe('#content', 'content');
  observe('#modal', 'modal');

  const api = Object.freeze({
    emit,
    schedule,
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      observers.splice(0).forEach(observer => observer.disconnect());
    }
  });

  globalObject.AvanUiLifecycle = api;
  return api;
}
