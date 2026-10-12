const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { getOrLoad, clear } = require('../src/task2-cache/cache');
const { sleep } = require('./helpers');

const T = { timeout: 3000 };

beforeEach(() => {
  clear();
});

function makeLoader(value, ms = 20) {
  const loader = async () => {
    loader.calls++;
    await sleep(ms);
    return value;
  };
  loader.calls = 0;
  return loader;
}

test('loads a value and returns it', T, async () => {
  const loader = makeLoader('data');
  assert.equal(await getOrLoad('user:1', loader), 'data');
});

test('returns the cached value on later calls', T, async () => {
  const loader = makeLoader('data');
  await getOrLoad('user:1', loader);
  await getOrLoad('user:1', loader);
  assert.equal(loader.calls, 1);
});

test('different keys are cached separately', T, async () => {
  const loaderA = makeLoader('A');
  const loaderB = makeLoader('B');
  assert.equal(await getOrLoad('a', loaderA), 'A');
  assert.equal(await getOrLoad('b', loaderB), 'B');
  assert.equal(loaderA.calls, 1);
  assert.equal(loaderB.calls, 1);
});

test('100 parallel calls for the same key call the loader only once', T, async () => {
  const loader = makeLoader('data');
  const results = await Promise.all(
    Array.from({ length: 100 }, () => getOrLoad('user:1', loader))
  );
  assert.equal(loader.calls, 1);
  assert.ok(results.every((r) => r === 'data'));
});

test('parallel calls for different keys each use their own loader', T, async () => {
  const loaderA = makeLoader('A');
  const loaderB = makeLoader('B');
  const results = await Promise.all([
    getOrLoad('a', loaderA),
    getOrLoad('b', loaderB),
    getOrLoad('a', loaderA),
    getOrLoad('b', loaderB),
  ]);
  assert.deepEqual(results, ['A', 'B', 'A', 'B']);
  assert.equal(loaderA.calls, 1);
  assert.equal(loaderB.calls, 1);
});

test('if the loader fails, all waiting callers get the error and the loader ran once', T, async () => {
  let calls = 0;
  const failing = async () => {
    calls++;
    await sleep(20);
    throw new Error('boom');
  };

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => getOrLoad('k', failing))
  );

  assert.ok(results.every((r) => r.status === 'rejected' && r.reason.message === 'boom'));
  assert.equal(calls, 1);
});

test('a failed load is not cached: the next call tries again', T, async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls === 1) throw new Error('first call fails');
    return 'ok';
  };

  await assert.rejects(getOrLoad('k', flaky), /first call fails/);
  assert.equal(await getOrLoad('k', flaky), 'ok');
  assert.equal(calls, 2);
});

test('a cached value expires after ttlMs', T, async () => {
  const loader = makeLoader('v', 1);
  await getOrLoad('k', loader, 30);
  await sleep(60);
  await getOrLoad('k', loader, 30);
  assert.equal(loader.calls, 2);
});
