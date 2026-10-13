const { inspect, isDeepStrictEqual } = require('node:util');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Turns a value into short text for a failure message.
const show = (value) => inspect(value, { depth: 5, breakLength: Infinity });

// Puts text on one line and cuts it if it is long.
function preview(text, max = 200) {
  const oneLine = String(text).replace(/\s+/g, ' ').trim();
  if (oneLine === '') return '(empty)';
  return oneLine.length > max ? `${oneLine.slice(0, max)}...` : oneLine;
}

// Builds the error that is shown when a test fails:
//   What the test did:  ...
//   What it checked:    ...
//   Expected:           ...
//   Actual:             ...
function failure(did, checked, expected, actual, extra = {}) {
  const rows = { 'What the test did': did, 'What it checked': checked, Expected: expected, Actual: actual, ...extra };
  const message = Object.entries(rows)
    .map(([label, text]) => `${`${label}:`.padEnd(20)}${text}`)
    .join('\n');
  const error = new Error(message);
  error.code = 'CHECK_FAILED';
  return error;
}

// Compares two values. If they are different, the test fails with a readable message.
function check(did, checked, actual, expected, extra) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw failure(did, checked, show(expected), show(actual), extra);
  }
}

// Waits for a promise and tells how it ended: { value: ... } or { error: 'message' }.
async function outcome(promise) {
  try {
    return { value: await promise };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
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

module.exports = { sleep, show, preview, failure, check, outcome, startServer };
