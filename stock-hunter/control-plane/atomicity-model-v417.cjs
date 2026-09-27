'use strict';

const assert = require('node:assert/strict');

const FAILPOINTS = Object.freeze([
  'AFTER_LOCK_AND_PRECONDITIONS',
  'AFTER_AUTHORIZATION_CONSUME',
  'AFTER_ROUTING_MUTATION',
  'AFTER_STATE_VERSION_MUTATION',
  'AFTER_AUDIT_INSERT',
]);

function clone(value) {
  return structuredClone(value);
}

function initialState({ trafficPercent = 0, stateVersion = 7, routingMode = 'CHAMPION_ONLY' } = {}) {
  return {
    activation: {
      statusId: 'default',
      routingMode,
      challengerTrafficPercent: trafficPercent,
      killSwitchEngaged: trafficPercent === 0,
      stateVersion,
      lastTransition: 'TEST_BASELINE',
    },
    authorizations: {
      'auth-start': { id: 'auth-start', transition: 'START', consumed: false, consumedAtVersion: null },
      'auth-advance': { id: 'auth-advance', transition: 'ADVANCE', consumed: false, consumedAtVersion: null },
      'auth-rollback': { id: 'auth-rollback', transition: 'ROLLBACK', consumed: false, consumedAtVersion: null },
    },
    audits: [],
    ancillary: {
      recoveryIncidentOpen: false,
      holdReason: null,
    },
  };
}

function crash(failpoint, here) {
  if (failpoint === here) {
    const error = new Error(`Injected crash at ${here}`);
    error.code = 'STOCK_HUNTER_TEST_FAILPOINT';
    throw error;
  }
}

function targetFor(action, currentPercent) {
  if (action === 'START') {
    assert.equal(currentPercent, 0, 'START requires champion-only traffic');
    return 5;
  }
  if (action === 'ADVANCE') {
    const next = new Map([[5, 10], [10, 25], [25, 50]]).get(currentPercent);
    assert.ok(next, `ADVANCE has no allowed next stage from ${currentPercent}%`);
    return next;
  }
  if (action === 'ROLLBACK') {
    assert.ok(currentPercent > 0, 'ROLLBACK requires active challenger traffic');
    return 0;
  }
  throw new Error(`Unknown action: ${action}`);
}

/**
 * Transactional reference model for the 4.1.7 control-plane contract.
 *
 * IMPORTANT: this is a CI model, not proof that PostgreSQL production RPCs are
 * atomic. The live drill must inject equivalent failures inside the real DB
 * transaction and compare the same before/after invariants.
 */
function transitionAtomic(state, { action, expectedStateVersion, authorizationId, failpoint = null }) {
  const tx = clone(state);
  const before = clone(state);

  assert.equal(tx.activation.stateVersion, expectedStateVersion, 'state_version mismatch');
  crash(failpoint, 'AFTER_LOCK_AND_PRECONDITIONS');

  const auth = tx.authorizations[authorizationId];
  assert.ok(auth, 'authorization not found');
  assert.equal(auth.transition, action, 'authorization transition mismatch');
  assert.equal(auth.consumed, false, 'authorization already consumed');

  const nextPercent = targetFor(action, tx.activation.challengerTrafficPercent);
  const nextVersion = expectedStateVersion + 1;

  auth.consumed = true;
  auth.consumedAtVersion = nextVersion;
  crash(failpoint, 'AFTER_AUTHORIZATION_CONSUME');

  tx.activation.challengerTrafficPercent = nextPercent;
  tx.activation.routingMode = nextPercent === 0 ? 'ROLLED_BACK' : 'CANARY';
  tx.activation.killSwitchEngaged = nextPercent === 0;
  crash(failpoint, 'AFTER_ROUTING_MUTATION');

  tx.activation.stateVersion = nextVersion;
  tx.activation.lastTransition = action;
  crash(failpoint, 'AFTER_STATE_VERSION_MUTATION');

  tx.audits.push({
    transition: action,
    authorizationId,
    beforeStateVersion: expectedStateVersion,
    afterStateVersion: nextVersion,
    beforeTrafficPercent: before.activation.challengerTrafficPercent,
    afterTrafficPercent: nextPercent,
  });
  crash(failpoint, 'AFTER_AUDIT_INSERT');

  return tx;
}

