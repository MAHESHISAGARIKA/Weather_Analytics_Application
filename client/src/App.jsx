import { useAuth0 } from "@auth0/auth0-react";
import WeatherDashboard from "./components/WeatherDashboard.jsx";

export default function App() {
  const {
    isLoading,
    isAuthenticated,
    error,
    user,
    loginWithRedirect,
    logout,
  } = useAuth0();

  function signOut() {
    void logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  if (isLoading) {
    return <main><p role="status">Checking your session…</p></main>;
  }

  if (error) {
    return (
      <main>
        <h1>Unable to sign in</h1>
        <p role="alert">{error.message}</p>
        <p>
          Use an approved account with a verified email address.
        </p>
        <button type="button" onClick={signOut}>
          Clear session and return
        </button>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main>
        <h1>Weather Comfort Analytics</h1>
        <p>Sign in with your approved account to view city rankings.</p>

        <button
          type="button"
          onClick={() => void loginWithRedirect()}
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>Weather Comfort Analytics</h1>
        <p>Signed in as {user?.email}</p>

        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <WeatherDashboard />
    </main>
  );
}