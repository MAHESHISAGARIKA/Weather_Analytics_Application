import { Router } from "express";
import { loadCityCodes } from "../services/city.service.js";
import { analyticsService } from "../services/analytics.service.js";

export function createWeatherRouter({ requireAuth }) {
  if (typeof requireAuth !== "function") {
    throw new Error("Weather routes require authentication middleware.");
  }

  const router = Router();

  // Browser caching is separate from our backend cache.
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // Authentication applies to both endpoints.
  router.use(requireAuth);

  router.get("/weather", async (_req, res, next) => {
    try {
      const cityCodes = await loadCityCodes();
      const result = await analyticsService.getRankings(cityCodes);

      const statusCode =
        result.meta.status === "failed" ? 502 : 200;

      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/debug/cache", (_req, res) => {
    res.json(analyticsService.getDiagnostics());
  });

  return router;
}