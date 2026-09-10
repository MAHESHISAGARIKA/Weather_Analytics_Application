import express from "express";
import cors from "cors";
import helmet from "helmet";

import {
  createRequireAuth,
} from "./middleware/auth.middleware.js";

import {
  createWeatherRouter,
} from "./routes/weather.routes.js";

export function createApp() {
  const app = express();
  const requireAuth = createRequireAuth();

  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN,
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "weather-api",
    });
  });

  // Now the middleware exists, so mount the protected router.
  app.use("/api", createWeatherRouter({ requireAuth }));

  app.use((_req, res) => {
    res.status(404).json({
      error: "Endpoint not found.",
    });
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    res.set("Cache-Control", "no-store");

    const status = error.statusCode || error.status;

    if (status === 401) {
      return res.status(401).json({
        error: "A valid access token is required.",
      });
    }

    if (status === 403) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    // Do not expose internal errors or credentials to the browser.
    return res.status(500).json({
      error: "An unexpected server error occurred.",
    });
  });

  return app;
}