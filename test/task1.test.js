// Stops Express from printing its own error log during the tests.
process.env.NODE_ENV = 'test';

const { test, before, after, beforeEach } = require('node:test');
const app = require('../src/task1-api/app');
const db = require('../src/task1-api/db');
const { check, failure, preview, startServer } = require('./helpers');

const T = { timeout: 5000 };
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

// Sends one request to the API.
// Returns { did, status, contentType, text, body }. "body" is the parsed JSON (or undefined).
async function send(method, path, { json, raw, did } = {}) {
  const init = { method, signal: AbortSignal.timeout(2000) };
  const payload = raw ?? (json === undefined ? undefined : JSON.stringify(json));
  if (payload !== undefined) {
    init.body = payload;
    init.headers = { 'content-type': 'application/json' };
  }
  did = did || (payload === undefined ? `${method} ${path}` : `${method} ${path} with body ${payload}`);

  let res;
  let text;
  try {
    res = await fetch(`${server.base}${path}`, init);
    text = await res.text();
  } catch (err) {
    if (err.name !== 'TimeoutError') throw err;
    throw failure(did, 'the API sends a response', 'a response within 2 seconds', 'no response (the route never answered)');
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { did, status: res.status, contentType: res.headers.get('content-type') || '', text, body };
}

function checkStatus(res, status) {
  check(res.did, 'the response status', res.status, status, { 'Response body': preview(res.text) });
}

// Every error response must be JSON like { "error": "some message" }.
function checkError(res, status) {
  checkStatus(res, status);
  if (typeof res.body?.error !== 'string') {
    throw failure(res.did, 'the response body', 'JSON like { "error": "some message" }', preview(res.text));
  }
}

const ids = (orders) => (Array.isArray(orders) ? orders.map((order) => order.id) : orders);

test('GET /orders returns all orders, and ?status= filters them', T, async () => {
  const all = await send('GET', '/orders');
  checkStatus(all, 200);
  check(all.did, 'the ids of the returned orders', ids(all.body), [1, 2, 3, 4]);

  const paid = await send('GET', '/orders?status=paid');
  check(paid.did, 'the ids of the returned orders', ids(paid.body), [1, 3]);

  const paidSorted = await send('GET', '/orders?status=paid&sort=total');
  check(paidSorted.did, 'the ids of the returned orders', ids(paidSorted.body), [3, 1]);
});

test('GET /orders?sort=total returns orders sorted by total, highest first', T, async () => {
  const res = await send('GET', '/orders?sort=total');
  checkStatus(res, 200);
  check(res.did, 'the ids of the returned orders', ids(res.body), [3, 1, 4, 2]);
});

test('GET /orders?sort=total does not change the order of the data in the database', T, async () => {
  await send('GET', '/orders?sort=total');
  const second = await send('GET', '/orders');
  check(
    'first GET /orders?sort=total, then a second request: GET /orders (without sort)',
    'the ids from the second request. It has no sort, so the orders must come in the normal database order',
    ids(second.body),
    [1, 2, 3, 4]
  );
});

test('GET /orders/:id returns the order', T, async () => {
  const res = await send('GET', '/orders/2');
  checkStatus(res, 200);
  check(res.did, 'the returned order', res.body, { id: 2, customer: 'Sara', status: 'pending', total: 45 });
});

test('GET /orders/:id returns 404 when the order does not exist', T, async () => {
  const res = await send('GET', '/orders/99');
  checkError(res, 404);
});

test('GET /orders/:id returns 400 when the id is not a positive whole number', T, async () => {
  for (const id of ['abc', '0', '-1', '1.5', '2abc']) {
    const res = await send('GET', `/orders/${id}`);
    checkError(res, 400);
  }
});

test('POST /orders creates an order and returns 201', T, async () => {
  const res = await send('POST', '/orders', { json: { customer: 'Zain', total: 60 } });
  checkStatus(res, 201);
  check(res.did, 'customer, total and status of the returned order', {
    customer: res.body?.customer,
    total: res.body?.total,
    status: res.body?.status,
  }, { customer: 'Zain', total: 60, status: 'pending' });
  check(res.did, 'the returned order has a number as id', typeof res.body?.id, 'number');

  const stored = await db.findOrderById(res.body.id);
  check(`${res.did}, then looked for the new order in the database`, 'the customer of the saved order', stored?.customer, 'Zain');
});

test('POST /orders returns 400 for bad input and saves nothing', T, async () => {
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
    const res = await send('POST', '/orders', { json: body });
    checkError(res, 400);
  }

  const stored = await db.listOrders();
  check(
    `sent ${badBodies.length} POST /orders requests with bad input, then counted the orders in the database`,
    'the number of orders in the database (nothing new should be saved)',
    stored.length,
    4
  );
});

test('POST /orders returns 400 when the body is missing or is not valid JSON', T, async () => {
  const noBody = await send('POST', '/orders', { did: 'POST /orders with no body' });
  checkError(noBody, 400);

  const brokenJson = await send('POST', '/orders', { raw: '{ "customer": "Zain", ' });
  checkError(brokenJson, 400);

  const stored = await db.listOrders();
  check(
    'sent POST /orders with no body and with broken JSON, then counted the orders in the database',
    'the number of orders in the database (nothing new should be saved)',
    stored.length,
    4
  );
});

test('POST /orders ignores "id" and "status" from the body', T, async () => {
  const res = await send('POST', '/orders', { json: { customer: 'Zain', total: 60, id: 1, status: 'paid' } });
  checkStatus(res, 201);
  check(res.did, 'id and status of the returned order', { id: res.body?.id, status: res.body?.status }, { id: 5, status: 'pending' });

  const stored = await db.listOrders();
  check(`${res.did}, then read the orders from the database`, 'the ids of the orders in the database', ids(stored), [1, 2, 3, 4, 5]);
});

test('a database error returns a JSON 500 and does not show internal details', T, async () => {
  db.failNextCall();
  const res = await send('GET', '/orders', { did: 'GET /orders while the database fails with the error "DB connection lost"' });
  checkError(res, 500);

  if (!/json/.test(res.contentType)) {
    throw failure(res.did, 'the content-type header of the response', 'application/json', res.contentType || '(none)');
  }
  if (res.text.includes('DB connection lost')) {
    throw failure(res.did, 'the response body hides the real error message', 'no "DB connection lost" in the body', preview(res.text));
  }
  if (res.text.includes('node_modules') || /\bat .+:\d+:\d+/.test(res.text)) {
    throw failure(res.did, 'the response body hides the stack trace', 'no stack trace in the body', preview(res.text));
  }
});
