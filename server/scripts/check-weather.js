import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

import { loadCityCodes } from "../src/services/city.service.js";

import {
  fetchCurrentWeather,
  fetchWeatherForCities,
} from "../src/services/weather.service.js";

// Load server/.env regardless of the terminal's working directory.
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

async function main() {
  const mode = process.argv[2] || "one";

  if (!["one", "all"].includes(mode)) {
    throw new Error('Choose either "one" or "all".');
  }

  const cityCodes = await loadCityCodes();

  if (mode === "one") {
    const result = await fetchCurrentWeather(cityCodes[0]);

    console.log("Single-city weather check succeeded.");
    console.table([result.weather]);
    return;
  }

  const result = await fetchWeatherForCities(cityCodes);

  console.log(result.meta.message);
  console.table(result.data);

  if (result.failures.length > 0) {
    console.log("Cities that could not be loaded:");
    console.table(result.failures);
  }

  if (result.data.length < 10) {
    console.error(
      "Checkpoint not passed: fewer than 10 cities returned valid weather."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "Checkpoint passed: at least 10 cities returned valid weather."
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});