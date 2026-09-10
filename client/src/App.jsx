import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import WeatherDashboard from "./components/WeatherDashboard.jsx";

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("weather-theme");

    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Continue without a saved preference.
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches
    ? "dark"
    : "light";
}

export default function App() {
  const {
    isLoading,
    isAuthenticated,
    error,
    user,
    loginWithRedirect,
    logout,
  } = useAuth0();

  const [theme, setTheme] = useState(getInitialTheme);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("weather-theme", theme);
    } catch {
      // Theme switching still works without storage.
    }
  }, [theme]);

  async function signIn() {
    setActionError("");
    setBusy(true);

    try {
      await loginWithRedirect();
    } catch {
      setActionError(
        "Could not start sign-in. Please try again.",
      );
      setBusy(false);
    }
  }

  async function signOut() {
    setActionError("");
    setBusy(true);

    try {
      await logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      });
    } catch {
      setActionError(
        "Could not sign out. Please try again.",
      );
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">
            WEATHER COMFORT ANALYTICS
          </p>
          <h1>Please wait</h1>
          <p role="status">Checking your session…</p>
        </section>
      </main>
    );
  }

  if (error || !isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">
            WEATHER COMFORT ANALYTICS
          </p>

          {error ? (
            <>
              <h1>Unable to sign in</h1>
              <p className="error-text" role="alert">
                {error.message}
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={signOut}
                disabled={busy}
              >
                Clear session and return
              </button>
            </>
          ) : (
            <>
              <h1>Find your comfortable climate.</h1>
              <p>
                Compare real weather across cities using
                temperature, humidity, and wind.
              </p>
              <button
                type="button"
                className="button button-primary"
                onClick={signIn}
                disabled={busy}
              >
                {busy ? "Opening sign-in…" : "Sign in"}
              </button>
              <p className="small-text">
                Access is available to approved accounts.
              </p>
            </>
          )}

          {actionError && (
            <p className="error-text" role="alert">
              {actionError}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="application">
      <a className="skip-link" href="#main-content">
        Skip to weather
      </a>

      <header className="site-header">
        <div className="container header-inner">
          <div>
            <p className="brand">
              Weather Comfort Analytics
            </p>
            <p className="account-email">{user?.email}</p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button button-secondary"
              aria-pressed={theme === "dark"}
              onClick={() =>
                setTheme((current) =>
                  current === "dark" ? "light" : "dark",
                )
              }
            >
              Dark mode: {theme === "dark" ? "On" : "Off"}
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={signOut}
              disabled={busy}
            >
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      {actionError && (
        <div className="container">
          <p className="notice notice-error" role="alert">
            {actionError}
          </p>
        </div>
      )}

      <WeatherDashboard />
    </div>
  );
}