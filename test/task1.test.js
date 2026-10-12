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
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
});

test('GET /orders/:id returns 400 when the id is not a number', T, async () => {
  const res = await fetch(url('/orders/abc'));
  assert.equal(res.status, 400);
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
    { customer: '', total: 10 },
    { customer: 'Zain', total: -5 },
    { customer: 'Zain', total: 'abc' },
  ];

  for (const body of badBodies) {
    const res = await postJson('/orders', body);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }

  const stored = await db.listOrders();
  assert.equal(stored.length, 4);
});

test('a database error returns a JSON 500 and does not leak details', T, async () => {
  db.failNextCall();
  const res = await fetch(url('/orders'));
  assert.equal(res.status, 500);
  assert.match(res.headers.get('content-type') || '', /json/);

  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(typeof body.error, 'string');
  assert.ok(!text.includes('DB connection lost'), 'internal error message leaked');
  assert.ok(!text.includes('node_modules'), 'stack trace leaked');
});
