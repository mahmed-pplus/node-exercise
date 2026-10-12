# Node.js Pair-Programming Exercise

Hi! This is a small project with 4 tasks. We will work on it together.
There is no trick. We care about how you think, not only the final code.


## How to run

Open a terminal and run:

    npm test

Most tests fail at the start. Your job is to make them pass by changing the files in the "src" folder.

To run only one task:

    npm run test:1
    npm run test:2
    npm run test:3

Please do not change the files in the "test" folder. You can read them.
(If you run this on your own computer, run "npm install" first.)


## Rules

- Think out loud. Ask questions.
- You can use Google and docs (MDN, Node.js, Express).
- Please do not use AI assistants, unless the interviewer says it is OK.
- Working, readable code is enough. It does not need to be perfect.
- If you are stuck, say so. Hints are normal.


## Task 1: Orders API (Express)

Files: src/task1-api/ (start with app.js)
Run: npm run test:1

What the API should do:

GET /orders
- Return 200 and a list of orders.
- ?status=paid shows only orders with that status.
- ?sort=total sorts by total, highest first.
- Sorting must not change the stored data.

GET /orders/:id
- Return 200 and the order.
- Return 400 if the id is not a positive whole number.
- Return 404 if there is no order with that id.

POST /orders
- The body looks like this: { "customer": "Ali", "total": 50 }
- customer must be text and not empty.
- total must be a number greater than 0.
- If the input is good: return 201 and the new order (status "pending").
- If the input is bad: return 400.

Any other error
- Return 500 and a JSON body like { "error": "..." }.
- Do not show internal details to the client.


## Task 2: Cache

File: src/task2-cache/cache.js
Run: npm run test:2

getOrLoad(key, loader, ttlMs) gives back the saved value for a key.
If there is no fresh value, it calls loader() (an async function),
saves the result for ttlMs milliseconds, and returns it.

It works for simple cases, but it wastes work when many requests
arrive at the same time. Fix it.
Also think about what should happen when the loader fails.


## Task 3: Job queue

File: src/task3-queue/queue.js
Run: npm run test:3

JobQueue runs async jobs, but only a few at the same time.

- new JobQueue(3) means at most 3 jobs run at once.
- add(job): job is a function that returns a promise.
  add gives back a promise with the job's result (or its error).
- onIdle(): gives back a promise that is done when all jobs have finished.

Some tests fail. Find out why and fix the code.


## Task 4: Code review

File: src/task4-review/search-users.js

Imagine a teammate sent you this pull request. Review it like you would at work.
Write your comments in the file (start each one with // REVIEW:) or say them out loud.
Start with the most important problems. You do not need to rewrite the code.
