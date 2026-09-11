import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createAnalyticsService,
} from "../services/analytics.service.js";

function makeResult(cityCode) {
  return {
    raw: { id: cityCode },
    weather: {
      cityCode,
      cityName: `City ${cityCode}`,
      temperature: 22,
      humidity: 50,
      windSpeed: 2,
      description: "clear sky",
      observedAt: "2026-01-01T00:00:00.000Z",
    },
    fetchedAt: new Date().toISOString(),
  };
}

describe("cached analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires rankings when their oldest raw input expires", async () => {
    const fetchWeather = vi.fn(async (code) => makeResult(code));
    const service = createAnalyticsService({ fetchWeather });

    // City 1 is retrieved at 00:00 and expires at 00:05.
    await service.getRankings([1]);

    vi.setSystemTime(Date.now() + 120_000);

    // At 00:02, city 1 is reused and city 2 is retrieved.
    const combined = await service.getRankings([1, 2]);

    expect(fetchWeather).toHaveBeenCalledTimes(2);
    expect(combined.meta.cache.remainingSeconds).toBe(180);
    expect(combined.meta.cache.expiresAt).toBe(
      "2026-01-01T00:05:00.000Z",
    );

    // Input ordering does not change the ranking cache key.
    const repeat = await service.getRankings([2, 1]);

    expect(repeat.meta.cache.status).toBe("HIT");

    vi.setSystemTime(Date.now() + 180_000);

    // At 00:05, rankings and city 1 expire.
    // City 2 remains cached.
    const refreshed = await service.getRankings([1, 2]);

    expect(refreshed.meta.cache.status).toBe("MISS");
    expect(fetchWeather.mock.calls.map(([code]) => code)).toEqual(
      [1, 2, 1],
    );
    expect(refreshed.meta.cache.remainingSeconds).toBe(120);
  });

  it("retries failed cities while reusing successful raw weather", async () => {
    let failCityTwo = true;

    const fetchWeather = vi.fn(async (code) => {
      if (code === 2 && failCityTwo) {
        throw new Error("Provider unavailable");
      }

      return makeResult(code);
    });

    const service = createAnalyticsService({ fetchWeather });

    const partial = await service.getRankings([1, 2]);

    expect(partial.meta.status).toBe("partial");
    expect(partial.data).toHaveLength(1);
    expect(service.getDiagnostics().rankings.entryCount).toBe(0);

    failCityTwo = false;

    const recovered = await service.getRankings([1, 2]);

    expect(recovered.meta.status).toBe("complete");
    expect(recovered.data).toHaveLength(2);
    expect(fetchWeather.mock.calls.map(([code]) => code)).toEqual(
      [1, 2, 2],
    );

    const repeat = await service.getRankings([1, 2]);

    expect(repeat.meta.cache.status).toBe("HIT");
    expect(fetchWeather).toHaveBeenCalledTimes(3);
  });

  it("refreshes raw weather that expires while another city loads", async () => {
    const fetchWeather = vi.fn(async (code) => {
      if (code === 2) {
        // Simulate two seconds spent loading city 2.
        vi.setSystemTime(Date.now() + 2_000);
      }

      return makeResult(code);
    });

    const service = createAnalyticsService({ fetchWeather });

    // City 1 is retrieved at 00:00 and expires at 00:05.
    await service.getRankings([1]);

    // Start a combined request one second before expiry.
    vi.setSystemTime(Date.now() + 299_000);

    const result = await service.getRankings([1, 2]);

    // City 1 expires while city 2 loads and must be fetched again.
    expect(fetchWeather.mock.calls.map(([code]) => code)).toEqual(
      [1, 2, 1],
    );

    expect(result.meta.status).toBe("complete");
    expect(result.data).toHaveLength(2);
    expect(result.failures).toEqual([]);
    expect(result.meta.cache.remainingSeconds).toBe(300);

    expect(
      Date.parse(result.meta.cache.expiresAt),
    ).toBeGreaterThan(Date.now());
  });
});