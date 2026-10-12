const { test, beforeEach } = require('node:test');
const { getOrLoad, clear } = require('../src/task2-cache/cache');
const { sleep, show, check, outcome } = require('./helpers');

const T = { timeout: 3000 };

beforeEach(() => {
  clear();
});

// A loader that takes some time and counts how often it runs.
function makeLoader(value, ms = 20) {
  const loader = async () => {
    loader.calls++;
    await sleep(ms);
    return value;
  };
  loader.calls = 0;
  return loader;
}

const unique = (list) => [...new Set(list)];

test('loads a value and returns it', T, async () => {
  const loader = makeLoader('data');
  const value = await getOrLoad('user:1', loader);
  check('called getOrLoad("user:1", loader) once. The loader returns "data"', 'the returned value', value, 'data');
});

test('returns the saved value on later calls', T, async () => {
  const loader = makeLoader('data');
  await getOrLoad('user:1', loader);
  const second = await getOrLoad('user:1', loader);

  const did = 'called getOrLoad("user:1", loader) two times, one after the other';
  check(did, 'the value returned by the second call', second, 'data');
  check(did, 'how many times loader() ran', loader.calls, 1);
});

test('different keys are saved separately', T, async () => {
  const loaderA = makeLoader('A');
  const loaderB = makeLoader('B');
  const a = await getOrLoad('a', loaderA);
  const b = await getOrLoad('b', loaderB);

  const did = 'called getOrLoad("a", loaderA), then getOrLoad("b", loaderB)';
  check(did, 'the returned values', [a, b], ['A', 'B']);
  check(did, 'how many times loaderA() and loaderB() ran', [loaderA.calls, loaderB.calls], [1, 1]);
});

test('100 calls at the same time for the same key run the loader only once', T, async () => {
  const loader = makeLoader('data');
  const results = await Promise.all(
    Array.from({ length: 100 }, () => getOrLoad('user:1', loader))
  );

  const did = 'called getOrLoad("user:1", loader) 100 times at the same time';
  check(did, 'how many times loader() ran', loader.calls, 1);
  check(did, 'the different values the 100 callers got', unique(results), ['data']);
});

test('calls at the same time for different keys each use their own loader', T, async () => {
  const loaderA = makeLoader('A');
  const loaderB = makeLoader('B');
  const results = await Promise.all([
    getOrLoad('a', loaderA),
    getOrLoad('b', loaderB),
    getOrLoad('a', loaderA),
    getOrLoad('b', loaderB),
  ]);

  const did = 'called getOrLoad at the same time for the keys "a", "b", "a", "b"';
  check(did, 'the returned values', results, ['A', 'B', 'A', 'B']);
  check(did, 'how many times loaderA() and loaderB() ran', [loaderA.calls, loaderB.calls], [1, 1]);
});

test('if the loader fails, every waiting caller gets the error and the loader ran once', T, async () => {
  let calls = 0;
  const failing = async () => {
    calls++;
    await sleep(20);
    throw new Error('boom');
  };

  const results = await Promise.all(
    Array.from({ length: 10 }, () => outcome(getOrLoad('k', failing)))
  );

  const did = 'called getOrLoad("k", loader) 10 times at the same time. The loader fails with the error "boom"';
  const got = results.map((r) => ('error' in r ? `error "${r.error}"` : `value ${show(r.value)}`));
  check(did, 'what the 10 callers got (each different result is listed once)', unique(got), ['error "boom"']);
  check(did, 'how many times loader() ran', calls, 1);
});

test('a failed load is not saved: the next call runs the loader again', T, async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls === 1) throw new Error('first call fails');
    return 'ok';
  };

  const first = await outcome(getOrLoad('k', flaky));
  const second = await outcome(getOrLoad('k', flaky));

  const did = 'called getOrLoad("k", loader) two times, one after the other. The loader fails the first time and returns "ok" the second time';
  check(did, 'what the first call got', first, { error: 'first call fails' });
  check(did, 'what the second call got', second, { value: 'ok' });
  check(did, 'how many times loader() ran', calls, 2);
});

test('a saved value is used only for ttlMs milliseconds', T, async () => {
  const loader = makeLoader('v', 1);
  await getOrLoad('k', loader, 30);
  await sleep(60);
  await getOrLoad('k', loader, 30);

  check(
    'called getOrLoad("k", loader, 30), waited 60 ms, then called it again',
    'how many times loader() ran',
    loader.calls,
    2
  );
});
