# Node.js Pair-Programming Exercise

Welcome! This is a small project with a few tasks. We will work on it together.
There is no trick. We care about **how you think**, not only the final code.

## How to run

```bash
npm install      # first time only
npm test         # run all tests
npm run test:1   # only Task 1 (also test:2, test:3)
```

Most tests start red. Your job is to make them green by changing the files in `src/`.
Please do not edit the files in `test/`. You can read them.

## Ground rules

- Think out loud. Ask questions. Asking questions is a good sign.
- You can use docs and Google (MDN, Node.js docs, Express docs).
- Please do not use AI assistants unless your interviewer says it is OK.
- Perfect code is not required. Working and readable code is the goal.
- If you get stuck, say so. Hints are normal.

---

## Task 1: Orders API (Express)

Files: `src/task1-api/` (start in `app.js`). Tests: `npm run test:1`

The API should behave like this:

| Endpoint | Expected behavior |
| --- | --- |
| `GET /orders` | `200` and a JSON array. `?status=paid` filters by status. `?sort=total` sorts by total, highest first. It must **not** change the stored data. |
| `GET /orders/:id` | `200` and the order. `400` if the id is not a positive integer. `404` if the order does not exist. |
| `POST /orders` | Body: `{ "customer": string, "total": number }`. `customer` must be a non-empty string. `total` must be a number greater than 0. Returns `201` and the new order (status `pending`). Returns `400` for invalid input. |
| Any error | `500` and a JSON body like `{ "error": "..." }`. Do not show internal details to the client. |

---

## Task 2: Cache

File: `src/task2-cache/cache.js`. Tests: `npm run test:2`

`getOrLoad(key, loader, ttlMs)` returns the cached value for `key`.
If there is no fresh value, it calls `loader()` (an async function), stores the result for `ttlMs` milliseconds, and returns it.

Right now it works for simple cases, but it is too expensive when many requests arrive at the same time.
Make it behave well under load. Think about what should happen when the loader fails.

---

## Task 3: Job queue

File: `src/task3-queue/queue.js`. Tests: `npm run test:3`

`JobQueue` runs async jobs, but only a limited number at the same time.

- `new JobQueue(concurrency)`: maximum number of jobs running at once.
- `add(job)`: `job` is a function that returns a promise. `add` returns a promise with the job's result (or its error).
- `onIdle()`: returns a promise that resolves when all added jobs are finished.

The tests show that some behavior is wrong. Find out why and fix it.

---

## Task 4: Code review

File: `src/task4-review/search-users.js`

Imagine a teammate opened this pull request. Review it as you would at work.
Write your comments in the file (start each with `// REVIEW:`) or say them out loud.
Start with the most important problems. You do not need to rewrite the code.
