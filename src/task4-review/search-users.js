// Pull request #482: "Add user search for the admin dashboard"
//
// Description: Adds GET /admin/users/search?q=... which returns matching users
// together with their orders. Needed for the support team.
//
// (This file is for code review. It is not meant to be run.)

const express = require('express');
const mysql = require('mysql');

const router = express.Router();

const db = mysql.createConnection({
  host: 'prod-db.internal',
  user: 'admin',
  password: 'Adm1n#2024',
  database: 'app',
});

router.get('/admin/users/search', (req, res) => {
  const term = req.query.q;
  console.log('Search request', req.headers.authorization, term);

  db.query("SELECT * FROM users WHERE name LIKE '%" + term + "%'", (err, users) => {
    for (const user of users) {
      db.query('SELECT * FROM orders WHERE user_id = ' + user.id, (err, orders) => {
        user.orders = orders;
      });
    }

    res.json(users);
  });
});

module.exports = router;
