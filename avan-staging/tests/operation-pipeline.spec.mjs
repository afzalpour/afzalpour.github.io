import assert from 'node:assert/strict';
import { createOperationPipeline } from '../src/core/runtime/operation-pipeline.js';

const calls = [];
const client = {
  rpc: async (name, args) => {
    calls.push(['base', name, args]);
    return args.value;
  }
};

const operations = createOperationPipeline(client, { methods: ['rpc'] });

operations.use('rpc', 'inventory', async ({ args, next }) => {
  const [name, payload] = args;
  calls.push(['inventory', name, payload.value]);
  return next(name, { ...payload, value: payload.value + 1 });
}, { priority: 100 });

operations.use('rpc', 'tax', async ({ args, next }) => {
  const [name, payload] = args;
  calls.push(['tax', name, payload.value]);
  return next(name, { ...payload, value: payload.value * 2 });
}, { priority: 200 });

assert.equal(await client.rpc('save_draft_invoice', { value: 3 }), 8);
assert.deepEqual(
  calls.map(call => call[0]),
  ['inventory', 'tax', 'base']
);
assert.equal(operations.isAttached('rpc'), true);
assert.deepEqual(
  operations.snapshot().rpc.handlers.map(handler => handler.id),
  ['inventory', 'tax']
);

const pipelineRpc = client.rpc;
client.rpc = async () => 9;
assert.equal(operations.isAttached('rpc'), false);
client.rpc = pipelineRpc;
assert.equal(operations.isAttached('rpc'), true);

console.log('operation-pipeline.spec.mjs: PASS');