function assertNoPartialMutation(before, after) {
  assert.deepEqual(after, before, 'forced crash leaked a partial control-plane mutation');
}

function runCrashCase(base, args, failpoint) {
  const before = clone(base);
  let visible = base;
  assert.throws(() => {
    const staged = transitionAtomic(visible, { ...args, failpoint });
    visible = staged;
  }, /Injected crash/);
  assertNoPartialMutation(before, visible);
}

function assertSuccess(base, args, expectedPercent) {
  const before = clone(base);
  const after = transitionAtomic(base, args);
  assert.equal(after.activation.stateVersion, before.activation.stateVersion + 1);
  assert.equal(after.activation.challengerTrafficPercent, expectedPercent);
  assert.equal(after.activation.lastTransition, args.action);
  assert.equal(after.authorizations[args.authorizationId].consumed, true);
  assert.equal(after.authorizations[args.authorizationId].consumedAtVersion, after.activation.stateVersion);
  assert.equal(after.audits.length, before.audits.length + 1);
  const audit = after.audits.at(-1);
  assert.equal(audit.beforeStateVersion, before.activation.stateVersion);
  assert.equal(audit.afterStateVersion, after.activation.stateVersion);
  assert.equal(audit.beforeTrafficPercent, before.activation.challengerTrafficPercent);
  assert.equal(audit.afterTrafficPercent, expectedPercent);
  assert.deepEqual(base, before, 'reference input was mutated before commit');

  assert.throws(() => transitionAtomic(after, {
    ...args,
    expectedStateVersion: after.activation.stateVersion,
  }), /authorization already consumed/);
  return after;
}

function runSuite() {
  const cases = [
    {
      name: 'START 0→5',
      base: initialState({ trafficPercent: 0, stateVersion: 11, routingMode: 'CHAMPION_ONLY' }),
      args: { action: 'START', expectedStateVersion: 11, authorizationId: 'auth-start' },
      expectedPercent: 5,
    },
    {
      name: 'ADVANCE 5→10',
      base: initialState({ trafficPercent: 5, stateVersion: 21, routingMode: 'CANARY' }),
      args: { action: 'ADVANCE', expectedStateVersion: 21, authorizationId: 'auth-advance' },
      expectedPercent: 10,
    },
    {
      name: 'ADVANCE 10→25',
      base: initialState({ trafficPercent: 10, stateVersion: 22, routingMode: 'CANARY' }),
      args: { action: 'ADVANCE', expectedStateVersion: 22, authorizationId: 'auth-advance' },
      expectedPercent: 25,
    },
    {
      name: 'ADVANCE 25→50',
      base: initialState({ trafficPercent: 25, stateVersion: 23, routingMode: 'CANARY' }),
      args: { action: 'ADVANCE', expectedStateVersion: 23, authorizationId: 'auth-advance' },
      expectedPercent: 50,
    },
    {
      name: 'ROLLBACK 25→0',
      base: initialState({ trafficPercent: 25, stateVersion: 31, routingMode: 'CANARY' }),
      args: { action: 'ROLLBACK', expectedStateVersion: 31, authorizationId: 'auth-rollback' },
      expectedPercent: 0,
    },
  ];

  let crashAssertions = 0;
  for (const testCase of cases) {
    for (const failpoint of FAILPOINTS) {
      runCrashCase(testCase.base, testCase.args, failpoint);
      crashAssertions += 1;
    }
    assertSuccess(testCase.base, testCase.args, testCase.expectedPercent);
  }

  const raceBase = initialState({ trafficPercent: 5, stateVersion: 90, routingMode: 'CANARY' });
  const winner = transitionAtomic(raceBase, {
    action: 'ADVANCE', expectedStateVersion: 90, authorizationId: 'auth-advance',
  });
  const loserBefore = clone(winner);
  assert.throws(() => transitionAtomic(winner, {
    action: 'ROLLBACK', expectedStateVersion: 90, authorizationId: 'auth-rollback',
  }), /state_version mismatch/);
  assert.deepEqual(winner, loserBefore);

  console.log(`control-plane-atomicity-model-v417: PASS (${crashAssertions} crash assertions + success/one-shot/state_version checks)`);
}

if (require.main === module) runSuite();

module.exports = { FAILPOINTS, initialState, transitionAtomic };
