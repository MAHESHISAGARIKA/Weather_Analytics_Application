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