// These values are design assumptions for this application.
export const COMFORT_CONFIG = Object.freeze({
  version: "v1",
  temperature: Object.freeze({
    preferred: 22,
    penalty: 6,
    weight: 0.5,
  }),
  humidity: Object.freeze({
    preferred: 50,
    penalty: 2,
    weight: 0.3,
  }),
  wind: Object.freeze({
    preferred: 2,
    penalty: 20,
    weight: 0.2,
  }),
});

function clamp(value) {
  return Math.min(100, Math.max(0, value));
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function calculateComponent(value, config) {
  const difference = Math.abs(value - config.preferred);

  return clamp(100 - difference * config.penalty);
}

function getComfortLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Comfortable";
  if (score >= 45) return "Moderate";

  return "Uncomfortable";
}

export function calculateComfortIndex(weather) {
  const { temperature, humidity, windSpeed } = weather ?? {};

  if (
    !Number.isFinite(temperature) ||
    temperature < -273.15
  ) {
    throw new Error("A valid Celsius temperature is required.");
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

  const temperatureScore = calculateComponent(
    temperature,
    COMFORT_CONFIG.temperature
  );

  const humidityScore = calculateComponent(
    humidity,
    COMFORT_CONFIG.humidity
  );

  const windScore = calculateComponent(
    windSpeed,
    COMFORT_CONFIG.wind
  );

  const weightedScore =
    temperatureScore * COMFORT_CONFIG.temperature.weight +
    humidityScore * COMFORT_CONFIG.humidity.weight +
    windScore * COMFORT_CONFIG.wind.weight;

  const score = roundToOneDecimal(clamp(weightedScore));

  return {
    score,
    label: getComfortLabel(score),
    formulaVersion: COMFORT_CONFIG.version,
    breakdown: {
      temperature: roundToOneDecimal(temperatureScore),
      humidity: roundToOneDecimal(humidityScore),
      wind: roundToOneDecimal(windScore),
    },
  };
}