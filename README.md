# Weather Comfort Analytics

A full-stack JavaScript application developed for the Fidenz Trainee Software
Engineer assignment.

The application retrieves current weather from OpenWeather, calculates a
custom Comfort Index on the backend, and ranks cities from most comfortable
to least comfortable according to that model.

Access is protected using Auth0 authentication and an approved-user policy.

## Implementation status

The project contains:

- A React weather dashboard.
- An Express API.
- City-code parsing and validation.
- OpenWeather current weather retrieval.
- Backend Comfort Index calculation and deterministic rankings.
- Five-minute raw weather caching and a separate processed-ranking cache.
- Auth0 access-token validation and approved-user authorization.
- Search, sorting, responsive styles, and dark mode.
- Automated backend tests.

Live login, email MFA, weather availability, and browser behaviour must be
verified separately. See the verification checklist below.

## Technology stack

| Area | Technology |
| --- | --- |
| Language | JavaScript |
| Frontend | React, Vite, CSS |
| Backend | Node.js, Express |
| Authentication | Auth0 |
| Weather provider | OpenWeather |
| Backend tests | Vitest, Supertest |
| JWT test fixtures | JOSE, Nock |
| Frontend linting | ESLint |
| Version control | Git and GitHub |

No application database is required for the current implementation.
Auth0 manages user identities, city configuration is stored in JSON files,
and weather caches are held in backend memory.

## Prerequisites

- Node.js 22.12 or newer within the Node.js 22 release line.
- npm.
- Git.
- An OpenWeather API key that can access the current weather endpoint.
- An Auth0 tenant with a Single Page Application and a registered API.

Check the installed versions:

```powershell
node --version
npm --version
git --version
```

## Local setup

### 1. Clone the repository

```powershell
git clone https://github.com/MAHESHISAGARIKA/Weather_Analytics_Application.git Weather_Analytics
cd Weather_Analytics
```

### 2. Install dependencies

```powershell
cd server
npm ci
cd ../client
npm ci
cd ..
```

Both `package-lock.json` files must remain committed.
`npm ci` installs the dependency versions recorded in those files.

### 3. Create environment files

For a first-time setup, run from the repository root:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Do not overwrite existing configured environment files.

Replace the placeholders in the new `.env` files with your own configuration.

#### Backend: server/.env

```dotenv
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

OPENWEATHER_API_KEY=your_openweather_api_key

AUTH0_DOMAIN=your-tenant.region.auth0.com
AUTH0_AUDIENCE=https://fidenz-weather-api
```

#### Frontend: client/.env

```dotenv
VITE_API_BASE_URL=http://localhost:5000

VITE_AUTH0_DOMAIN=your-tenant.region.auth0.com
VITE_AUTH0_CLIENT_ID=your_spa_client_id
VITE_AUTH0_AUDIENCE=https://fidenz-weather-api
```

Configuration notes:

- Use the Auth0 domain without `https://` or a trailing slash.
- Use the Client ID of the React Single Page Application.
- The frontend and backend audiences must match the Auth0 API identifier.
- Keep the OpenWeather API key only on the backend.
- Never place private credentials in a `VITE_` variable: frontend configuration
  is included in the browser application.
- Actual `.env` files must remain untracked.
- Commit only placeholder `.env.example` files.

Restart the relevant development server after changing its environment file.

### 4. Start the backend

In one terminal, from the repository root:

```powershell
cd server
npm run dev
```

Expected startup message:

```text
Weather API running on port 5000
```

### 5. Start the frontend

In a second terminal, from the repository root:

```powershell
cd client
npm run dev -- --port 5173 --strictPort
```

Open:

http://localhost:5173

Keep both terminals running while using the application.

The frontend uses port 5173 and the backend uses port 5000 by default.
The frontend URL must match the allowed URLs configured in Auth0.

## City configuration

The assignment-provided city file is stored at:

`server/src/data/cities.json`

The supplied file contains a `List` array with eight city records:

- Colombo
- Tokyo
- Liverpool
- Paris
- Sydney
- Boston
- Shanghai
- Oslo

To meet the minimum of 10 configured cities, two supplementary records are
stored separately in:

`server/src/data/additional-cities.json`

