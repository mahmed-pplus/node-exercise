// A tiny in-memory "database". Every function is async, like a real database client.

const seed = () => [
  { id: 1, customer: 'Ali', status: 'paid', total: 120 },
  { id: 2, customer: 'Sara', status: 'pending', total: 45 },
  { id: 3, customer: 'Omar', status: 'paid', total: 300 },
  { id: 4, customer: 'Hina', status: 'shipped', total: 80 },
];

let orders = seed();
let nextId = 5;
let shouldFail = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pretend to talk to a real database.
async function query() {
  await delay(5);
  if (shouldFail) {
    shouldFail = false;
    throw new Error('DB connection lost');
  }
}

async function listOrders() {
  await query();
  return orders;
}

async function findOrderById(id) {
  await query();
  return orders.find((order) => order.id === id) || null;
}

async function createOrder(data) {
  await query();
  const order = { id: nextId++, status: 'pending', ...data };
  orders.push(order);
  return order;
}

// Helpers used by the tests.
function resetDb() {
  orders = seed();
  nextId = 5;
  shouldFail = false;
}

function failNextCall() {
  shouldFail = true;
}

module.exports = { listOrders, findOrderById, createOrder, resetDb, failNextCall };
