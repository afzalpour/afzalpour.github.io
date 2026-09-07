'use strict';

/**
 * Deterministic middleware pipeline for Avan client operations.
 *
 * Goals:
 * - keep client method identities stable;
 * - replace runtime monkey-patching (`C.rpc = ...`) with named middleware;
 * - make execution order explicit and inspectable;
 * - allow gradual Strangler-pattern migration without rewriting the Core.
 */
export function createOperationPipeline(target, {
  methods = ['rpc', 'select', 'insert', 'update', 'remove', 'invokeFunction']
} = {}) {
  if (!target || typeof target !== 'object') {
    throw new Error('OPERATION_PIPELINE_TARGET_REQUIRED');
  }

  const registry = new Map();
  let sequence = 0;

  for (const method of methods) {
    if (typeof target[method] !== 'function') continue;

    const base = target[method].bind(target);
    const handlers = [];
    registry.set(method, { base, handlers });

    Object.defineProperty(target, method, {
      configurable: true,
      enumerable: true,
      writable: false,
      value: async (...initialArgs) => {
        const chain = [...handlers].sort((a, b) =>
          a.priority - b.priority || a.sequence - b.sequence
        );

        const dispatch = async (index, args) => {
          if (index >= chain.length) return base(...args);

          const entry = chain[index];
          let nextCalled = false;

          const next = async (...overrideArgs) => {
            if (nextCalled) {
              throw new Error('OPERATION_PIPELINE_NEXT_CALLED_TWICE');
            }
            nextCalled = true;
            return dispatch(
              index + 1,
              overrideArgs.length ? overrideArgs : args
            );
          };

          return entry.handler({
            method,
            args,
            next,
            target,
            id: entry.id
          });
        };

        return dispatch(0, initialArgs);
      }
    });
  }

  function getBucket(method) {
    const bucket = registry.get(method);
    if (!bucket) throw new Error(`OPERATION_PIPELINE_METHOD_UNAVAILABLE:${method}`);
    return bucket;
  }

  const api = {
    use(method, id, handler, { priority = 100 } = {}) {
      if (!id || typeof id !== 'string') {
        throw new Error('OPERATION_PIPELINE_ID_REQUIRED');
      }
      if (typeof handler !== 'function') {
        throw new Error('OPERATION_PIPELINE_HANDLER_REQUIRED');
      }

      const bucket = getBucket(method);
      if (bucket.handlers.some(entry => entry.id === id)) {
        throw new Error(`OPERATION_PIPELINE_DUPLICATE_ID:${method}:${id}`);
      }

      const entry = {
        id,
        handler,
        priority: Number.isFinite(priority) ? priority : 100,
        sequence: sequence++
      };
      bucket.handlers.push(entry);

      return () => api.remove(method, id);
    },

    remove(method, id) {
      const bucket = getBucket(method);
      const index = bucket.handlers.findIndex(entry => entry.id === id);
      if (index < 0) return false;
      bucket.handlers.splice(index, 1);
      return true;
    },

    has(method, id) {
      const bucket = registry.get(method);
      return Boolean(bucket?.handlers.some(entry => entry.id === id));
    },

    snapshot() {
      return Object.freeze(
        [...registry.entries()].reduce((result, [method, bucket]) => {
          result[method] = Object.freeze(
            [...bucket.handlers]
              .sort((a, b) => a.priority - b.priority || a.sequence - b.sequence)
              .map(entry => Object.freeze({ id: entry.id, priority: entry.priority }))
          );
          return result;
        }, {})
      );
    }
  };

  return Object.freeze(api);
}
