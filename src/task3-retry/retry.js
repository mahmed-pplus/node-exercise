const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fn()` (async). If it fails, tries again.
 *
 * Options:
 *   retries      how many extra tries after the first one (default 3)
 *   delayMs      how long to wait before each new try (default 100)
 *   shouldRetry  optional function: (error) => true or false.
 *                If it returns false, stop and throw the error.
 */
async function retry(fn, { retries = 3, delayMs = 100, shouldRetry } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      sleep(delayMs);
    }
  }

  return lastError;
}

module.exports = retry;
