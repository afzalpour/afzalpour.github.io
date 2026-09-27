'use strict';

const assert = require('node:assert/strict');
const { initialState, transitionAtomic } = require('./atomicity-model-v417.cjs');

class AdvisoryMutex {
  constructor() {
    this.tail = Promise.resolve();
  }
  async withLock(fn) {
    let release;
    const previous = this.tail;
    this.tail = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await fn(); } finally { release(); }
  }
}

function addAuthorization(state, id, transition) {
  state.authorizations[id] = { id, transition, consumed: false, consumedAtVersion: null };
}

function normalizeTransitionError(error) {
  if (/state_version mismatch/.test(error?.message || '')) {
    const normalized = new Error('STALE_STATE_VERSION');
    normalized.code = 'STALE_STATE_VERSION';
    return normalized;
  }
  return error;
}

async function racePair({ name, base, left, right, expectedTraffic }) {
  const lock = new AdvisoryMutex();
  let shared = structuredClone(base);
  const before = structuredClone(shared);

  async function contender(label, args, holdMs) {
    return lock.withLock(async () => {
      if (holdMs) await new Promise(resolve => setTimeout(resolve, holdMs));
      try {
        const next = transitionAtomic(shared, args);
        shared = next;
        return { label, ok: true, version: next.activation.stateVersion };
      } catch (error) {
        throw Object.assign(normalizeTransitionError(error), { contender: label });
      }
    });
  }

  const settled = await Promise.allSettled([
    contender('left', left, 20),
    contender('right', right, 0),
  ]);

  const winners = settled.filter(x => x.status === 'fulfilled');
  const losers = settled.filter(x => x.status === 'rejected');
  assert.equal(winners.length, 1, `${name}: exactly one transition must win`);
  assert.equal(losers.length, 1, `${name}: exactly one transition must lose`);
  assert.equal(losers[0].reason.code, 'STALE_STATE_VERSION', `${name}: loser must fail cleanly on state_version`);
  assert.equal(shared.activation.stateVersion, before.activation.stateVersion + 1, `${name}: version increments exactly once`);
  assert.equal(shared.activation.challengerTrafficPercent, expectedTraffic, `${name}: only winner traffic mutation is visible`);
  assert.equal(shared.audits.length, before.audits.length + 1, `${name}: exactly one audit event`);

  const consumed = Object.values(shared.authorizations).filter(a => a.consumed);
  assert.equal(consumed.length, 1, `${name}: exactly one authorization consumed`);
  const loserAuthId = losers[0].reason.contender === 'left' ? left.authorizationId : right.authorizationId;
  assert.equal(shared.authorizations[loserAuthId].consumed, false, `${name}: losing authorization remains unconsumed`);
}

async function runSuite() {
  const start = initialState({ trafficPercent: 0, stateVersion: 100, routingMode: 'CHAMPION_ONLY' });
  addAuthorization(start, 'auth-start-b', 'START');
  const advance = initialState({ trafficPercent: 5, stateVersion: 200, routingMode: 'CANARY' });
  addAuthorization(advance, 'auth-advance-b', 'ADVANCE');
  const rollback = initialState({ trafficPercent: 25, stateVersion: 300, routingMode: 'CANARY' });
  addAuthorization(rollback, 'auth-rollback-b', 'ROLLBACK');
  const conflict = initialState({ trafficPercent: 25, stateVersion: 400, routingMode: 'CANARY' });

  await racePair({ name: 'START vs START', base: start,
    left: { action: 'START', expectedStateVersion: 100, authorizationId: 'auth-start' },
    right: { action: 'START', expectedStateVersion: 100, authorizationId: 'auth-start-b' }, expectedTraffic: 5 });
  await racePair({ name: 'ADVANCE vs ADVANCE', base: advance,
    left: { action: 'ADVANCE', expectedStateVersion: 200, authorizationId: 'auth-advance' },
    right: { action: 'ADVANCE', expectedStateVersion: 200, authorizationId: 'auth-advance-b' }, expectedTraffic: 10 });
  await racePair({ name: 'ROLLBACK vs ROLLBACK', base: rollback,
    left: { action: 'ROLLBACK', expectedStateVersion: 300, authorizationId: 'auth-rollback' },
    right: { action: 'ROLLBACK', expectedStateVersion: 300, authorizationId: 'auth-rollback-b' }, expectedTraffic: 0 });
  await racePair({ name: 'ADVANCE vs ROLLBACK', base: conflict,
    left: { action: 'ADVANCE', expectedStateVersion: 400, authorizationId: 'auth-advance' },
    right: { action: 'ROLLBACK', expectedStateVersion: 400, authorizationId: 'auth-rollback' }, expectedTraffic: 50 });

  console.log('control-plane-concurrency-v417: PASS (4 real async contention races; one winner each)');
}

if (require.main === module) runSuite().catch(error => { console.error(error); process.exitCode = 1; });
