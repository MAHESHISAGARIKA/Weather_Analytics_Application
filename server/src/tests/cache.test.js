import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createCache } from "../services/cache.service.js";

describe("cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses a value before expiry and reloads exactly at expiry", async () => {
    const cache = createCache();

    const loader = vi.fn(async () => ({
      value: { temperature: 22 },
      expiresAt: Date.now() + 300_000,
    }));

    const first = await cache.get("city-1", loader);
    expect(first.cacheStatus).toBe("MISS");

    vi.setSystemTime(Date.now() + 299_999);

    const second = await cache.get("city-1", loader);
    expect(second.cacheStatus).toBe("HIT");
    expect(loader).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 1);

    const third = await cache.get("city-1", loader);
    expect(third.cacheStatus).toBe("MISS");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("shares one in-progress load between simultaneous callers", async () => {
    const cache = createCache();

    let release;

    const loader = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    const first = cache.get("city-1", loader);
    const second = cache.get("city-1", loader);

    // Allow the deferred loader to start.
    await Promise.resolve();

    expect(loader).toHaveBeenCalledTimes(1);

    release({
      value: "weather",
      expiresAt: Date.now() + 300_000,
    });

    const [a, b] = await Promise.all([first, second]);

    expect(a.cacheStatus).toBe("MISS");
    expect(b.cacheStatus).toBe("COALESCED");
    expect(a.value).toBe(b.value);
    expect(cache.diagnostics().inFlightRequests).toBe(0);
  });

  it("does not cache errors and allows a later retry", async () => {
    const cache = createCache();

    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("Provider unavailable"))
      .mockImplementationOnce(async () => ({
        value: "recovered",
        expiresAt: Date.now() + 300_000,
      }));

    await expect(cache.get("city-1", loader)).rejects.toThrow(
      "Provider unavailable",
    );

    expect(cache.diagnostics().entryCount).toBe(0);
    expect(cache.diagnostics().inFlightRequests).toBe(0);

    const result = await cache.get("city-1", loader);

    expect(result.value).toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("reports hit counts, miss counts, and remaining lifetime", async () => {
    const cache = createCache();

    const loader = async () => ({
      value: "weather",
      expiresAt: Date.now() + 300_000,
    });

    await cache.get("city-1", loader);

    vi.setSystemTime(Date.now() + 60_000);

    await cache.get("city-1", loader);

    const diagnostics = cache.diagnostics();

    expect(diagnostics.hits).toBe(1);
    expect(diagnostics.misses).toBe(1);
    expect(diagnostics.lastStatus).toBe("HIT");
    expect(diagnostics.entries[0].remainingSeconds).toBe(240);
  });
});