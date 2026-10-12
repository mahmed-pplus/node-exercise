const { test } = require('node:test');
const JobQueue = require('../src/task3-queue/queue');
const { sleep, check, outcome, withTimeout } = require('./helpers');

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
  const did = 'added 10 jobs to new JobQueue(3)';

  await withTimeout(
    Promise.all(Array.from({ length: 10 }, (_, i) => q.add(trackedJob(tracker, 20, i)))),
    1500,
    did,
    'all 10 jobs finish'
  );

  check(did, 'the highest number of jobs that ran at the same time', tracker.max, 3);
});

test('add() returns the result of each job', T, async () => {
  const q = new JobQueue(2);
  const did = 'added 5 jobs to new JobQueue(2). The jobs return 2, 4, 6, 8, 10';

  const results = await withTimeout(
    Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        q.add(async () => {
          await sleep(5);
          return n * 2;
        })
      )
    ),
    1500,
    did,
    'all 5 jobs finish'
  );

  check(did, 'the results that add() gave back', results, [2, 4, 6, 8, 10]);
});

test('starts jobs in the order they were added', T, async () => {
  const q = new JobQueue(1);
  const started = [];
  const did = 'added the jobs 0, 1, 2, 3, 4 to new JobQueue(1)';

  await withTimeout(
    Promise.all(
      [0, 1, 2, 3, 4].map((n) =>
        q.add(async () => {
          started.push(n);
          await sleep(5);
        })
      )
    ),
    1500,
    did,
    'all 5 jobs finish'
  );

  check(did, 'the order in which the jobs started', started, [0, 1, 2, 3, 4]);
});

test('a failing job rejects only its own promise', T, async () => {
  const q = new JobQueue(2);
  const did = 'added 3 jobs to new JobQueue(2): the first returns "a", the second fails with "bad job", the third returns "c"';

  const results = await withTimeout(
    Promise.all([
      outcome(q.add(async () => 'a')),
      outcome(q.add(async () => {
        throw new Error('bad job');
      })),
      outcome(q.add(async () => 'c')),
    ]),
    1500,
    did,
    'all 3 jobs finish'
  );

  check(did, 'what add() gave back for each job', results, [{ value: 'a' }, { error: 'bad job' }, { value: 'c' }]);
});

test('keeps running jobs after some jobs have failed', T, async () => {
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
  const did = 'added 3 failing jobs, then 3 working jobs (they return 1, 2, 3) to new JobQueue(2)';

  const results = await withTimeout(
    Promise.all([failing(), failing(), failing(), working(1), working(2), working(3)].map(outcome)),
    1500,
    did,
    'all 6 jobs finish (the queue must not get stuck)'
  );

  check(did, 'what add() gave back for the 3 working jobs', results.slice(3), [{ value: 1 }, { value: 2 }, { value: 3 }]);
});

test('onIdle() is done only after all jobs are finished', T, async () => {
  const q = new JobQueue(3);
  let finished = 0;

  for (let i = 0; i < 3; i++) {
    q.add(async () => {
      await sleep(50);
      finished++;
    });
  }

  const did = 'added 3 jobs to new JobQueue(3), then waited for onIdle()';
  await withTimeout(q.onIdle(), 1500, did, 'onIdle() is done');
  check(did, 'how many jobs were finished when onIdle() was done', finished, 3);
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

  const did = 'added 6 jobs to new JobQueue(2), then waited for onIdle()';
  await withTimeout(q.onIdle(), 1500, did, 'onIdle() is done');
  check(did, 'how many jobs were finished when onIdle() was done', finished, 6);
});

test('onIdle() is done even when the last job failed', T, async () => {
  const q = new JobQueue(1);
  let finished = 0;

  q.add(async () => {
    await sleep(20);
    finished++;
    throw new Error('bad job');
  }).catch(() => {});

  const did = 'added 1 failing job to new JobQueue(1), then waited for onIdle()';
  await withTimeout(q.onIdle(), 1500, did, 'onIdle() is done');
  check(did, 'how many jobs were finished when onIdle() was done', finished, 1);
});

test('onIdle() is done right away when there are no jobs', T, async () => {
  const q = new JobQueue(2);
  await withTimeout(q.onIdle(), 500, 'called onIdle() on a new JobQueue(2) with no jobs', 'onIdle() is done');
});