| Supplementary city | CityCode |
| --- | --- |
| London | 2643743 |
| Cairns | 2172797 |

The original supplied file is preserved.

The city service reads both files and:

1. Extracts `CityCode`.
2. Converts numeric strings to numbers.
3. Rejects missing, invalid, non-positive, or unsafe integer values.
4. Removes duplicate codes.
5. Requires at least 10 unique codes.

The `Temp` and `Status` fields in the supplied file are not treated as current
weather. Current observations are retrieved from OpenWeather.

Ten configured cities do not guarantee ten successful responses during a
provider outage. The live verification checkpoint requires at least 10 valid
weather results.

## Weather retrieval

The backend uses the assignment's current weather endpoint:

```text
GET https://api.openweathermap.org/data/2.5/weather
```

Request parameters:

| Parameter | Purpose |
| --- | --- |
| id | Configured OpenWeather city code |
| appid | Backend OpenWeather API key |
| units | `metric` |

Metric units provide temperature in degrees Celsius and wind speed in metres
per second.

Each request has an eight-second timeout covering the response and body read.

The backend checks:

- HTTP status.
- Valid JSON.
- Matching city ID.
- Non-empty city name and weather description.
- Finite temperature no lower than absolute zero.
- Humidity between 0 and 100.
- Finite, non-negative wind speed.
- A valid observation timestamp.

These are structural and basic value checks. They do not independently verify
the scientific accuracy or freshness of the provider's observations.

### Partial failures

Cities are loaded independently using `Promise.allSettled`.

If one city fails, valid results from other cities remain available.
The response includes failure information and a partial-data message.

Ranks in a partial result describe only the successfully retrieved cities.

If all configured city requests fail, `/api/weather` returns HTTP 502.

Request URLs containing the OpenWeather key and authorization headers must
not be logged.

## Comfort Index

The Comfort Index compares weather against a chosen set of preferred
conditions.

It is a subjective heuristic, not a scientifically validated comfort index,
medical recommendation, or severe-weather safety assessment.

### Selected parameters

| Parameter | Preferred value | Weight | Penalty per unit of deviation |
| --- | --- | --- | --- |
| Temperature | 22°C | 50% | 6 points per °C |
| Relative humidity | 50% | 30% | 2 points per percentage point |
| Wind speed | 2 m/s | 20% | 20 points per m/s |

### Formula

First calculate a score for each parameter:

```text
T = clamp(100 - abs(temperature - 22) × 6)
H = clamp(100 - abs(humidity - 50) × 2)
W = clamp(100 - abs(windSpeed - 2) × 20)
```

Here:

```text
clamp(x) = min(100, max(0, x))
```

Combine the component scores:

```text
Comfort Index = 0.50T + 0.30H + 0.20W
```

The backend rounds the final score to one decimal place.

All component scores and the final score remain between 0 and 100.

### Reasoning behind the choices

Temperature receives the largest weight because this model treats deviation
from a mild temperature as the main influence on comfort.

Humidity receives the second-largest weight to represent a preference for
moderate conditions rather than very dry or very humid air.

Wind receives a smaller weight to represent a preference for a gentle breeze
rather than still air or strong wind.

The preferred values and penalty rates are application design choices.
They are not universal thresholds. Comfort also depends on climate,
clothing, activity, personal preference, and interactions between weather
conditions.

The penalty rates determine how quickly a component loses points as its
measurement moves away from the preferred value.

### Example 1: preferred conditions

Input:

```text
Temperature = 22°C
Humidity = 50%
Wind speed = 2 m/s
```

Calculation:

```text
T = 100
H = 100
W = 100

Comfort Index = 0.50(100) + 0.30(100) + 0.20(100)
              = 100
```

### Example 2: moderate deviations

Input:

```text
Temperature = 25°C
Humidity = 60%
Wind speed = 3 m/s
```

Calculation:

```text
T = 100 - abs(25 - 22) × 6 = 82
H = 100 - abs(60 - 50) × 2 = 80
W = 100 - abs(3 - 2) × 20 = 80

Comfort Index = 0.50(82) + 0.30(80) + 0.20(80)
              = 81
```

### Extreme conditions

Large deviations can reduce a component score to zero.
Clamping prevents negative scores.

