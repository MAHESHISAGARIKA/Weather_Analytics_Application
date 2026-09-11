import { createCache } from "./cache.service.js";
import { fetchCurrentWeather } from "./weather.service.js";
import { rankCities } from "./ranking.service.js";
import { COMFORT_CONFIG } from "./comfort-index.service.js";

const WEATHER_TTL_MS = 300_000;

export function createAnalyticsService({
  fetchWeather = fetchCurrentWeather,
} = {}) {
  const rawCache = createCache();
  const rankingCache = createCache();

  async function getRawWeather(cityCode) {
    return rawCache.get(String(cityCode), async () => {
      const result = await fetchWeather(cityCode);

      return {
        value: result,
        expiresAt: Date.now() + WEATHER_TTL_MS,
      };
    });
  }

  async function getRankings(cityCodes) {
    if (
      !Array.isArray(cityCodes) ||
      cityCodes.length === 0 ||
      cityCodes.some(
        (code) => !Number.isSafeInteger(code) || code <= 0,
      )
    ) {
      throw new Error(
        "Provide a non-empty array of valid city codes.",
      );
    }

    const codes = [...new Set(cityCodes)].sort((a, b) => a - b);

    const key = JSON.stringify({
      formula: COMFORT_CONFIG,
      cityCodes: codes,
    });

    const cached = await rankingCache.get(key, async () => {
      const results = await Promise.allSettled(
        codes.map((code) => getRawWeather(code)),
      );

      // Cached weather may expire while another city is loading.
      // Refresh those expired inputs once.
      const expiredIndexes = results.flatMap((result, index) =>
        result.status === "fulfilled" &&
        result.value.expiresAt <= Date.now()
          ? [index]
          : [],
      );

      const refreshed = await Promise.allSettled(
        expiredIndexes.map((index) =>
          getRawWeather(codes[index]),
        ),
      );

      expiredIndexes.forEach((index, position) => {
        results[index] = refreshed[position];
      });

      const completedAt = Date.now();
      const successful = [];
      const failures = [];

      results.forEach((result, index) => {
        if (
          result.status === "fulfilled" &&
          result.value.expiresAt > completedAt
        ) {
          successful.push(result.value);
          return;
        }

        // Exclude any input that expired during the refresh round.
        // Do not retry indefinitely.
        failures.push({
          cityCode: codes[index],
          message:
            result.status === "fulfilled"
              ? "Weather expired during retrieval. Refresh to try again."
              : result.reason instanceof Error
                ? result.reason.message
                : "Weather retrieval failed.",
        });
      });

      const status =
        failures.length === 0
          ? "complete"
          : successful.length === 0
            ? "failed"
            : "partial";

      const data = rankCities(
        successful.map((entry) => entry.value.weather),
      );

      const oldestExpiry =
        successful.length > 0
          ? Math.min(
              ...successful.map((entry) => entry.expiresAt),
            )
          : 0;

      // Complete rankings cannot outlive their oldest raw input.
      // Partial and failed results are returned without being cached.
      const expiresAt =
        status === "complete" ? oldestExpiry : 0;

      return {
        value: {
          data,
          failures,
          meta: {
            status,
            calculatedAt: new Date().toISOString(),
            requestedCities: codes.length,
            successfulCities: successful.length,
            failedCities: failures.length,
            message:
              status === "complete"
                ? `Weather loaded for all ${codes.length} cities.`
                : `Weather loaded for ${successful.length} of ${codes.length} cities.`,
          },
        },
        expiresAt,
      };
    });

    return {
      ...cached.value,
      meta: {
        ...cached.value.meta,
        cache: {
          status: cached.cacheStatus,
          expiresAt:
            cached.expiresAt > 0
              ? new Date(cached.expiresAt).toISOString()
              : null,
          remainingSeconds: Math.max(
            0,
            Math.ceil(
              (cached.expiresAt - Date.now()) / 1000,
            ),
          ),
        },
      },
    };
  }

  function getDiagnostics() {
    return {
      generatedAt: new Date().toISOString(),
      ttlSeconds: WEATHER_TTL_MS / 1000,
      raw: rawCache.diagnostics(),
      rankings: rankingCache.diagnostics(),
    };
  }

  return {
    getRankings,
    getDiagnostics,
  };
}

export const analyticsService = createAnalyticsService();