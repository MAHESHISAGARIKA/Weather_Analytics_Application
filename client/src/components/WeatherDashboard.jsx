import { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/$/, "");

export default function WeatherDashboard() {
  const { getAccessTokenSilently } = useAuth0();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWeather = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");

      try {
        const accessToken = await getAccessTokenSilently();

        const response = await fetch(`${apiBaseUrl}/api/weather`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal,
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error ||
              body.meta?.message ||
              "Could not load weather.",
          );
        }

        if (!signal?.aborted) {
          setResult(body);
        }
      } catch (requestError) {
        if (!signal?.aborted) {
          setResult(null);
          setError(
            requestError.message || "Could not load weather.",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [getAccessTokenSilently],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadWeather(controller.signal);

    return () => controller.abort();
  }, [loadWeather]);

  return (
    <section aria-labelledby="weather-heading">
      <h2 id="weather-heading">Weather rankings</h2>

      <button
        type="button"
        disabled={loading}
        onClick={() => void loadWeather()}
      >
        {loading ? "Loading…" : "Refresh"}
      </button>

      {error && <p role="alert">{error}</p>}

      {result && (
        <>
          <p role="status">{result.meta.message}</p>

          <table>
            <caption>Cities ranked by weather comfort</caption>

            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">City</th>
                <th scope="col">Temperature</th>
                <th scope="col">Humidity</th>
                <th scope="col">Wind</th>
                <th scope="col">Comfort</th>
              </tr>
            </thead>

            <tbody>
              {result.data.map((city) => (
                <tr key={city.cityCode}>
                  <td>{city.rank}</td>
                  <td>{city.cityName}</td>
                  <td>{city.temperature} °C</td>
                  <td>{city.humidity}%</td>
                  <td>{city.windSpeed} m/s</td>
                  <td>{city.comfortScore}/100</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}