import express from "express";
import cors from "cors";
import helmet from "helmet";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use(helmet());

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN,
    })
  );

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "weather-api",
    });
  });

  return app;
}