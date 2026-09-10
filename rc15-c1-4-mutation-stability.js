(function installAvanMutationStabilityGuard(globalObject, documentObject) {
  'use strict';

  if (globalObject.__avanMutationStabilityGuard) return;

  const NativeMutationObserver = globalObject.MutationObserver;
  if (typeof NativeMutationObserver !== 'function') return;

  const ELEMENT_NODE = globalObject.Node?.ELEMENT_NODE ?? 1;

  function hasStructuralMutation(records = []) {
    return records.some(record => {
      if (record.type === 'attributes') return true;
      if (record.type !== 'childList') return true;

      return [
        ...(record.addedNodes || []),
        ...(record.removedNodes || [])
      ].some(node => node?.nodeType === ELEMENT_NODE);
    });
  }

  function GuardedMutationObserver(callback) {
    if (!(this instanceof GuardedMutationObserver)) {
      throw new TypeError("Failed to construct 'MutationObserver': Please use the 'new' operator.");
    }

    let observesBodyWide = false;

    const observer = new NativeMutationObserver((records, nativeObserver) => {
      if (observesBodyWide && !hasStructuralMutation(records)) return;
      callback(records, nativeObserver);
    });

    const nativeObserve = observer.observe.bind(observer);
    observer.observe = (target, options = {}) => {
      if (
        target === documentObject.body &&
        Boolean(options.childList) &&
        Boolean(options.subtree)
      ) {
        observesBodyWide = true;
      }
      return nativeObserve(target, options);
    };

    return observer;
  }

  GuardedMutationObserver.prototype = NativeMutationObserver.prototype;
  Object.setPrototypeOf(GuardedMutationObserver, NativeMutationObserver);

  globalObject.MutationObserver = GuardedMutationObserver;
  globalObject.__avanMutationStabilityGuard = Object.freeze({
    active: true,
    body_text_only_mutations_ignored: true
  });
})(window, document);
