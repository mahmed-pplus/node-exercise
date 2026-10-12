const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/task1-api/app');
const db = require('../src/task1-api/db');
const { startServer } = require('./helpers');

const T = { timeout: 3000 };
let server;

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
});

beforeEach(() => {
  db.resetDb();
});

const url = (path) => `${server.base}${path}`;
const postJson = (path, body) =>
  fetch(url(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

// Every error response must be JSON like { "error": "some message" }.
async function assertError(res, status, message) {
  assert.equal(res.status, status, message);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    assert.fail(`expected a JSON error body, but got: ${text.slice(0, 80)}`);
  }
  assert.equal(typeof body.error, 'string', 'the error body needs an "error" text field');
  return text;
}

test('GET /orders returns all orders, and ?status= filters them', T, async () => {
  const all = await fetch(url('/orders'));
  assert.equal(all.status, 200);
  assert.deepEqual((await all.json()).map((o) => o.id), [1, 2, 3, 4]);

  const paid = await fetch(url('/orders?status=paid'));
  assert.deepEqual((await paid.json()).map((o) => o.id), [1, 3]);

  const paidSorted = await fetch(url('/orders?status=paid&sort=total'));
  assert.deepEqual((await paidSorted.json()).map((o) => o.id), [3, 1]);
});

test('GET /orders?sort=total returns orders sorted by total, highest first', T, async () => {
  const res = await fetch(url('/orders?sort=total'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.map((o) => o.id), [3, 1, 4, 2]);
});

test('GET /orders?sort=total does not change the stored order of the data', T, async () => {
  await fetch(url('/orders?sort=total'));
  const stored = await db.listOrders();
  assert.deepEqual(stored.map((o) => o.id), [1, 2, 3, 4]);
});

test('GET /orders/:id returns the order', T, async () => {
  const res = await fetch(url('/orders/2'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, 2);
  assert.equal(body.customer, 'Sara');
});

test('GET /orders/:id returns 404 when the order does not exist', T, async () => {
  const res = await fetch(url('/orders/99'));
  await assertError(res, 404);
});

test('GET /orders/:id returns 400 when the id is not a positive whole number', T, async () => {
  for (const id of ['abc', '0', '-1', '1.5', '2abc']) {
    const res = await fetch(url(`/orders/${id}`));
    await assertError(res, 400, `expected 400 for id "${id}"`);
  }
});

test('POST /orders creates an order and returns 201', T, async () => {
  const res = await postJson('/orders', { customer: 'Zain', total: 60 });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.customer, 'Zain');
  assert.equal(body.total, 60);
  assert.equal(body.status, 'pending');
  assert.ok(body.id);

  const stored = await db.findOrderById(body.id);
  assert.equal(stored.customer, 'Zain');
});

test('POST /orders returns 400 for invalid input and creates nothing', T, async () => {
  const badBodies = [
    {},
    { customer: 'Zain' },
    { total: 10 },
    { customer: '', total: 10 },
    { customer: 123, total: 10 },
    { customer: 'Zain', total: 0 },
    { customer: 'Zain', total: -5 },
    { customer: 'Zain', total: 'abc' },
    { customer: 'Zain', total: '50' },
  ];

  for (const body of badBodies) {
    const res = await postJson('/orders', body);
    await assertError(res, 400, `expected 400 for ${JSON.stringify(body)}`);
  }

  const stored = await db.listOrders();
  assert.equal(stored.length, 4);
});

test('POST /orders returns 400 when the body is missing or is not valid JSON', T, async () => {
  const noBody = await fetch(url('/orders'), { method: 'POST' });
  await assertError(noBody, 400, 'expected 400 when there is no body');

  const brokenJson = await fetch(url('/orders'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{ "customer": "Zain", ',
  });
  await assertError(brokenJson, 400, 'expected 400 for broken JSON');

  const stored = await db.listOrders();
  assert.equal(stored.length, 4);
});

test('POST /orders does not let the client set id or status', T, async () => {
  const res = await postJson('/orders', { customer: 'Zain', total: 60, id: 1, status: 'paid' });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.id, 5);
  assert.equal(body.status, 'pending');

  const stored = await db.listOrders();
  assert.deepEqual(stored.map((o) => o.id), [1, 2, 3, 4, 5]);
});

test('a database error returns a JSON 500 and does not leak details', T, async () => {
  db.failNextCall();
  const res = await fetch(url('/orders'));
  assert.match(res.headers.get('content-type') || '', /json/);

  const text = await assertError(res, 500);
  assert.ok(!text.includes('DB connection lost'), 'internal error message leaked');
  assert.ok(!text.includes('node_modules'), 'stack trace leaked');
});
