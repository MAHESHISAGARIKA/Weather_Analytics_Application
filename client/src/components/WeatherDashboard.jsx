import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

function formatNumber(value) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function validateResponse(body) {
  if (
    !body ||
    !Array.isArray(body.data) ||
    !body.meta ||
    typeof body.meta.message !== "string"
  ) {
    throw new Error(
      "The server returned an unexpected response.",
    );
  }

  const cityCodes = new Set();

  for (const city of body.data) {
    if (
      !city ||
      !Number.isSafeInteger(city.cityCode) ||
      city.cityCode <= 0 ||
      cityCodes.has(city.cityCode) ||
      typeof city.cityName !== "string" ||
      !city.cityName.trim() ||
      typeof city.description !== "string" ||
      !Number.isSafeInteger(city.rank) ||
      city.rank < 1 ||
      !Number.isFinite(city.temperature) ||
      !Number.isFinite(city.humidity) ||
      city.humidity < 0 ||
      city.humidity > 100 ||
      !Number.isFinite(city.windSpeed) ||
      city.windSpeed < 0 ||
      !Number.isFinite(city.comfortScore) ||
      city.comfortScore < 0 ||
      city.comfortScore > 100
    ) {
      throw new Error(
        "The server returned an invalid weather record.",
      );
    }

    cityCodes.add(city.cityCode);
  }

  return body;
}