A zero temperature component does not necessarily make the total score zero:
humidity and wind can still contribute points. This is one reason the result
must not be interpreted as a weather safety rating.

### Labels

| Score | Label |
| --- | --- |
| 80–100 | Excellent |
| 65 to below 80 | Comfortable |
| 45 to below 65 | Moderate |
| Below 45 | Uncomfortable |

### Ranking policy

Cities are sorted on the backend by:

1. Rounded Comfort Index, highest first.
2. Trimmed, lowercase city name, ascending.
3. Numeric city ID, ascending.

Sequential ranks start at 1. Equal scores receive separate positions using
the deterministic tie-breakers.

Frontend search and sorting change the displayed subset or order.
They do not recalculate the original backend rank.

### Formula configuration

Preferences, penalties, weights, and the formula version are defined in:

`server/src/services/comfort-index.service.js`

The configuration is currently code-based rather than editable through the UI.

Formula changes should include updated tests and documentation.
The processed-cache key includes the formula configuration.

## Cache design

The backend maintains two separate in-memory caches.

| Cache | Key | Expiry |
| --- | --- | --- |
| Raw weather | City ID | 300 seconds after successful retrieval |
| Processed rankings | Formula configuration and normalized city-code list | Earliest expiry of its raw weather inputs |

### Raw weather cache

Successful provider results retain the raw response, validated weather, and
retrieval timestamp.

Repeated requests reuse a raw entry until it expires.
A cache hit does not extend its expiry.

Failed provider requests are not cached as successful results.

### Processed-ranking cache

Complete ranked results are cached separately.

Their expiry cannot extend beyond the earliest raw input expiry. Calculating
rankings therefore does not give old weather another five minutes of life.

Partial and failed ranking results are returned without being stored in the
processed cache. Successful raw city results remain available for reuse,
while failed cities can be retried.

### Expiry during aggregation

A cached city can expire while another city is still loading.

After the initial load, the analytics service refreshes expired inputs once.
If an input is still expired when that refresh round completes, it is excluded
and reported as unavailable.

This bounds retries and avoids silently including expired raw inputs in newly
calculated rankings.

### Concurrent requests

Requests for the same uncached key share an in-progress load.
This avoids duplicate provider requests for the same city during simultaneous
dashboard loads.

### Refresh and diagnostics

The Refresh button calls the normal weather endpoint and respects backend
caching.

Weather response metadata includes:

- Cache status.
- Expiry timestamp.
- Remaining lifetime in seconds.

The protected debug endpoint reports:

- `HIT`, `MISS`, or `COALESCED` status.
- Hit, miss, and coalesced-request counts.
- Entry counts.
- In-progress request counts.
- Entry expiry and remaining lifetime.

These diagnostics describe this backend process only.

HTTP `Cache-Control: no-store` is separate from the backend cache. It prevents
clients and intermediaries from storing protected HTTP responses while the
backend still reuses its own weather data.

## Authentication and authorization

### Auth0 resources

Configure an Auth0 Single Page Application for the React frontend and an
Auth0 API for the Express backend.

| Setting | Value |
| --- | --- |
| Frontend application type | Single Page Application |
| API identifier / audience | https://fidenz-weather-api |
| API signing algorithm | RS256 |
| Allowed Callback URLs | http://localhost:5173 |
| Allowed Logout URLs | http://localhost:5173 |
| Allowed Web Origins | http://localhost:5173 |

Authorize the frontend application for user-delegated access to this API.

Enable the intended database connection for the frontend.
Disable unused login connections and public database signups.

### Frontend protection

The React application displays the login screen until Auth0 reports an
authenticated session.

It obtains an access token and sends it to protected backend endpoints:

```text
Authorization: Bearer <access_token>
```

Tokens are configured to use the Auth0 SDK's in-memory cache.

### Backend protection

Express validates the access token's signature, issuer, audience, and expiry
using `express-oauth2-jwt-bearer`.

After token validation, the API checks this signed custom claim:

```text
https://fidenz-weather-api/approved
```

Its value must be boolean `true`.

An ID token is not used to authorize API requests.

### Approved-user Action

Action source:

`auth0/actions/approved-users.cjs`

Create a Login / Post Login Action in Auth0 using that source.

Configure these Action secrets:

