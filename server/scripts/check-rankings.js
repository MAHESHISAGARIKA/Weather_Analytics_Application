import assert from "node:assert/strict";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

import { loadCityCodes } from "../src/services/city.service.js";
import { fetchWeatherForCities } from "../src/services/weather.service.js";
import { calculateComfortIndex } from "../src/services/comfort-index.service.js";
import { rankCities } from "../src/services/ranking.service.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

function checkSampleCalculation() {
  const result = calculateComfortIndex({
    temperature: 25,
    humidity: 60,
    windSpeed: 3,
  });

  assert.equal(result.score, 81);

  console.log("Sample calculation passed: expected 81, received 81.");

  // Same score for every city: verify name and ID tie-breakers.
  const tiedCities = rankCities([
    {
      cityCode: 3,
      cityName: "Beta",
      temperature: 22,
      humidity: 50,
      windSpeed: 2,
    },
    {
      cityCode: 2,
      cityName: "Alpha",
      temperature: 22,
      humidity: 50,
      windSpeed: 2,
    },
    {
      cityCode: 1,
      cityName: "Alpha",
      temperature: 22,
      humidity: 50,
      windSpeed: 2,
    },
  ]);

  assert.deepEqual(
    tiedCities.map((city) => city.cityCode),
    [1, 2, 3]
  );

  console.log("Tie-breaker check passed.");
}

async function checkLiveRankings() {
  const cityCodes = await loadCityCodes();
  const result = await fetchWeatherForCities(cityCodes);

  console.log(result.meta.message);

  if (result.failures.length > 0) {
    console.table(result.failures);
  }

  const rankedCities = rankCities(result.data);

  console.table(
    rankedCities.map((city) => ({
      Rank: city.rank,
      City: city.cityName,
      "Temperature °C": city.temperature,
      "Humidity %": city.humidity,
      "Wind m/s": city.windSpeed,
      Score: city.comfortScore,
      Label: city.comfortLabel,
    }))
  );

  assert.ok(
    rankedCities.length >= 10,
    "At least 10 successful cities are required for this checkpoint."
  );

  rankedCities.forEach((city, index) => {
    assert.equal(city.rank, index + 1);

    assert.ok(
      city.comfortScore >= 0 && city.comfortScore <= 100,
      "Every score must be between 0 and 100."
    );

    if (index > 0) {
      assert.ok(
        rankedCities[index - 1].comfortScore >= city.comfortScore,
        "Cities must be ordered by descending score."
      );
    }
  });

  console.log("Live ranking checks passed.");
}

async function main() {
  const mode = process.argv[2] || "sample";

  if (mode === "sample") {
    checkSampleCalculation();
  } else if (mode === "live") {
    await checkLiveRankings();
  } else {
    throw new Error('Choose either "sample" or "live".');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});