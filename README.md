# Node.js Pair-Programming Exercise

Welcome! We will work on this project together.


## The idea

- The code in the "src" folder is already written, but it has bugs and missing parts.
- The tests in the "test" folder check the correct behaviour.
- Your job: fix the code in "src" until the tests pass.

There are 4 tasks. Start with Task 1 and go in order.
You may not finish all of them. That is OK.
We care about how you think, not only the final code.


## How to run the tests

Type one of these in the terminal:

    npm test          (all tasks)
    npm run test:1    (only Task 1)
    npm run test:2    (only Task 2)
    npm run test:3    (only Task 3)

Many tests fail at the start. This is expected.
A task is done when all its tests pass.


## Rules

- Change only the files in "src". Do not change the files in "test" (you can read them).
- Think out loud. Ask questions.
- You can use Google and docs (MDN, Node.js, Express).
- Please do not use AI assistants.
- Working, readable code is enough. It does not need to be perfect.
- If you are stuck, say so. Hints are normal.


## Task 1: Fix the Orders API

Folder: src/task1-api/

    app.js      the API routes. Most of your changes go here.
    db.js       a small fake database. You can change it too.
    server.js   starts the API. You do not need to change it.

Tests: npm run test:1

app.js has three routes. They run, but they do not follow the rules below yet.
Change the code so that every rule is true.

Route 1: GET /orders

- Returns 200 and the list of orders.
- With ?status=paid it returns only the orders with that status.
- With ?sort=total it returns the orders sorted by total, highest first.
- Sorting must not change the order of the data in the database.

Route 2: GET /orders/:id

- Returns 200 and the order with that id.
- Returns 404 if there is no order with that id.
- Returns 400 if the id is not a positive whole number.
  Examples of bad ids: abc, 0, -1, 1.5, 2abc

Route 3: POST /orders

- The body is JSON, like this: { "customer": "Ali", "total": 50 }
- Good input: save the order, return 201 and the new order.
  A new order always has the status "pending".
- Bad input: save nothing and return 400. Input is bad when:
  - customer is missing, is not text, or is empty
  - total is missing, is not a number, or is not greater than 0
  - there is no body, or the body is not valid JSON
- The database chooses the id. If the body has "id" or "status", ignore them.

Errors (all routes)

- Every error response (400, 404, 500) is JSON, like this: { "error": "some message" }
- If something unexpected fails (for example the database), return 500.
- A 500 response must not show internal details (no real error message, no stack trace).


## Task 2: Fix the cache

File: src/task2-cache/cache.js
Tests: npm run test:2

What the function does:

    getOrLoad(key, loader, ttlMs)

- If a fresh value is saved for the key, it returns that value.
- If not, it calls loader() (an async function), saves the result
  for ttlMs milliseconds, and returns it.

The problem: when many callers ask for the same key at the same time,
loader() runs once for each caller. That wastes work.

Change the code so that every rule is true:

- Callers that ask for the same key at the same time share one loader() call.
- Different keys do not share a loader() call.
- If loader() fails, every waiting caller gets the error.
- A failed load is not saved. The next call runs loader() again.
- A saved value is used only for ttlMs milliseconds.


## Task 3: Fix the retry helper

File: src/task3-retry/retry.js
Tests: npm run test:3

Sometimes a call fails only for a short time (for example a network problem).
Then it helps to try again. This is what retry() does:

    retry(fn, { retries, delayMs, shouldRetry })

The function is already written, but it has more than one bug.
Find the bugs and fix them.

How it should work:

- It calls fn() (an async function). If fn() works, retry() returns its result.
- If fn() fails, it calls fn() again. "retries" is the number of extra tries.
  Example: retries: 3 means at most 4 calls in total.
- Before each new try, it waits delayMs milliseconds.
- If the last try also fails, retry() throws the error of that last try.
  It does not wait after the last try.
- shouldRetry is optional. It is a function that gets the error and returns true or false.
  If it returns false, retry() stops right away and throws that error.


## Task 4: Code review

File: src/task4-review/search-users.js

This task has no tests and you do not need to write code.

Imagine a teammate sent you this file as a pull request.
Review it like you would at work:

- Say your comments out loud, or write them in the file (start each one with // REVIEW:).
- Start with the most important problems.
- You do not need to rewrite the code.
