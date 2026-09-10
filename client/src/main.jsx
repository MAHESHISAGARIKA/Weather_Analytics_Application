import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";

import App from "./App.jsx";
import "./index.css";

const domain = import.meta.env.VITE_AUTH0_DOMAIN?.trim();
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim();
const audience = import.meta.env.VITE_AUTH0_AUDIENCE?.trim();

const root = createRoot(document.getElementById("root"));

const configurationValid =
  domain &&
  clientId &&
  audience &&
  !domain.includes("://") &&
  !domain.includes("/");

if (!configurationValid) {
  root.render(
    <main className="auth-page">
      <section className="auth-card">
        <h1>Configuration required</h1>
        <p>
          Check the Auth0 settings in client/.env and restart
          the frontend.
        </p>
      </section>
    </main>,
  );
} else {
  root.render(
    <StrictMode>
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience,
          scope: "openid profile email",
        }}
        cacheLocation="memory"
        onRedirectCallback={() => {
          window.history.replaceState(
            {},
            document.title,
            "/",
          );
        }}
      >
        <App />
      </Auth0Provider>
    </StrictMode>,
  );
}