import { auth } from "express-oauth2-jwt-bearer";

const APPROVED_CLAIM = "https://fidenz-weather-api/approved";

export function requireApprovedUser(req, res, next) {
  if (req.auth?.payload?.[APPROVED_CLAIM] !== true) {
    return res.status(403).json({
      error: "This account is not approved for Weather Analytics.",
    });
  }

  next();
}

export function createRequireAuth() {
  const domain = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();

  if (
    !domain ||
    domain.includes("://") ||
    domain.includes("/") ||
    !audience
  ) {
    throw new Error(
      "Set a valid AUTH0_DOMAIN and AUTH0_AUDIENCE in server/.env.",
    );
  }

  const validateAccessToken = auth({
    issuerBaseURL: `https://${domain}/`,
    audience,
    tokenSigningAlg: "RS256",
  });

  return function requireAuth(req, res, next) {
    validateAccessToken(req, res, (error) => {
      if (error) {
        return next(error);
      }

      return requireApprovedUser(req, res, next);
    });
  };
}