| Secret name | Purpose |
| --- | --- |
| WEATHER_CLIENT_ID | Identifies the weather frontend application |
| ALLOWED_EMAILS | Comma-separated approved email addresses |

Keep actual secret values in Auth0.

For the weather application, the Action checks:

- The login uses the expected database strategy.
- The user's email is in the allowlist.
- The user's email is verified.

It denies access when these checks fail and adds the approval claim when
they succeed.

Deploy the Action, attach it to the Login / Post Login flow, and apply the flow.
Deploying the source alone does not activate it for login.

### Email MFA

Configure MFA through the Auth0 tenant.

The intended configuration uses an independent authenticator factor,
the email factor, and an Always MFA policy.

Email verification and an email MFA challenge are separate steps.
Test the actual enrollment and email-code flow using an approved account
whose mailbox and device you control.

Record the enabled factors, policy, test outcome, and any limitations in:

`docs/auth0-setup.md`

Source code alone does not prove that tenant MFA settings or email delivery
work.

### Reviewer account

The assignment's designated reviewer account is:

```text
careers@fidenz.com
```

Create it in the enabled Auth0 database connection using the password supplied
in the assignment. Add its email to the approved-user policy.

The password must not be stored in source files, environment examples,
documentation, or Git history.

Reviewer login steps:

1. Start the backend and frontend.
2. Open http://localhost:5173.
3. Select Sign in.
4. Enter the designated reviewer email and assignment-provided password.
5. Complete any required verification and MFA using the reviewer's own
   mailbox and device.
6. Return to the dashboard.

The developer cannot verify the reviewer's mailbox access or complete the
reviewer's personal MFA enrollment.

## API endpoints

Base URL for local development:

```text
http://localhost:5000
```

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/health | Public | Basic application-process health |
| GET | /api/weather | Valid approved-user access token | Ranked weather results |
| GET | /api/debug/cache | Valid approved-user access token | Backend cache diagnostics |

### Weather response structure

The response contains:

- `data`: validated weather records with comfort scores and backend ranks.
- `failures`: city IDs and failure messages.
- `meta.status`: `complete`, `partial`, or `failed`.
- `meta.requestedCities`: number of unique requested cities.
- `meta.successfulCities`: successful city count.
- `meta.failedCities`: failed city count.
- `meta.message`: result summary.
- `meta.calculatedAt`: ranking calculation timestamp.
- `meta.cache`: cache status, expiry, and remaining lifetime.

Each successful city record includes:

- City code and name.
- Weather description.
- Temperature in °C.
- Humidity in percent.
- Wind speed in m/s.
- Observation timestamp.
- Comfort score, label, and component breakdown.
- Formula version.
- Rank.

### Important response statuses

| Status | Meaning |
| --- | --- |
| 200 | Successful response, including usable partial weather results |
| 401 | Missing, invalid, or expired access token |
| 403 | Valid token without required approval |
| 502 | All configured city weather requests failed |
| 500 | Unexpected internal server error |

The health endpoint checks the application process; it does not confirm
OpenWeather availability, Auth0 availability, or email delivery.

### Timestamp meanings

| Field | Meaning |
| --- | --- |
| observedAt | Time of the provider's weather observation |
| meta.calculatedAt | Time the backend calculated the rankings |
| meta.cache.expiresAt | Expiry of the processed ranking cache entry |

The UI formats timestamps using the device's local timezone.

A fresh provider request may return the same observation timestamp if
OpenWeather has not published a newer observation.

## Tests and local checks

### Backend tests

From the repository root:

```powershell
cd server
npm test
```

Run only the analytics tests:

```powershell
npm test -- src/tests/analytics.test.js
```

Watch mode:

```powershell
npm run test:watch
```

Existing backend tests cover:

- Preferred conditions and a known Comfort Index example.
- Score boundaries, extreme values, and invalid input.
- Ranking and deterministic tie-breakers.
- Preservation of input records.
- Weather response validation and request failures.
- Partial success and complete provider failure.
- Cache expiry, request sharing, and failed-request retry.
- Raw weather expiring during aggregation.
- Missing, malformed, expired, and incorrectly signed JWTs.
- Incorrect JWT issuer and audience.
- Approved-user claim enforcement.

