// Convert a provider response into validated application data.
export function validateWeatherResponse(data, requestedCityCode) {
  if (!data || typeof data !== "object") {
    throw new Error("Weather response must be a JSON object.");
  }

  if (data.id !== requestedCityCode) {
    throw new Error("Weather response contains an unexpected city ID.");
  }

  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Weather response is missing the city name.");
  }

  const description = data.weather?.[0]?.description;
  const temperature = data.main?.temp;
  const humidity = data.main?.humidity;
  const windSpeed = data.wind?.speed;
  const timestamp = data.dt;

  if (typeof description !== "string" || !description.trim()) {
    throw new Error("Weather response is missing its description.");
  }

  if (!Number.isFinite(temperature) || temperature < -273.15) {
    throw new Error("Weather response contains an invalid temperature.");
  }

  if (
    !Number.isFinite(humidity) ||
    humidity < 0 ||
    humidity > 100
  ) {
    throw new Error("Humidity must be between 0 and 100.");
  }

  if (!Number.isFinite(windSpeed) || windSpeed < 0) {
    throw new Error("Wind speed must be a non-negative number.");
  }

  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error("Weather response contains an invalid timestamp.");
  }

  const observedDate = new Date(timestamp * 1000);

  if (!Number.isFinite(observedDate.getTime())) {
    throw new Error("Weather timestamp cannot be converted to a date.");
  }

  return {
    cityCode: data.id,
    cityName: data.name.trim(),
    description: description.trim(),
    temperature,
    humidity,
    windSpeed,
    observedAt: observedDate.toISOString(),
  };
}

export async function fetchCurrentWeather(cityCode) {
  if (!Number.isSafeInteger(cityCode) || cityCode <= 0) {
    throw new Error("A valid numeric city code is required.");
  }

  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();

  if (!apiKey || apiKey === "your_openweather_api_key") {
    throw new Error(
      "Set OPENWEATHER_API_KEY in server/.env before requesting weather."
    );
  }

  const url = new URL(
    "https://api.openweathermap.org/data/2.5/weather"
  );

  url.searchParams.set("id", String(cityCode));
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  // Covers fetching the response and reading its body.
  const signal = AbortSignal.timeout(8000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      const explanations = {
        401: "API key rejected. Check its value and activation.",
        403: "Your OpenWeather account cannot access this resource.",
        404: "OpenWeather could not find this city.",
        429: "OpenWeather request limit reached. Try again later.",
      };

      const explanation =
        explanations[response.status] ||
        "OpenWeather could not complete the request.";

      throw new Error(
        `HTTP ${response.status}: ${explanation}`
      );
    }

    let raw;

    try {
      raw = await response.json();
    } catch {
      if (signal.aborted) {
        throw new Error("Weather request timed out.");
      }

      throw new Error("OpenWeather returned invalid JSON.");
    }

    const weather = validateWeatherResponse(raw, cityCode);

    // Keep raw data available for the raw-response cache added later.
    return {
      raw,
      weather,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (signal.aborted) {
      throw new Error(
        `Weather request for city ${cityCode} timed out after 8 seconds.`
      );
    }

    // Avoid exposing fetch error details that could contain the URL/key.
    if (error instanceof TypeError) {
      throw new Error(
        `Could not connect to OpenWeather for city ${cityCode}.`
      );
    }

    throw error;
  }
}

export async function fetchWeatherForCities(cityCodes) {
  const results = await Promise.allSettled(
    cityCodes.map((cityCode) => fetchCurrentWeather(cityCode))
  );

  const data = [];
  const failures = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data.push(result.value.weather);
    } else {
      failures.push({
        cityCode: cityCodes[index],
        message: result.reason.message,
      });
    }
  });

  const status =
    failures.length === 0
      ? "complete"
      : data.length === 0
        ? "failed"
        : "partial";

  return {
    data,
    failures,
    meta: {
      status,
      requestedCities: cityCodes.length,
      successfulCities: data.length,
      failedCities: failures.length,
      message:
        failures.length === 0
          ? `Weather loaded for all ${data.length} cities.`
          : `Weather loaded for ${data.length} of ${cityCodes.length} cities.`,
    },
  };
}