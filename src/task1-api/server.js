const app = require('./app');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Orders API running on http://localhost:${port}`);
});
