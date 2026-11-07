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

Frontend:

```bash
cd frontend && npm install && npx expo start
```

Scan the QR with Expo Go. From a phone, call the API at `http://<laptop-LAN-IP>:8080`.

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

Send an `X-Device-Id` header (any random string per install) on writes; there are no accounts yet.
Game rules (2 children, 12 h window, distances, privacy grid) are in `backend/src/main/resources/application.yml`.
