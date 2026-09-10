exports.onExecutePostLogin = async (event, api) => {
  const clientId = event.secrets.WEATHER_CLIENT_ID;

  if (!clientId) {
    api.access.deny("Application access policy is not configured.");
    return;
  }

  // Apply this policy to the weather application.
  if (event.client.client_id !== clientId) {
    return;
  }

  const allowedEmails = new Set(
    (event.secrets.ALLOWED_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  const email = (event.user.email || "").trim().toLowerCase();

  if (
    event.connection.strategy !== "auth0" ||
    !allowedEmails.has(email)
  ) {
    api.access.deny(
      "This account is not approved for Weather Analytics.",
    );
    return;
  }

  if (event.user.email_verified !== true) {
    api.access.deny("Verify your email address before signing in.");
    return;
  }

  api.accessToken.setCustomClaim(
    "https://fidenz-weather-api/approved",
    true,
  );
};