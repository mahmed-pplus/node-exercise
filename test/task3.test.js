const { test } = require('node:test');
const retry = require('../src/task3-retry/retry');
const { check, failure, outcome } = require('./helpers');

const T = { timeout: 3000 };

// Makes an async function that fails `failures` times and then returns "ok".
// It counts its calls and remembers when each call happened.
function makeFn(failures, message) {
  const fn = async () => {
    fn.calls++;
    fn.times.push(Date.now());
    if (fn.calls > 50) {
      process.stderr.write('\nfn() was called more than 50 times. This looks like an endless loop in retry(). The tests stop here.\n');
      process.exit(1);
    }
    if (fn.calls <= failures) throw new Error(message || `fail ${fn.calls}`);
    return 'ok';
  };
  fn.calls = 0;
  fn.times = [];
  return fn;
}

// Says in words how retry() ended.
async function ending(promise) {
  const got = await outcome(promise);
  if ('error' in got) return `threw the error "${got.error}"`;
  if (got.value instanceof Error) return `returned the error "${got.value.message}" as a normal value (it did not throw)`;
  return `returned ${JSON.stringify(got.value)}`;
}

function checkEnding(did, end, expected) {
  if (end !== expected) throw failure(did, 'how retry() ended', expected, end);
}

test('returns the result when fn() works the first time', T, async () => {
  const fn = makeFn(0);
  const end = await ending(retry(fn, { retries: 3, delayMs: 10 }));

  const did = 'called retry(fn, { retries: 3, delayMs: 10 }). fn() works the first time and returns "ok"';
  checkEnding(did, end, 'returned "ok"');
  check(did, 'how many times fn() was called', fn.calls, 1);
});

test('calls fn() again when it fails', T, async () => {
  const fn = makeFn(2);
  const end = await ending(retry(fn, { retries: 3, delayMs: 10 }));

  const did = 'called retry(fn, { retries: 3, delayMs: 10 }). fn() fails 2 times, then returns "ok"';
  checkEnding(did, end, 'returned "ok"');
  check(did, 'how many times fn() was called', fn.calls, 3);
});

test('"retries: 3" means at most 4 calls in total', T, async () => {
  const fn = makeFn(Infinity);
  await ending(retry(fn, { retries: 3, delayMs: 10 }));

  check(
    'called retry(fn, { retries: 3, delayMs: 10 }). fn() fails every time',
    'how many times fn() was called (1 first try + 3 retries)',
    fn.calls,
    4
  );
});

test('"retries: 0" means only one try', T, async () => {
  const fn = makeFn(Infinity);
  const end = await ending(retry(fn, { retries: 0, delayMs: 10 }));

  const did = 'called retry(fn, { retries: 0, delayMs: 10 }). fn() fails every time with "fail 1", "fail 2", ...';
  check(did, 'how many times fn() was called', fn.calls, 1);
  checkEnding(did, end, 'threw the error "fail 1"');
});

test('throws the error of the last try when every try fails', T, async () => {
  const fn = makeFn(Infinity);
  const end = await ending(retry(fn, { retries: 3, delayMs: 10 }));

  checkEnding(
    'called retry(fn, { retries: 3, delayMs: 10 }). fn() fails every time with "fail 1", "fail 2", ...',
    end,
    'threw the error "fail 4"'
  );
});

test('waits delayMs before each new try', T, async () => {
  const fn = makeFn(2);
  await ending(retry(fn, { retries: 3, delayMs: 60 }));

  const did = 'called retry(fn, { retries: 3, delayMs: 60 }). fn() fails 2 times, then returns "ok"';
  check(did, 'how many times fn() was called', fn.calls, 3);

  const waits = [fn.times[1] - fn.times[0], fn.times[2] - fn.times[1]];
  if (Math.min(...waits) < 55) {
    throw failure(did, 'the time between the tries', 'at least 60 ms before each new try', `${waits[0]} ms before try 2, ${waits[1]} ms before try 3`);
  }
});

test('does not wait after the last try', T, async () => {
  const fn = makeFn(Infinity);
  const start = Date.now();
  await ending(retry(fn, { retries: 1, delayMs: 200 }));
  const took = Date.now() - start;

  const did = 'called retry(fn, { retries: 1, delayMs: 200 }). fn() fails every time';
  check(did, 'how many times fn() was called', fn.calls, 2);
  if (took < 180 || took > 330) {
    throw failure(did, 'how long retry() took', 'about 200 ms (one wait, between try 1 and try 2)', `${took} ms`);
  }
});

test('stops right away when shouldRetry returns false', T, async () => {
  const fn = makeFn(Infinity, 'bad input');
  const shouldRetry = (error) => error.message !== 'bad input';
  const end = await ending(retry(fn, { retries: 3, delayMs: 10, shouldRetry }));

  const did = 'called retry(fn, { retries: 3, delayMs: 10, shouldRetry }). fn() always fails with "bad input", and shouldRetry returns false for that error';
  check(did, 'how many times fn() was called', fn.calls, 1);
  checkEnding(did, end, 'threw the error "bad input"');
});

test('keeps trying when shouldRetry returns true', T, async () => {
  const fn = makeFn(2, 'timeout');
  const shouldRetry = (error) => error.message !== 'bad input';
  const end = await ending(retry(fn, { retries: 3, delayMs: 10, shouldRetry }));

  const did = 'called retry(fn, { retries: 3, delayMs: 10, shouldRetry }). fn() fails 2 times with "timeout", then returns "ok". shouldRetry returns true for "timeout"';
  checkEnding(did, end, 'returned "ok"');
  check(did, 'how many times fn() was called', fn.calls, 3);
});
