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