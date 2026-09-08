import { calculateComfortIndex } from "./comfort-index.service.js";

function compareCityNames(firstName, secondName) {
  const first = firstName.trim().toLowerCase();
  const second = secondName.trim().toLowerCase();

  if (first < second) return -1;
  if (first > second) return 1;

  return 0;
}

export function rankCities(weatherRecords) {
  if (!Array.isArray(weatherRecords)) {
    throw new TypeError("Weather records must be an array.");
  }

  // Create new objects so the original weather records remain unchanged.
  const scoredCities = weatherRecords.map((weather) => {
    if (
      typeof weather.cityName !== "string" ||
      !weather.cityName.trim() ||
      !Number.isSafeInteger(weather.cityCode) ||
      weather.cityCode <= 0
    ) {
      throw new Error("Each city must have a valid name and city code.");
    }

    const comfort = calculateComfortIndex(weather);

    return {
      ...weather,
      comfortScore: comfort.score,
      comfortLabel: comfort.label,
      comfortBreakdown: comfort.breakdown,
      formulaVersion: comfort.formulaVersion,
    };
  });

  scoredCities.sort((first, second) => {
    // 1. Highest score first.
    const scoreDifference =
      second.comfortScore - first.comfortScore;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    // 2. Equal scores: sort by city name.
    const nameDifference = compareCityNames(
      first.cityName,
      second.cityName
    );

    if (nameDifference !== 0) {
      return nameDifference;
    }

    // 3. Equal scores and names: sort by city code.
    return first.cityCode - second.cityCode;
  });

  return scoredCities.map((city, index) => ({
    ...city,
    rank: index + 1,
  }));
}