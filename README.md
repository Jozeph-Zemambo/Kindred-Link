# Kindred-Link

Kindness chains on a map. Mobile app (Expo / React Native) + Java API (Spring Boot).

```
backend/   Spring Boot 4, Java 21, Maven wrapper. In-memory H2 DB, seeded with demo data.
frontend/  Expo SDK 58 (expo-router), react-native-maps, expo-location/notifications/camera/image-picker.
```

## Run

Backend (needs Java 21):

```bash
cd backend && ./mvnw spring-boot:run
```

API on http://localhost:8080, interactive docs at http://localhost:8080/docs.
The API validates Auth0 access tokens for `https://api.kindredlink.example`. Set
`AUTH0_ISSUER_URI` and `AUTH0_AUDIENCE` to override the defaults in
`backend/src/main/resources/application.yml`.

Frontend:

```bash
cd frontend && npm install
```

Set up the Auth0 Native application and environment in [frontend/README.md](frontend/README.md), then
run `npx expo run:android` or `npx expo run:ios`. Auth0 native login requires a custom development
build; it does not run in Expo Go. For a physical device, set `EXPO_PUBLIC_API_URL` to
`http://<laptop-LAN-IP>:8080`.

The app's native login buttons use Auth0 Universal Login with the Google and GitHub connections.
Enable both connections for the Native application in the Auth0 Dashboard, install the Post Login
Action documented in `frontend/README.md`, and configure GitHub to return the user's email. The
existing email/password API endpoints remain available; Auth0 users are provisioned as backend
accounts on their first authenticated API request. Accounts are not automatically linked by email.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | /api/nodes | Public map pins (`?lat&lng&radius`, or `?mine=true`) |
| GET | /api/nodes/{id} | Node details |
| POST | /api/nodes | Create an original kindness node |
| POST | /api/nodes/{id}/continue | Add a child to a chain |
| GET | /api/chains/{id} | Entire chain tree |
| GET | /api/chains/{id}/stats | Chain statistics |
| GET | /api/businesses | Business hubs |
| POST | /api/businesses/{id}/checkin | Verified QR participation |

Protected API writes require a valid Auth0 access token (or an existing local bearer session token).
Game rules (2 children, 12 h window, distances, privacy grid) are in `backend/src/main/resources/application.yml`.
