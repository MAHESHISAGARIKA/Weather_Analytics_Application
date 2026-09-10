import express from "express";
import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createApp } from "../app.js";
import {
  requireApprovedUser,
} from "../middleware/auth.middleware.js";

describe("protected API endpoints", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH0_DOMAIN", "example.auth0.com");
    vi.stubEnv("AUTH0_AUDIENCE", "https://fidenz-weather-api");
    vi.stubEnv("CLIENT_ORIGIN", "http://localhost:5173");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the health endpoint public", async () => {
    const response = await request(createApp()).get("/api/health");

    expect(response.status).toBe(200);
  });

  it.each(["/api/weather", "/api/debug/cache"])(
    "rejects a request without a token: %s",
    async (path) => {
      const response = await request(createApp()).get(path);

      expect(response.status).toBe(401);
      expect(response.body).not.toHaveProperty("data");
    },
  );

  it.each(["/api/weather", "/api/debug/cache"])(
    "rejects a malformed token: %s",
    async (path) => {
      const response = await request(createApp())
        .get(path)
        .set("Authorization", "Bearer not-a-jwt");

      expect(response.status).toBe(401);
    },
  );
});

describe("approved-user authorization", () => {
  it.each([
    [undefined, 403],
    [false, 403],
    ["true", 403],
    [true, 200],
  ])("checks the approval claim %s", async (claim, expectedStatus) => {
    const app = express();

    // Test fixture only: isolates the authorization check.
    // Production code validates the JWT before setting req.auth.
    app.use((req, _res, next) => {
      req.auth = {
        payload: {
          "https://fidenz-weather-api/approved": claim,
        },
      };
      next();
    });

    app.get("/protected", requireApprovedUser, (_req, res) => {
      res.json({ allowed: true });
    });

    const response = await request(app).get("/protected");

    expect(response.status).toBe(expectedStatus);
  });
});