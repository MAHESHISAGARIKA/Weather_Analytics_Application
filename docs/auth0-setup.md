# Auth0 setup and verification

## Application and API

- Frontend application: Weather Analytics Frontend
- Application type: Single Page Application
- API identifier: https://fidenz-weather-api
- Signing algorithm: RS256
- Frontend user-delegated API access: Enabled
- Frontend client access: Disabled

## Local URLs

- Allowed Callback URLs: http://localhost:5173
- Allowed Logout URLs: http://localhost:5173
- Allowed Web Origins: http://localhost:5173

## Login connection

- Database connection: Username-Password-Authentication
- Public signups: Disabled
- Unused application connections: Disabled

## Approved-user policy

- Action name: Weather approved users
- Source: auth0/actions/approved-users.cjs
- Trigger: Login / Post Login
- Action secret names:
  - WEATHER_CLIENT_ID
  - ALLOWED_EMAILS

The Action must be deployed and attached to the Login flow.

Users must have an approved email address and a verified email.
The Action adds the approval claim to the access token.

Express validates the access token and then checks the approval claim.

## MFA configuration

- Independent factor: One-time Password / Authenticator
- Email factor: Enabled
- MFA policy: Always

Email verification and the login-time email challenge are separate.

## Verification results

| Check | Status | Notes |
|---|---|---|
| Logged-out screen hides protected content | Pending | |
| Approved-user login | Pending | |
| Email MFA code received and accepted | Pending | |
| Dashboard loads at least 10 real cities | Pending | |
| Refresh respects backend caching | Pending | |
| Logout hides protected content | Pending | |
| Weather endpoint without token returns 401 | Pending | |
| Debug endpoint without token returns 401 | Pending | |
| Existing non-allowlisted user is denied | Pending | |
| Backend automated tests | Pending | |
| Frontend production build | Pending | |

## Reviewer access

The reviewer account uses the required email address.
Its password is not stored in this repository.

Reviewer mailbox access has not been tested by the developer.
The reviewer controls their verification and MFA steps.

Reviewer enrollment or delivery issues:
Not yet verified.

## Limitations

Changing the allowlist does not immediately invalidate previously
issued access tokens. They may remain valid until expiry.

Local testing does not verify production callback URLs or production
email delivery.