# Weather Comfort Analytics

A secure weather dashboard built for the Fidenz assignment.

## Planned features

- Read the supplied city codes
- Retrieve current weather
- Calculate a custom backend Comfort Index
- Rank cities
- Cache weather for five minutes
- Protect access with Auth0
- Support mobile and desktop

## Status

Initial project setup.

## External service setup

### OpenWeatherMap

Create an OpenWeatherMap account and obtain an API key.
Store the key in server/.env as OPENWEATHER_API_KEY.

### Auth0

Create a Single Page Web Application and an API.

API identifier: https://fidenz-weather-api
Signing algorithm: RS256

Local frontend URLs:
- Allowed Callback URLs: http://localhost:5173
- Allowed Logout URLs: http://localhost:5173
- Allowed Web Origins: http://localhost:5173

Copy the Auth0 domain and SPA Client ID into the appropriate
environment files. The frontend and backend API audiences must match.

### Environment files

Copy client/.env.example to client/.env.
Copy server/.env.example to server/.env.
Replace placeholder values with your own configuration.

Actual .env files are excluded from version control.

## City configuration

The supplied cities.json contains eight cities inside a List array.
The assignment requires at least ten cities.

I preserved the supplied file and added London and Cairns in
server/src/data/additional-cities.json.

The backend reads both files, validates CityCode values, converts
them to numbers, removes duplicates, and requires at least ten
unique city codes.

The Temp and Status fields in the supplied file are not used as
live weather data. Current weather will be retrieved from OpenWeatherMap.

## Weather retrieval

The backend retrieves current weather from OpenWeatherMap using
the configured CityCode values and metric units.

Each request has an eight-second timeout. Responses are checked
for HTTP errors, valid JSON, matching city ID, city name,
description, temperature, humidity, wind speed, and timestamp.

Requests are processed using Promise.allSettled so one failed
city does not discard successful results.

The OpenWeather API key is loaded from server/.env.
Request URLs and API keys are not logged.

### Manual integration checks

From the server directory:

- node scripts/check-weather.js one
- node scripts/check-weather.js all

The all-city checkpoint requires at least ten valid weather results.
These commands use the live API and consume API requests.

## Comfort Index

The backend calculates a Comfort Index from temperature,
humidity, and wind speed.

### Formula

T = clamp(100 - abs(temperature - 22) * 6)
H = clamp(100 - abs(humidity - 50) * 2)
W = clamp(100 - abs(windSpeed - 2) * 20)

Comfort Index = 0.50T + 0.30H + 0.20W

Each component is clamped between 0 and 100.
The final score is rounded to one decimal place.

### Design assumptions

- Temperature receives 50% because it strongly affects comfort.
- Humidity receives 30% because very dry or humid conditions
  can reduce comfort.
- Wind receives 20% to represent the effect of air movement.

The preferred values are 22°C, 50% humidity, and 2 m/s wind.

The penalty values control sensitivity: each degree away from
22°C reduces the temperature component by 6 points; each
percentage point away from 50% reduces the humidity component
by 2 points; each m/s away from 2 reduces the wind component
by 20 points.

### Ranking policy

Cities are ranked by descending one-decimal Comfort Index.
Equal scores are ordered by city name, then city ID.
Ranks are sequential positions beginning at 1.

### Limitations

This is a subjective comparison heuristic, not a scientifically
validated comfort or safety index.

It assumes independent contributions from the three parameters
and does not model interactions between heat, humidity, and wind.
Rain, sunlight, clothing, activity, and individual preferences
are not represented.

### Manual checks

From the server folder:

node scripts/check-rankings.js sample
node scripts/check-rankings.js live

## Automated tests

From the project root:

```powershell
cd server
npm ci
npm test
```

To rerun tests automatically while developing:

```powershell
npm run test:watch
```

The backend tests cover:

- Preferred conditions and the documented Comfort Index example.
- Extreme conditions, score boundaries, and invalid inputs.
- Descending rankings and deterministic tie-breaking.
- Preservation of the original weather records.
- Weather response validation.
- HTTP errors, network failures, and malformed JSON.
- Partial success when one city's weather response is invalid.

Weather request tests replace fetch with mock responses. They do not
require an OpenWeather API key or make external network requests.

Live API connectivity and the minimum of 10 valid cities are checked
separately.