export default function WeatherDashboard() {
  const { getAccessTokenSilently } = useAuth0();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("rank");

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      setLoading(true);
      setError("");

      try {
        const token = await getAccessTokenSilently();

        if (controller.signal.aborted) return;

        const response = await fetch(
          `${API_BASE_URL}/api/weather`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        let body;

        try {
          body = await response.json();
        } catch {
          throw new Error(
            "The server returned an unreadable response.",
          );
        }

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your session could not be verified. Sign out and sign in again.",
            );
          }

          if (response.status === 403) {
            throw new Error(
              "Your account is not authorized to view weather.",
            );
          }

          throw new Error(
            body.error ||
              body.meta?.message ||
              "Weather is unavailable. Please try again.",
          );
        }

        const validated = validateResponse(body);

        if (!controller.signal.aborted) {
          setResult(validated);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setResult(null);

          setError(
            requestError instanceof TypeError
              ? "Cannot reach the weather server. Check your connection and make sure the backend is running."
              : requestError.message ||
                  "Could not load weather.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadWeather();

    return () => controller.abort();
  }, [getAccessTokenSilently, refreshKey]);

  const visibleCities = useMemo(() => {
    const query = search.trim().toLowerCase();

    // filter creates a new array, so sorting does not
    // change the original API response.
    const cities = (result?.data || []).filter((city) =>
      city.cityName.toLowerCase().includes(query),
    );

    return cities.sort((first, second) => {
      if (sortBy === "temperature-desc") {
        return (
          second.temperature - first.temperature ||
          first.rank - second.rank
        );
      }

      if (sortBy === "temperature-asc") {
        return (
          first.temperature - second.temperature ||
          first.rank - second.rank
        );
      }

      if (sortBy === "name") {
        return (
          first.cityName.localeCompare(second.cityName) ||
          first.cityCode - second.cityCode
        );
      }

      return first.rank - second.rank;
    });
  }, [result, search, sortBy]);

  const highestScore =
    result?.data.length > 0
      ? Math.max(
          ...result.data.map((city) => city.comfortScore),
        )
      : null;

  function refreshWeather() {
    setRefreshKey((current) => current + 1);
  }

  return (
    <main
      id="main-content"
      className="container dashboard"
      tabIndex={-1}
    >
      <section
        className="intro"
        aria-labelledby="dashboard-heading"
      >
        <div>
          <p className="eyebrow">YOUR CITY OUTLOOK</p>
          <h1 id="dashboard-heading">
            Find your comfortable climate.
          </h1>
          <p className="intro-description">
            Compare cities by their current weather.
            Higher scores mean conditions are closer
            to our preferred temperature, humidity,
            and wind levels.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          disabled={loading}
          onClick={refreshWeather}
        >
          {loading ? "Updating…" : "Refresh weather"}
        </button>
      </section>

      <p className="small-text">
        Refresh respects the five-minute server cache.
        All times use your device’s local timezone.
      </p>

      {result && (
        <section
          className="summary-grid"
          aria-label="Weather summary"
        >
          <div className="summary-card">
            <span>Cities available</span>
            <strong>
              {result.data.length} /{" "}
              {result.meta.requestedCities}
            </strong>
          </div>

          <div className="summary-card">
            <span>Highest comfort score</span>
            <strong>
              {highestScore === null
                ? "Unavailable"
                : `${formatNumber(highestScore)} / 100`}
            </strong>
          </div>

          <div className="summary-card">
            <span>Scores calculated by server</span>
            <strong className="summary-date">
              {formatDate(result.meta.calculatedAt)}
            </strong>
          </div>
        </section>
      )}

      <section
        className="controls"
        aria-label="Search and sort weather"
      >
        <div className="field">
          <label htmlFor="city-search">Search cities</label>
          <input
            id="city-search"
            type="search"
            placeholder="Enter a city name"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="field">
          <label htmlFor="city-sort">Sort by</label>
          <select
            id="city-sort"
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value)
            }
          >
            <option value="rank">Comfort rank</option>
            <option value="temperature-desc">
              Temperature: high to low
            </option>
            <option value="temperature-asc">
              Temperature: low to high
            </option>
            <option value="name">City name: A–Z</option>
          </select>
        </div>
      </section>

      <p className="results-message" role="status">
        {loading
          ? result
            ? "Updating weather. Previous results remain visible."
            : "Loading weather…"
          : result
            ? `Showing ${visibleCities.length} of ${result.data.length} cities.`
            : "Weather is not loaded."}
      </p>

      {error && (
        <section
          className="notice notice-error"
          role="alert"
        >
          <h2>Could not load weather</h2>
          <p>{error}</p>
          <button
            type="button"
            className="button button-secondary"
            disabled={loading}
            onClick={refreshWeather}
          >
            Try again
          </button>
        </section>
      )}

      {result?.meta.status === "partial" && (
        <div
          className="notice notice-warning"
          role="status"
        >
          <strong>Some cities are unavailable.</strong>
          <p>
            {result.meta.message} Rankings are based
            on the cities successfully retrieved.
          </p>
        </div>
      )}

      {loading && !result && (
        <div className="empty-state">
          <span className="loading-dot" aria-hidden="true" />
          <h2>Getting your weather outlook</h2>
          <p>This may take a few seconds.</p>
        </div>
      )}

      {!loading && result?.data.length === 0 && (
        <div className="empty-state">
          <h2>No weather available</h2>
          <p>Try refreshing again shortly.</p>
        </div>
      )}

      {!loading &&
        result?.data.length > 0 &&
        visibleCities.length === 0 && (
          <div className="empty-state">
            <h2>No matching cities</h2>
            <p>Try another name or clear your search.</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSearch("")}
            >
              Clear search
            </button>
          </div>
        )}

      <section
        className="city-grid"
        aria-label="City weather rankings"
        aria-busy={loading}
      >
        {visibleCities.map((city) => (
          <article
            className="city-card"
            key={city.cityCode}
          >
            <div className="city-heading">
              <div>
                <h2>{city.cityName}</h2>
                <p className="weather-description">
                  {city.description}
                </p>
              </div>

              <span className="rank-badge">
                Rank #{city.rank}
              </span>
            </div>

            <p className="temperature">
              {formatNumber(city.temperature)}
              <span> °C</span>
            </p>

            <div className="score-heading">
              <span>Comfort score</span>
              <strong>
                {formatNumber(city.comfortScore)} / 100
              </strong>
            </div>

            <meter
              min="0"
              max="100"
              value={city.comfortScore}
              aria-label={`${city.cityName} comfort score`}
            >
              {city.comfortScore} out of 100
            </meter>

            <p className="comfort-label">
              {city.comfortLabel || "Comfort index"}
            </p>

            <dl className="weather-details">
              <div>
                <dt>Humidity</dt>
                <dd>
                  {formatNumber(city.humidity)}%
                </dd>
              </div>

              <div>
                <dt>Wind speed</dt>
                <dd>
                  {formatNumber(city.windSpeed)} m/s
                </dd>
              </div>
            </dl>

            <p className="observation-time">
              Weather observed:{" "}
              {formatDate(city.observedAt)}
            </p>
          </article>
        ))}
      </section>

      <footer className="dashboard-footer">
        <p>
          Comfort scores are a subjective comparison,
          not a weather safety assessment.
        </p>
        <p>
          Search and sorting preserve each city’s
          original backend-assigned rank.
        </p>
      </footer>
    </main>
  );
}