import { describe, expect, it } from "vitest";
import { rankCities } from "../services/ranking.service.js";

function makeCity(cityCode, cityName, changes = {}) {
  return {
    cityCode,
    cityName,
    temperature: 22,
    humidity: 50,
    windSpeed: 2,
    ...changes,
  };
}

describe("rankCities", () => {
  it("sorts by descending comfort score and assigns ranks", () => {
    const cities = [
      makeCity(3, "Hot City", { temperature: 40 }),
      makeCity(1, "Preferred City"),
      makeCity(2, "Warm City", { temperature: 25 }),
    ];

    const result = rankCities(cities);

    expect(result.map((city) => city.cityCode)).toEqual([1, 2, 3]);
    expect(result.map((city) => city.comfortScore)).toEqual([100, 91, 50]);
    expect(result.map((city) => city.rank)).toEqual([1, 2, 3]);
  });

  it("breaks equal-score ties by city name, then numeric city code", () => {
    const cities = [
      makeCity(3, "Beta"),
      makeCity(2, "alpha"),
      makeCity(1, "Alpha"),
    ];

    const result = rankCities(cities);

    expect(result.map((city) => city.cityCode)).toEqual([1, 2, 3]);
    expect(result.map((city) => city.rank)).toEqual([1, 2, 3]);
  });

  it("produces the same tie ordering regardless of input order", () => {
    const cities = [
      makeCity(3, "Beta"),
      makeCity(2, "Alpha"),
      makeCity(1, "Alpha"),
    ];

    const forward = rankCities(cities);
    const reversed = rankCities([...cities].reverse());

    expect(forward.map((city) => city.cityCode)).toEqual([1, 2, 3]);
    expect(reversed.map((city) => city.cityCode)).toEqual([1, 2, 3]);
  });

  it("does not change the original input records or their order", () => {
    const cities = [
      makeCity(2, "Beta", { temperature: 30 }),
      makeCity(1, "Alpha"),
    ];

    const original = cities.map((city) => ({ ...city }));

    rankCities(cities);

    expect(cities).toEqual(original);
    expect(cities[0]).not.toHaveProperty("rank");
    expect(cities[0]).not.toHaveProperty("comfortScore");
  });

  it("returns an empty array when no valid weather records are available", () => {
    expect(rankCities([])).toEqual([]);
  });

  it("rejects input that is not an array", () => {
    expect(() => rankCities(null)).toThrow(/array/i);
  });

  it("rejects a city without a valid name", () => {
    expect(() => rankCities([makeCity(1, " ")])).toThrow(
      /valid name and city code/i,
    );
  });

  it("rejects a city without a valid numeric code", () => {
    expect(() => rankCities([makeCity("1", "Alpha")])).toThrow(
      /valid name and city code/i,
    );
  });
});