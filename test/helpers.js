const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fails with a clear message if a promise takes too long (for example a stuck queue).
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Starts the Express app on a random free port.
async function startServer(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () =>
    new Promise((resolve) => {
      if (server.closeAllConnections) server.closeAllConnections();
      server.close(() => resolve());
    });
  return { base, close };
}

module.exports = { sleep, withTimeout, startServer };
