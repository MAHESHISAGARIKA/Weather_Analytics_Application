export function createCache() {
  const entries = new Map();
  const pending = new Map();

  const counts = {
    hits: 0,
    misses: 0,
    coalesced: 0,
  };

  let lastStatus = null;

  function removeExpired() {
    const now = Date.now();

    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) {
        entries.delete(key);
      }
    }
  }

  async function get(key, loader) {
    removeExpired();

    const existing = entries.get(key);

    if (existing) {
      counts.hits += 1;
      lastStatus = "HIT";

      return {
        ...existing,
        cacheStatus: "HIT",
      };
    }

    // Another request is already loading this same key.
    if (pending.has(key)) {
      counts.coalesced += 1;
      lastStatus = "COALESCED";

      const entry = await pending.get(key);

      return {
        ...entry,
        cacheStatus: "COALESCED",
      };
    }

    counts.misses += 1;
    lastStatus = "MISS";

    // Defer the loader so the pending promise is registered first.
    const promise = Promise.resolve()
      .then(loader)
      .then((entry) => {
        if (!Number.isFinite(entry.expiresAt)) {
          throw new Error("Cache entry requires a valid expiry.");
        }

        // An expired entry can be returned, but must not be cached.
        if (entry.expiresAt > Date.now()) {
          entries.set(key, entry);
        }

        return entry;
      });

    pending.set(key, promise);

    try {
      const entry = await promise;

      return {
        ...entry,
        cacheStatus: "MISS",
      };
    } finally {
      // Also runs after failure, allowing the next request to retry.
      pending.delete(key);
    }
  }

  function diagnostics() {
    removeExpired();

    const now = Date.now();

    return {
      ...counts,
      lastStatus,
      entryCount: entries.size,
      inFlightRequests: pending.size,
      entries: [...entries].map(([key, entry]) => ({
        key,
        expiresAt: new Date(entry.expiresAt).toISOString(),
        remainingSeconds: Math.max(
          0,
          Math.ceil((entry.expiresAt - now) / 1000),
        ),
      })),
    };
  }

  return {
    get,
    diagnostics,
  };
}