JWT tests execute the actual authentication middleware.
Temporary signing keys and simulated issuer metadata/public-key responses
are test fixtures.

Weather tests simulate provider responses. They do not require a real
OpenWeather key.

### Frontend checks

From the repository root:

```powershell
cd client
npm run lint
npm run build
```

Linting and compilation do not replace browser interaction tests.

### Live weather checks

From the server directory:

```powershell
node scripts/check-weather.js one
node scripts/check-weather.js all
node scripts/check-rankings.js sample
node scripts/check-rankings.js live
```

The `one`, `all`, and `live` modes call OpenWeather and consume API requests.
The `sample` mode checks calculation and ranking using explicitly labelled
test data.

The all-city checkpoint requires at least 10 successful live results.

### Unauthenticated API checks

Keep the backend running in another terminal:

```powershell
curl.exe -i http://localhost:5000/api/health
curl.exe -i http://localhost:5000/api/weather
curl.exe -i http://localhost:5000/api/debug/cache
```

Expected:

- Health: HTTP 200.
- Weather without a token: HTTP 401.
- Cache diagnostics without a token: HTTP 401.

A connection failure means the server cannot be reached; it is not a passing
authentication check.

## Continuous integration

The CI configuration belongs in:

`.github/workflows/ci.yml`

It runs the following checks on GitHub:

1. Install backend dependencies with `npm ci`.
2. Run backend tests.
3. Install frontend dependencies with `npm ci`.
4. Run frontend ESLint.
5. Build the frontend.

The workflow uses placeholder configuration.
Real Auth0 credentials and an OpenWeather key are not required for these
automated checks.

A successful workflow does not prove live login, MFA, or email delivery.
This workflow validates the project; it does not deploy it.

Confirm the latest run in the repository's Actions tab before submission.

## Verification checklist

Update this table with actual outcomes and brief evidence.
Do not mark a check as passed solely because its implementation exists.

| Check | Status | Evidence / notes |
| --- | --- | --- |
| Backend test suite | Pending | |
| Frontend lint | Pending | |
| Frontend build | Pending | |
| GitHub Actions workflow | Pending | |
| Signed-out dashboard blocked | Pending | |
| Protected APIs reject missing tokens | Pending | |
| Approved account login | Pending | |
| Email MFA code received and accepted | Pending | |
| Non-allowlisted account denied | Pending | |
| Public signup rejected | Pending | |
| At least 10 live city results | Pending | |
| Repeated request uses cache | Pending | |
| Expired cache triggers retrieval | Pending | |
| Search and sorting | Pending | |
| Temperature sorting preserves backend ranks | Pending | |
| Partial-result message | Pending | |
| Backend outage and retry | Pending | |
| Mobile layout and keyboard controls | Pending | |
| Dark mode | Pending | |
| Logout removes dashboard access | Pending | |

Reviewer mailbox access and reviewer MFA enrollment have not been tested
by the developer.

## Trade-offs and known limitations

### Comfort model

The weighted formula is simple to inspect, explain, and test.
It does not model interactions between temperature, humidity, and wind.

Rain, sunlight, pressure, visibility, air quality, clothing, and activity
are not included in the current formula.

### In-memory caching

An in-memory cache avoids database infrastructure for this assignment.
It clears when the backend restarts.

Multiple backend instances would maintain independent caches.
A shared cache would be needed for coordinated caching across instances.

Cache entries are removed lazily during cache access or diagnostics.

### Provider dependence

Weather availability depends on OpenWeather connectivity, key activation,
account access, and rate limits.

Cached data can be up to five minutes old relative to retrieval.
The provider's observation itself may be older.

Partial failures reduce the number of displayed cities and can change
their relative ranks.

### Authentication

Auth0 settings, Action deployment, allowed URLs, and MFA configuration are
external to the source repository.

Removing a user from the allowlist blocks future token issuance through
the policy, but an already-issued access token may remain valid until expiry.

The debug endpoint currently permits all approved users.
A larger system could restrict it to a separate administrator role.

### Deployment

Local development URLs must be replaced with deployment URLs when hosting
the application.

Production setup requires HTTPS, appropriate Auth0 allowed URLs, a matching
frontend API URL, and backend environment configuration.


