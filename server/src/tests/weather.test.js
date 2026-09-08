import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fetchCurrentWeather,
  fetchWeatherForCities,
  validateWeatherResponse,
} from "../services/weather.service.js";

function makeWeatherResponse(cityCode = 1248991, cityName = "Colombo") {
  return {
    id: cityCode,
    name: cityName,
    weather: [
      {
        description: "scattered clouds",
      },
    ],
    main: {
      temp: 28,
      humidity: 70,
    },
    wind: {
      speed: 3,
    },
    dt: 1704067200,
  };
}

describe("validateWeatherResponse", () => {
  it("converts a valid API response into the application format", () => {
    const result = validateWeatherResponse(
      makeWeatherResponse(),
      1248991,
    );

    expect(result).toEqual({
      cityCode: 1248991,
      cityName: "Colombo",
      description: "scattered clouds",
      temperature: 28,
      humidity: 70,
      windSpeed: 3,
      observedAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("rejects a response for a different city", () => {
    expect(() =>
      validateWeatherResponse(makeWeatherResponse(), 1850147),
    ).toThrow(/unexpected city ID/i);
  });

  it("rejects missing weather fields", () => {
    const response = makeWeatherResponse();
    delete response.main.humidity;

    expect(() =>
      validateWeatherResponse(response, 1248991),
    ).toThrow(/humidity/i);
  });

  it("rejects an invalid observation timestamp", () => {
    const response = makeWeatherResponse();
    response.dt = 0;

    expect(() =>
      validateWeatherResponse(response, 1248991),
    ).toThrow(/timestamp/i);
  });

  it("rejects a missing response", () => {
    expect(() =>
      validateWeatherResponse(null, 1248991),
    ).toThrow(/JSON object/i);
  });
});

describe("weather requests", () => {
  let fetchMock;

  beforeEach(() => {
    // This dummy value exists only inside the test environment.
    vi.stubEnv("OPENWEATHER_API_KEY", "test-key-not-a-real-secret");

    // Replacing fetch prevents all real network requests in these tests.
    fetchMock = vi.fn().mockRejectedValue(
      new Error("No mock response configured for this request."),
    );

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("requests the correct city with metric units and a timeout signal", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeWeatherResponse(),
    });

    const result = await fetchCurrentWeather(1248991);

    expect(result.weather.cityCode).toBe(1248991);
    expect(result.weather.temperature).toBe(28);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, options] = fetchMock.mock.calls[0];
    const url = new URL(requestUrl);

    expect(url.origin).toBe("https://api.openweathermap.org");
    expect(url.pathname).toBe("/data/2.5/weather");
    expect(url.searchParams.get("id")).toBe("1248991");
    expect(url.searchParams.get("units")).toBe("metric");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects requests when the API key is missing", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "");

    await expect(fetchCurrentWeather(1248991)).rejects.toThrow(
      /OPENWEATHER_API_KEY/i,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an HTTP authentication failure clearly", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(fetchCurrentWeather(1248991)).rejects.toThrow(
      /HTTP 401: API key rejected/i,
    );
  });

  it("rejects malformed JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    await expect(fetchCurrentWeather(1248991)).rejects.toThrow(
      /invalid JSON/i,
    );
  });

  it("converts a network failure into a useful error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchCurrentWeather(1248991)).rejects.toThrow(
      /Could not connect to OpenWeather/i,
    );
  });

  it("keeps successful cities when another city response is malformed", async () => {
    fetchMock.mockImplementation(async (requestUrl) => {
      const cityCode = Number(
        new URL(requestUrl).searchParams.get("id"),
      );

      const response = makeWeatherResponse(
        cityCode,
        cityCode === 1248991 ? "Colombo" : "Tokyo",
      );

      if (cityCode === 1850147) {
        delete response.main.humidity;
      }

      return {
        ok: true,
        status: 200,
        json: async () => response,
      };
    });

    const result = await fetchWeatherForCities([1248991, 1850147]);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].cityCode).toBe(1248991);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].cityCode).toBe(1850147);
    expect(result.failures[0].message).toMatch(/humidity/i);

    expect(result.meta).toEqual({
      status: "partial",
      requestedCities: 2,
      successfulCities: 1,
      failedCities: 1,
      message: "Weather loaded for 1 of 2 cities.",
    });
  });

  it("reports complete success when every city is valid", async () => {
    fetchMock.mockImplementation(async (requestUrl) => {
      const cityCode = Number(
        new URL(requestUrl).searchParams.get("id"),
      );

      return {
        ok: true,
        status: 200,
        json: async () => makeWeatherResponse(cityCode),
      };
    });

    const result = await fetchWeatherForCities([1248991, 1850147]);

    expect(result.data).toHaveLength(2);
    expect(result.failures).toEqual([]);
    expect(result.meta.status).toBe("complete");
    expect(result.meta.successfulCities).toBe(2);
  });

  it("reports failure when every weather request fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await fetchWeatherForCities([1248991, 1850147]);

    expect(result.data).toEqual([]);
    expect(result.failures).toHaveLength(2);
    expect(result.meta.status).toBe("failed");
    expect(result.meta.successfulCities).toBe(0);
    expect(result.meta.failedCities).toBe(2);
  });
});