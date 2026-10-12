const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

// List orders. Optional: ?status=paid  and  ?sort=total (highest first)
app.get('/orders', async (req, res) => {
  const orders = await db.listOrders();
  let result = orders;

  if (req.query.status) {
    result = result.filter((order) => order.status === req.query.status);
  }

  if (req.query.sort === 'total') {
    result.sort((a, b) => b.total - a.total);
  }

  res.json(result);
});

// Get one order by id
app.get('/orders/:id', async (req, res) => {
  const order = db.findOrderById(req.params.id);
  res.json(order);
});

// Create an order. Body: { customer, total }
app.post('/orders', async (req, res) => {
  const order = await db.createOrder(req.body);
  res.json(order);
});

module.exports = app;
