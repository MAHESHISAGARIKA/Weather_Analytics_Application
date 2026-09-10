import express from "express";
import request from "supertest";
import nock from "nock";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createRequireAuth } from "../middleware/auth.middleware.js";

const DOMAIN = "weather-auth-tests.example";
const ISSUER = `https://${DOMAIN}/`;
const AUDIENCE = "https://fidenz-weather-api";
const APPROVED_CLAIM = `${AUDIENCE}/approved`;

let signingKeys;
let otherKeys;
let publicJwk;
let app;

async function createToken({
  issuer = ISSUER,
  audience = AUDIENCE,
  expiresInSeconds = 300,
  approved = true,
  privateKey = signingKeys.privateKey,
} = {}) {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    [APPROVED_CLAIM]: approved,
  })
    .setProtectedHeader({
      alg: "RS256",
      kid: "weather-test-key",
      typ: "JWT",
    })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("auth0|test-user")
    .setIssuedAt(now - 600)
    .setExpirationTime(now + expiresInSeconds)
    .sign(privateKey);
}

beforeAll(async () => {
  signingKeys = await generateKeyPair("RS256");
  otherKeys = await generateKeyPair("RS256");

  publicJwk = {
    ...(await exportJWK(signingKeys.publicKey)),
    kid: "weather-test-key",
    alg: "RS256",
    use: "sig",
  };
});

beforeEach(() => {
  vi.stubEnv("AUTH0_DOMAIN", DOMAIN);
  vi.stubEnv("AUTH0_AUDIENCE", AUDIENCE);

  // Allow Supertest's local HTTP server, but block external requests.
  nock.disableNetConnect();
  nock.enableNetConnect(
    /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/,
  );

  nock(`https://${DOMAIN}`)
    .persist()
    .get("/.well-known/openid-configuration")
    .reply(200, {
      issuer: ISSUER,
      jwks_uri: `${ISSUER}.well-known/jwks.json`,
      id_token_signing_alg_values_supported: ["RS256"],
    })
    .get("/.well-known/jwks.json")
    .reply(200, {
      keys: [publicJwk],
    });

  app = express();

  // Use the application's real JWT and approved-user middleware.
  app.get("/protected", createRequireAuth(), (req, res) => {
    res.json({ ok: true });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    return res.status(error.statusCode || error.status || 500).json({
      error: "Request rejected",
    });
  });
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
  vi.unstubAllEnvs();
});

afterAll(() => {
  nock.restore();
});

describe("real JWT authentication middleware", () => {
  it("accepts a valid signed token with the approved claim", async () => {
    const token = await createToken();

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("rejects a missing token", async () => {
    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
  });

  it("rejects a malformed token", async () => {
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });

  it("rejects an expired signed token", async () => {
    const token = await createToken({
      expiresInSeconds: -120,
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("rejects the wrong audience", async () => {
    const token = await createToken({
      audience: "https://another-api.example",
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("rejects the wrong issuer", async () => {
    const token = await createToken({
      issuer: "https://another-issuer.example/",
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("rejects a token signed with an untrusted key", async () => {
    const token = await createToken({
      privateKey: otherKeys.privateKey,
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("returns 403 for a valid token without approval", async () => {
    const token = await createToken({
      approved: false,
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });
});