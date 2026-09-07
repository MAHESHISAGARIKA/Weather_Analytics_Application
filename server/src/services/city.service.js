import { readFile } from "node:fs/promises";

async function readCityList(fileName) {
  const fileUrl = new URL(`../data/${fileName}`, import.meta.url);

  const content = await readFile(fileUrl, "utf8");

  // Remove a possible UTF-8 byte-order mark before parsing.
  const document = JSON.parse(content.replace(/^\uFEFF/, ""));

  if (!Array.isArray(document.List)) {
    throw new Error(`${fileName} must contain a "List" array.`);
  }

  return document.List;
}

export function extractCityCodes(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("City records must be an array.");
  }

  const codes = records.map((record, index) => {
    const rawCode = record?.CityCode;

    if (
      typeof rawCode !== "string" &&
      typeof rawCode !== "number"
    ) {
      throw new Error(
        `City record ${index + 1} has a missing or invalid CityCode.`
      );
    }

    const textCode = String(rawCode).trim();

    if (!/^\d+$/.test(textCode)) {
      throw new Error(
        `City record ${index + 1} must have a positive integer CityCode.`
      );
    }

    const code = Number(textCode);

    if (!Number.isSafeInteger(code) || code <= 0) {
      throw new Error(
        `City record ${index + 1} has an invalid CityCode.`
      );
    }

    return code;
  });

  // Set removes duplicate city codes.
  const uniqueCodes = [...new Set(codes)];

  if (uniqueCodes.length < 10) {
    throw new Error(
      `At least 10 unique city codes are required; found ${uniqueCodes.length}.`
    );
  }

  return uniqueCodes;
}

export async function loadCityCodes() {
  const suppliedCities = await readCityList("cities.json");

  const additionalCities = await readCityList(
    "additional-cities.json"
  );

  return extractCityCodes([
    ...suppliedCities,
    ...additionalCities,
  ]);
}