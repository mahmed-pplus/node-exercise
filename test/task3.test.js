const { test } = require('node:test');
const assert = require('node:assert/strict');
const JobQueue = require('../src/task3-queue/queue');
const { sleep, withTimeout } = require('./helpers');

const T = { timeout: 5000 };

// A job that records how many jobs are running at the same time.
function trackedJob(tracker, ms, result) {
  return async () => {
    tracker.running++;
    tracker.max = Math.max(tracker.max, tracker.running);
    await sleep(ms);
    tracker.running--;
    return result;
  };
}

test('never runs more jobs at the same time than the limit', T, async () => {
  const q = new JobQueue(3);
  const tracker = { running: 0, max: 0 };

  await Promise.all(
    Array.from({ length: 10 }, (_, i) => q.add(trackedJob(tracker, 20, i)))
  );

  assert.equal(tracker.max, 3);
});

test('returns the result of each job', T, async () => {
  const q = new JobQueue(2);
  const results = await Promise.all(
    [1, 2, 3, 4, 5].map((n) =>
      q.add(async () => {
        await sleep(5);
        return n * 2;
      })
    )
  );
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
});

test('starts jobs in the order they were added', T, async () => {
  const q = new JobQueue(1);
  const started = [];

  await Promise.all(
    [0, 1, 2, 3, 4].map((n) =>
      q.add(async () => {
        started.push(n);
        await sleep(5);
      })
    )
  );

  assert.deepEqual(started, [0, 1, 2, 3, 4]);
});

test('a failing job rejects only its own promise', T, async () => {
  const q = new JobQueue(2);

  const results = await Promise.allSettled([
    q.add(async () => 'a'),
    q.add(async () => {
      throw new Error('bad job');
    }),
    q.add(async () => 'c'),
  ]);

  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'rejected', 'fulfilled']);
  assert.equal(results[1].reason.message, 'bad job');
});

test('keeps processing jobs after some jobs have failed', T, async () => {
  const q = new JobQueue(2);
  const failing = () =>
    q.add(async () => {
      await sleep(5);
      throw new Error('bad job');
    });
  const working = (n) =>
    q.add(async () => {
      await sleep(5);
      return n;
    });

  const all = Promise.allSettled([failing(), failing(), failing(), working(1), working(2), working(3)]);
  const results = await withTimeout(all, 1500, 'Queue got stuck after failed jobs');

  assert.deepEqual(results.slice(3).map((r) => r.value), [1, 2, 3]);
});

test('onIdle() resolves only after all jobs are finished', T, async () => {
  const q = new JobQueue(3);
  let finished = 0;

  for (let i = 0; i < 3; i++) {
    q.add(async () => {
      await sleep(50);
      finished++;
    });
  }

  await withTimeout(q.onIdle(), 1500, 'onIdle() never resolved');
  assert.equal(finished, 3);
});

test('onIdle() also waits for jobs that are still waiting in the queue', T, async () => {
  const q = new JobQueue(2);
  let finished = 0;

  for (let i = 0; i < 6; i++) {
    q.add(async () => {
      await sleep(20);
      finished++;
    });
  }

  await withTimeout(q.onIdle(), 1500, 'onIdle() never resolved');
  assert.equal(finished, 6);
});

test('onIdle() resolves even when the last job failed', T, async () => {
  const q = new JobQueue(1);
  let finished = 0;

  q.add(async () => {
    await sleep(20);
    finished++;
    throw new Error('bad job');
  }).catch(() => {});

  await withTimeout(q.onIdle(), 1500, 'onIdle() never resolved after a failed job');
  assert.equal(finished, 1);
});

test('onIdle() resolves right away when there are no jobs', T, async () => {
  const q = new JobQueue(2);
  await withTimeout(q.onIdle(), 500, 'onIdle() never resolved on an empty queue');
});
