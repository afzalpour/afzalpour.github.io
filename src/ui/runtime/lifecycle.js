'use strict';

/**
 * Transitional UI lifecycle registry.
 *
 * It centralizes DOM observation and named UI enhancement handlers so feature
 * modules do not install competing body-wide observers or monkey-patch each
 * other. Handlers must be idempotent because a page/modal can be enhanced more
 * than once during its lifetime.
 */
export function installUiLifecycle({
  globalObject = window,
  documentObject = document,
  debounceMs = 40
} = {}) {
  if (globalObject.AvanUiLifecycle?.use && globalObject.AvanUiLifecycle?.schedule) {
    return globalObject.AvanUiLifecycle;
  }

  const observers = [];
  const handlers = new Map();
  const pending = new Set();
  let timer = null;
  let sequence = 0;
  let running = false;
  let rerunRequested = false;
  let lastReason = 'dom';

  const elementNode = globalObject.Node?.ELEMENT_NODE ?? 1;
  const MutationObserverCtor = globalObject.MutationObserver;
  const CustomEventCtor = globalObject.CustomEvent;

  function orderedHandlers() {
    return [...handlers.values()].sort((a, b) =>
      a.priority - b.priority || a.sequence - b.sequence
    );
  }

  async function run(surface = 'manual', reason = 'manual') {
    if (running) {
      rerunRequested = true;
      pending.add(surface || 'rerun');
      lastReason = reason || lastReason;
      return;
    }

    running = true;
    try {
      for (const entry of orderedHandlers()) {
        try {
          await entry.handler(Object.freeze({ surface, reason, id: entry.id }));
        } catch (error) {
          console.warn(`[Avan lifecycle:${entry.id}]`, error);
        }
      }
    } finally {
      running = false;
      if (rerunRequested) {
        rerunRequested = false;
        schedule('rerun', lastReason || 'rerun');
      }
    }
  }

  function emit(surface = 'unknown', reason = 'dom') {
    if (CustomEventCtor && documentObject?.dispatchEvent) {
      documentObject.dispatchEvent(new CustomEventCtor('avan:ui-changed', {
        detail: Object.freeze({ surface, reason })
      }));
    }
    void run(surface, reason);
  }

  function schedule(surface = 'unknown', reason = 'dom') {
    pending.add(surface || 'unknown');
    lastReason = reason || lastReason;
    if (timer) globalObject.clearTimeout(timer);
    timer = globalObject.setTimeout(() => {
      timer = null;
      const surfaces = [...pending];
      pending.clear();
      emit(surfaces.join(',') || 'unknown', lastReason || 'dom');
      lastReason = 'dom';
    }, debounceMs);
  }

  function use(id, handler, { priority = 100 } = {}) {
    if (!id || typeof id !== 'string') throw new Error('LIFECYCLE_HANDLER_ID_REQUIRED');
    if (typeof handler !== 'function') throw new Error('LIFECYCLE_HANDLER_REQUIRED');
    if (handlers.has(id)) return false;
    handlers.set(id, {
      id,
      handler,
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 100,
      sequence: sequence++
    });
    schedule(`register:${id}`, 'register');
    return true;
  }

  function remove(id) {
    return handlers.delete(id);
  }

  function hasElementChange(mutations = []) {
    return mutations.some(mutation =>
      [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])]
        .some(node => node?.nodeType === elementNode)
    );
  }

  function isCoreSurfaceReplacement(mutations = [], root) {
    return mutations.some(mutation =>
      mutation.target === root &&
      [...(mutation.removedNodes || [])].some(node => node?.nodeType === elementNode)
    );
  }

  function observe(selector, surface) {
    if (!MutationObserverCtor || !documentObject?.querySelector) return;
    const node = documentObject.querySelector(selector);
    if (!node) return;
    const observer = new MutationObserverCtor(mutations => {
      if (!hasElementChange(mutations)) return;

      // If the compatibility shell replaces the whole surface while an async
      // enhancement is awaiting data, request one follow-up pass. Ignore
      // descendant mutations made by the enhancement itself to avoid loops.
      if (running) {
        if (isCoreSurfaceReplacement(mutations, node)) {
          rerunRequested = true;
          pending.add(surface);
          lastReason = 'surface-replaced';
        }
        return;
      }

      schedule(surface, 'mutation');
    });
    observer.observe(node, { childList: true, subtree: true });
    observers.push(observer);
  }

  observe('#content', 'content');
  observe('#modal', 'modal');

  const api = Object.freeze({
    use,
    remove,
    run,
    emit,
    schedule,
    snapshot() {
      return Object.freeze({
        handlers: orderedHandlers().map(entry => Object.freeze({
          id: entry.id,
          priority: entry.priority
        })),
        observer_count: observers.length,
        pending: [...pending]
      });
    },
    stop() {
      if (timer) globalObject.clearTimeout(timer);
      timer = null;
      pending.clear();
      observers.splice(0).forEach(observer => observer.disconnect());
      handlers.clear();
    }
  });

  globalObject.AvanUiLifecycle = api;
  return api;
}
