const store = new Map();

/**
 * Returns the cached value for `key`.
 * If there is no fresh value, calls `loader()` (async), caches the result
 * for `ttlMs` milliseconds, and returns it.
 */
async function getOrLoad(key, loader, ttlMs = 60_000) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }

  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function clear() {
  store.clear();
}

module.exports = { getOrLoad, clear };
