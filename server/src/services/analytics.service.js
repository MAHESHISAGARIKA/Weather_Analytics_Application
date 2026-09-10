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

      const successful = [];
      const failures = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successful.push(result.value);
        } else {
          failures.push({
            cityCode: codes[index],
            message:
              result.reason instanceof Error
                ? result.reason.message
                : "Weather retrieval failed.",
          });
        }
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

      // Partial results are returned but not cached as rankings.
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