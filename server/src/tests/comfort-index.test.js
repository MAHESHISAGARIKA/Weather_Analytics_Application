import { describe, expect, it } from "vitest";
import { calculateComfortIndex } from "../services/comfort-index.service.js";

const preferredWeather = {
  temperature: 22,
  humidity: 50,
  windSpeed: 2,
};

describe("calculateComfortIndex", () => {
  it("gives preferred conditions the maximum score", () => {
    const result = calculateComfortIndex(preferredWeather);

    expect(result.score).toBe(100);
    expect(result.breakdown).toEqual({
      temperature: 100,
      humidity: 100,
      wind: 100,
    });
    expect(result.label).toBe("Excellent");
    expect(result.formulaVersion).toBe("v1");
  });

  it("calculates the documented weighted example correctly", () => {
    const result = calculateComfortIndex({
      temperature: 25,
      humidity: 60,
      windSpeed: 3,
    });

    // Temperature: 100 - |25 - 22| × 6 = 82
    // Humidity:    100 - |60 - 50| × 2 = 80
    // Wind:        100 - |3 - 2| × 20 = 80
    // Total:       82 × 0.5 + 80 × 0.3 + 80 × 0.2 = 81

    expect(result.breakdown).toEqual({
      temperature: 82,
      humidity: 80,
      wind: 80,
    });
    expect(result.score).toBe(81);
  });

  it("reduces the score for extreme conditions", () => {
    const result = calculateComfortIndex({
      temperature: 45,
      humidity: 100,
      windSpeed: 20,
    });

    expect(result.score).toBe(0);
    expect(result.label).toBe("Uncomfortable");
  });

  it.each([
    { temperature: -80, humidity: 0, windSpeed: 0 },
    { temperature: 60, humidity: 100, windSpeed: 50 },
    { temperature: 22, humidity: 50, windSpeed: 2 },
    { temperature: 25.7, humidity: 73, windSpeed: 4.8 },
    { temperature: -273.15, humidity: 50, windSpeed: 2 },
  ])("keeps the total and components between 0 and 100: %j", (weather) => {
    const result = calculateComfortIndex(weather);

    const scores = [
      result.score,
      ...Object.values(result.breakdown),
    ];

    for (const score of scores) {
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it.each([
    ["missing temperature", { temperature: undefined }, /temperature/i],
    ["string temperature", { temperature: "22" }, /temperature/i],
    ["NaN temperature", { temperature: NaN }, /temperature/i],
    ["infinite temperature", { temperature: Infinity }, /temperature/i],
    ["impossible temperature", { temperature: -274 }, /temperature/i],
    ["negative humidity", { humidity: -1 }, /humidity/i],
    ["humidity above 100", { humidity: 101 }, /humidity/i],
    ["missing humidity", { humidity: undefined }, /humidity/i],
    ["negative wind speed", { windSpeed: -1 }, /wind/i],
    ["infinite wind speed", { windSpeed: Infinity }, /wind/i],
  ])("rejects %s with a useful error", (_name, changes, expectedError) => {
    expect(() =>
      calculateComfortIndex({
        ...preferredWeather,
        ...changes,
      }),
    ).toThrow(expectedError);
  });

  it("rejects a missing weather object", () => {
    expect(() => calculateComfortIndex()).toThrow(/temperature/i);
  });
});