# Deploying the backend to Render

Manual guide for hosting the Spring Boot API on Render as a Docker web
service, backed by the existing Render PostgreSQL database. Everything is
done from the Render dashboard - no CLI or `render.yaml` needed.

## Demo-only caveats (read first)

- The API has **no real auth**: writes are identified by a self-chosen
  `X-Device-Id` header, and CORS allows any origin (`*` on `/api/**`). Both
  are intentional hackathon shortcuts - they are not access control. Do not
  store sensitive data.
- `ddl-auto: update` lets Hibernate evolve the schema and
  `kindred.seed-demo-data` seeds an empty database on first boot. Both are
  demo conveniences that **modify the shared database** - there are no data
  migrations, and no new database is required (the existing one is reused).
- Free Render instances sleep: expect a ~30-60 s cold start on the first
  request after idle.

## 1. Create the web service

1. Render dashboard -> **New** -> **Web Service** -> connect this repo.
2. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** Docker (uses `backend/Dockerfile`, path `./Dockerfile`)
   - **Region:** same region as the PostgreSQL instance (Oregon) for low
     latency and internal-network access.
3. **Health Check Path:** `/actuator/health`.

The image runs `java -jar` listening on 8080. Render injects `PORT`
automatically and `server.port=${PORT:8080}` in `application.yml` picks it
up - nothing to configure.

## 2. Environment variables (dashboard -> Environment)

Set these in the dashboard only - never in the Dockerfile, image, or git:

| Variable | Value |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `postgres` |
| `DATABASE_URL` | `jdbc:postgresql://<internal-host>:5432/<database>?sslmode=require` |
| `DATABASE_USER` | user from the Render PostgreSQL **Info** page |
| `DATABASE_PASSWORD` | password from the same page |

Notes:

- `DATABASE_URL` must be a **JDBC** URL (`jdbc:postgresql://...`) - not the
  raw `postgresql://user:pass@host/db` URI Render displays. Copy the host,
  port and database name from the dashboard and build it as shown above.
  The existing database name `hackathon_mrju` is fine to reuse.
- Prefer the **internal** hostname (service and database in the same region)
  and keep `?sslmode=require`.
- Use `SPRING_PROFILES_ACTIVE=postgres` - **not** `local`. The `local`
  profile file only exists on a developer machine and is never in the image.

### Optional: automatic photo screening (Google Cloud Vision)

New uploads can be screened by the Vision `images:annotate` SafeSearch
endpoint before they reach the manual queue.

- In Google Cloud: enable the **Vision API** on the project (requires
  billing), then create an **API key restricted to the Vision API** (and
  ideally to the backend's IP). A Maps **app-restricted** key (Android/iOS
  restriction) is *not* reusable here - it must be a server-usable key.
- Set `GOOGLE_VISION_API_KEY` in the Render dashboard (same place as the
  variables above). The backend sends it in the `X-Goog-Api-Key` header,
  never in the URL or logs.
- Policy (fixed in `PhotoSafetyPolicy`, not configurable): a photo is
  auto-approved only when SafeSearch reports **adult, violence and racy
  each as `VERY_UNLIKELY` or `UNLIKELY`**. Any higher likelihood, missing
  or unknown value, provider error, timeout, HTTP error, or blank key
  leaves the photo **PENDING** for a moderator - it is never auto-rejected.
- The `MODERATOR_KEY` flow stays useful: screening failures, borderline
  results, and every photo uploaded before the key was set still need a
  manual approve. Only **new** uploads are screened; existing pending
  photos are untouched.
- With no key set, nothing changes: no requests are made and every photo
  stays in the manual queue.

## 3. After deploy

- `GET https://<service>.onrender.com/actuator/health` -> `{"status":"UP"}`
- `GET https://<service>.onrender.com/api/businesses` -> seeded business list
- Dashboard logs should show the `postgres` profile active and a successful
  PostgreSQL Hikari pool connection.

## 4. Point the frontend at it

Local, uncommitted file - create `frontend/.env.local` (already gitignored):

```dotenv
EXPO_PUBLIC_API_URL=https://<service>.onrender.com
EXPO_PUBLIC_USE_MOCKS=0
```

Then restart `npx expo start`. The standalone bubble lab
(`http://localhost:8081/bubble-simulation/`) has its own editable
"Business API base" field - enter the service URL there instead.

Nothing here changes the local MySQL setup or `compose.yaml`; the default
profile still works for local development.
