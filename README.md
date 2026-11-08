# Kindred-Link

Kindness chains on a map. Mobile app (Expo / React Native) + Java API (Spring Boot).

```
backend/   Spring Boot 4, Java 21, Maven wrapper. MySQL by default (persistent), seeded with demo data; H2 for tests.
frontend/  Expo SDK 58 (expo-router), react-native-maps, expo-location/notifications/camera/image-picker.
```

## Run

Backend (needs JDK 21 - compiling requires a JDK, not just a JRE - plus a
MySQL database, see below):

```bash
docker compose up -d --wait db   # optional convenience MySQL (needs Docker)
cd backend && ./mvnw spring-boot:run
```

API on http://localhost:8080, interactive docs at http://localhost:8080/docs.

## Database

The backend connects to MySQL by default. The easiest option is the bundled
`compose.yaml` service (requires Docker), which creates the `kindred` database
and user for you:

```bash
docker compose up -d --wait db    # start MySQL 8.4 on 127.0.0.1:3306, wait for healthy
docker compose stop db     # stop it later; data persists in the mysql_data volume
```

Credentials are local-demo defaults only (`kindred` / `kindred_demo`,
root `local_root_demo`) - never reuse them elsewhere.

No Docker? Point the app at any existing MySQL 8 instance where you have
already created the database and user, via environment variables:

```bash
# DATABASE_URL is a JDBC URL (host, port, database name, optional params)
cd backend
DATABASE_URL=jdbc:mysql://localhost:3306/kindred \
DATABASE_USER=kindred \
DATABASE_PASSWORD=kindred_demo \
./mvnw spring-boot:run
```

PowerShell equivalent:

```powershell
cd backend
$env:DATABASE_URL = "jdbc:mysql://localhost:3306/kindred"
$env:DATABASE_USER = "kindred"
$env:DATABASE_PASSWORD = "kindred_demo"
.\mvnw.cmd spring-boot:run
```

Note: `compose.yaml` environment values reach the MySQL container, but Spring
Boot on the host does not auto-load a `.env` file - set the variables in your
shell if you change the defaults.

Data persists across restarts: `ddl-auto: update` keeps the schema, and the demo
seed only runs on an empty database, so seeded chains age out naturally instead
of resetting. `ddl-auto: update` is a demo convenience, not a production
migration strategy. Tests still use isolated in-memory H2 (`test` profile).

An optional `postgres` profile also exists
(`SPRING_PROFILES_ACTIVE=postgres`, same `DATABASE_*` overrides) for a
PostgreSQL deployment, but MySQL is the default.

### Local config file (e.g. hosted PostgreSQL such as Render)

Spring Boot also reads `./config/application-<profile>.properties` when the
backend is launched from `backend/` - no Docker needed. To run against your
own hosted PostgreSQL, copy
`backend/config/application-local.properties.example` to
`backend/config/application-local.properties` (the copy is gitignored, so
secrets stay out of version control), replace the placeholders, then opt in
to the `local` profile alongside `postgres`:

```powershell
cd backend
.\mvnw.cmd "-Dspring-boot.run.profiles=postgres,local" spring-boot:run
```

The `postgres` profile supplies the PostgreSQL/JPA settings and `local` makes
Spring load your gitignored datasource file (keep `?sslmode=require` for
hosted providers). Because nothing in the file loads unless `local` is
selected, the default `spring-boot:run` and `mvn test` are unaffected - MySQL
stays the default and tests keep using isolated in-memory H2.
`SPRING_DATASOURCE_*` environment variables override the file when set.

To host the API itself (Docker on Render), see
[backend/DEPLOYMENT.md](backend/DEPLOYMENT.md).

Frontend:

```bash
cd frontend && npm install && npx expo start
```

Scan the QR with Expo Go. From a phone, call the API at `http://<laptop-LAN-IP>:8080`.

## Clerk authentication (Google sign-in)

1. In Clerk, enable the Google social connection (configure your own Google OAuth
   credentials for production), enable **Native API**, and register the Android app
   with package name `ca.kindredlink`. Add an iOS bundle identifier before shipping
   an iOS build.
2. Add the Clerk **publishable key** to `frontend/.env.local`:

   ```dotenv
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

   Restart Expo after changing the environment. The Settings screen opens Clerk's
   hosted sign-in page; Google sign-in is available when it is enabled in the Clerk
   Dashboard.
3. Configure the backend with the issuer and JWKS URL for the same Clerk instance:

   ```powershell
   $env:CLERK_ENABLED = "true"
   $env:CLERK_ISSUER = "https://your-instance.clerk.accounts.dev"
   $env:CLERK_JWKS_URI = "https://your-instance.clerk.accounts.dev/.well-known/jwks.json"
   ```

   Set `CLERK_ENABLED=true` and those URLs in your deployment environment as well.
   The issuer must exactly match the `iss` claim in Clerk session tokens. Never put
   a Clerk secret key in the mobile app.

When enabled, Spring verifies bearer session tokens against Clerk's JWKS and issuer.
API writes require a valid session. Public map and chain reads, including the existing
anonymous-device `GET /api/nodes?mine=true` behavior, remain available. The verified
Clerk subject becomes the identity for node ownership, claims, photos, and check-ins;
the client-supplied device ID cannot override it on authenticated requests. Anonymous
mode remains available when Clerk is disabled. Existing anonymous device-owned records
are not automatically transferred to a Clerk account.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | /api/nodes | Public map pins (`?lat&lng&radius`, or `?mine=true`) |
| GET | /api/nodes/{id} | Node details |
| POST | /api/nodes | Create an original kindness node |
| POST | /api/nodes/{id}/claim | Reserve one of the node's 2 slots (body: `{lat, lng}`); returns `{claimedAt, finishBy}` |
| POST | /api/nodes/{id}/continue | Post your act as the next link; requires a claim on that node first |
| GET | /api/chains/{id} | Entire chain tree |
| GET | /api/chains/{id}/stats | Chain statistics |
| GET | /api/businesses | Business hubs |
| POST | /api/businesses/{id}/checkin | Verified QR participation |
| POST | /api/photos | Upload a photo (multipart, part named `file`); returns `{id, status: "PENDING"}` |
| GET | /api/photos/{id} | The picture (JPEG). Public once approved; pending or rejected photos answer `not_found` |
| GET | /api/photos/pending | Moderator only (`X-Admin-Key`): photos waiting for a decision |
| POST | /api/photos/{id}/approve, /reject | Moderator only (`X-Admin-Key`) |

Anonymous writes use an `X-Device-Id` header. When Clerk is enabled, send the session token
as `Authorization: Bearer <token>` instead; the Expo API client attaches it automatically
for signed-in users.
Game rules (2 slots, 12 h to finish after claiming, 7-day chain limit, distances, privacy grid) are in `backend/src/main/resources/application.yml`.

## Claim, then continue

A node has 2 slots. To add a child, a person first **claims** a slot, then **continues**
(posts their act) before their own deadline.

- A node can be claimed any time until its **chain ends** (7 days after the chain's first node). It does not
  close after 12 h: a node created with 3 days left on its chain stays open for those 3 days.
- Each claim gets a fresh 12 h from the moment of the claim to post (`finishBy` in the claim response),
  capped at the chain's end.
- A claim uses up its slot even if the person never finishes. An abandoned slot is never given to someone else.
- **7-day hard stop:** a chain stops accepting links 7 days after its first node, even if people are still
  linking (`kindred.chain.max-days`). A claim's `finishBy`, and every pin's `closesAt` and `openSlots`
  (map pins, node details, chain map), never run past that moment.
- You can't claim your own node, can't claim the same node twice, and must be within the allowed distance
  (checked on the server using the real GPS fix) when you claim and when you continue.

Map pins (`GET /api/nodes`) reflect this:
- `openSlots` is how many slots can still be **claimed** (2 minus claims taken, and 0 once the chain's 7-day end has passed). `closesAt` on a pin is the chain's end.
- `childCount` is how many children actually **posted** (claimed but unfinished slots don't count).

Error codes (the `title` field of the error JSON):

| Code | Meaning |
|---|---|
| `bad_device_id` | Any write (create, claim, continue, check-in): `X-Device-Id` is missing, blank, over 100 characters, or has characters other than letters, digits and `. _ : -` |
| `chain_ended` | Claim or continue: the chain is more than 7 days old (counted from its first node). Nobody can add links any more |
| `slot_closed` | Claim: both slots of this node are already taken (claimed, finished or not) |
| `already_claimed` | Claim: this device already claimed this node. Continue: this device already posted for it |
| `own_node` | Claim: you can't claim your own node |
| `too_far` | Claim or continue: you're too far from the node |
| `no_claim` | Continue: claim this node first |
| `claim_expired` | Continue: your 12 h to finish ran out, and the slot is gone |
| `bad_photo` | Upload: the file isn't a readable picture, is empty, or is over 25 megapixels |
| `not_your_photo` | Create / continue: the `photoId` was uploaded by a different device |
| `photo_used` | Create / continue: that photo is already attached to a node |
| `not_moderator` | Moderation endpoints: missing or wrong `X-Admin-Key` (or moderation is switched off) |

## Photos

After writing a good deed, a user can take a photo of it. It is optional.

1. **Upload:** `POST /api/photos` (multipart/form-data, part `file`, header `X-Device-Id`). The phone should compress first; the server also strips hidden data (GPS, camera info), shrinks the picture to 1600 px and re-saves it as a plain JPEG. Max 5 MB. The answer is `{id, status: "PENDING"}`.
2. **Attach:** send that `id` as `photoId` in the body of `POST /api/nodes` or `POST /api/nodes/{id}/continue`. There is no free-text photo link any more. You can only attach a photo you uploaded, and a photo can be used once.
3. **Moderation:** every photo is hidden until a moderator approves it. Moderators send the secret in the `X-Admin-Key` header (set on the server with the `MODERATOR_KEY` environment variable; if it is empty, moderation is off and nothing can be approved).
4. **Who sees it:** everyone, on every map (including the one where you browse for nodes to join), but only once a moderator has approved it.
   - `photoUrl` on `GET /api/nodes/{id}` is a path like `/api/photos/12` (put the API address in front), or `null` while the photo is pending or rejected.
   - `hasPhoto` on map pins and chain nodes is `true` only for nodes with an approved photo.
   - Fetch the picture with `GET /api/photos/{id}`. It is a plain image link, so no special headers are needed. Pending and rejected photos answer `not_found`.
   - The uploader's phone can show its own local copy while the photo waits for approval.

## Business Bubble Growth

Each business hub reports `diameterUnits` - a logical bubble size derived from
`visitors`, the lifetime count of unique device IDs that checked in there
(approximates people, but devices are not guaranteed to be individuals; repeat
scans by the same device don't grow the bubble). It is additive on
`GET /api/businesses` and on the nested `business` in checkin responses; the
frontend maps units to pixels.

`lastKindnessAt` is the `createdAt` of the newest checkin linked to a
kindness node - ordinary scans never refresh it. `opacity` is the
whole-bubble transparency for that recency: 1.0 within the hour, 0.8 within
a day, 0.5 within a week, 0.25 when older or when no linked act exists.

- `visitors <= 50`: `diameter = 1 + visitors/10` (1.0 at 0, 6.0 at 50)
- Above 50 the slope halves every bracket: widths double (50, 100, 200, ...)
  and each adds +2.5 diameter - 50=6, 100=8.5, 200=11, 400=13.5. The curve is
  piecewise linear with halving slope per bracket, not a smooth exponential.

See `backend/src/main/java/ca/kindredlink/business/BusinessBubbleSize.java`.

## Demo business catalog

Fresh databases seed two user-provided businesses (`DemoData` only runs when
the database is empty, so existing databases are never re-seeded; replacing
previously seeded records is a manual operation):

| Business | Coordinates | Logo |
|---|---|---|
| Cinnzeo Bakery Cafe | 51.07923, -114.127219 | `/images/businesses/cinnzeo-bakery-cafe.png` |
| Lotus Fine Indian Cuisine - Charleswood | 51.087303, -114.109781 | `/images/businesses/lotus-charleswood.png` |

Logo paths are served relative to the API origin (e.g.
`http://localhost:8080/images/businesses/cinnzeo-bakery-cafe.png`), not the
frontend origin. Coordinates and logos were provided by the demo owner for
simulation use - they are not geocoder-verified and imply no partnership.
Each record starts with zero visitors/kindness acts, and seeded QR tokens are
random UUIDs rather than guessable names.

## Geocoding lookup (demo-only)

`GET /api/geocoding/search?q=...` returns up to 5 address candidates as
`[{id, displayName, lat, lng}]`, backed by the public
[Nominatim](https://nominatim.openstreetmap.org) service. It is a generic,
reusable lookup - intended to eventually feed both business placement and
kindness-node input - but it is **lookup-only: it writes nothing** to the
database and does not create anything. Kindness nodes still use the existing
GPS capture + privacy-approximation pipeline; geocoding is not wired into node
creation.

- Validation: trimmed query must be 3-200 chars (`400 invalid_address`)
- Polite defaults for the public service: 1 upstream call per ~1.1 s per
  process (`429 geocoding_rate_limited`), results cached 24 h in memory
  (128 entries, cleared on restart), identifying `User-Agent`, 3 s connect /
  5 s read timeouts, no retries. Provider failures surface as
  `503 geocoding_unavailable`.
- Config in `application.yml` (`kindred.geocoding`): override via
  `GEOCODING_BASE_URL` / `GEOCODING_USER_AGENT`.
- **Requires a backend restart** after pulling these code changes - a running
  old process will 404 this endpoint.
- The public Nominatim service has **no SLA**; obey its
  [usage policy](https://operations.osmfoundation.org/policies/nominatim/)
  (max ~1 req/s per application, no autocomplete-style calls, don't send
  private/confidential addresses). If multiple backend instances run, they
  rate-limit independently - coordinate request rate or point them at your
  own provider. Results are approximate locations, not exact entrances.

## Bubble simulation

A standalone browser lab for the bubble-size formula, served as static files by
the Expo dev server - no Expo APIs, separate from the app itself. The only
backend interactions are read-only GETs: `GET /api/businesses` for the live
catalog and the geocoding lookup described above; nothing mutates the
database. With the dev server running (`cd frontend && npm run web`), open:

http://localhost:8081/bubble-simulation/

On load it fetches the live business catalog once (editable "Business API
base", default `http://localhost:8080`); the "Reload businesses" button is
the only way data refreshes - no polling, and reload restores backend values
over local preview edits. Logo URLs resolve against the API origin. Newer
backends also report `lastKindnessAt` and `opacity`; an older backend that
omits the field shows "Kindness recency unknown" - nothing is invented. It
renders each business as a geographic circle on a real map
(Leaflet 1.9.4 + OpenStreetMap tiles, vendored under
`frontend/public/bubble-simulation/vendor/` - the CSS is whitespace-compressed
to stay within the file-size rule; the BSD-2 license is the `LICENSE` file
there. See the
[tile usage policy](https://operations.osmfoundation.org/policies/tiles/)).
Pick a business to edit its unique-visitor count or change the meters-per-unit
scale (5-100, default 5). Individual circle geographic diameter =
`diameterUnits * metersPerUnit * 1.3` (a display-only factor), so zooming
in/out makes circles look bigger/smaller while their physical diameter
stays fixed - the extent visualizes participation, not a verified service
area. Cluster circles use the unscaled member base radii. When a single
business has a loadable API logo, the image is clipped inside its own circle
(center-cropped, untinted) and the recency color becomes the outline; the
plain colored fill returns whenever no logo is available. Shared cluster
circles stay plain - no single brand represents a group.

The sidebar also has an address-search panel: it calls
`GET /api/geocoding/search` on the backend (editable API base, default
`http://localhost:8080`), lists candidates, previews one as a temporary pin,
and only **Confirm location** moves the selected simulated business - nothing
is persisted. The growth logic mirrors `BusinessBubbleSize` and lives in
`frontend/public/bubble-simulation/` (`bubble-size.mjs` +
`bubble-dimensions.mjs`, tested via `node --test .../bubble-size.test.mjs
.../bubble-dimensions.test.mjs`).

Two extra presentation layers live in the same lab:

- **Recency colors** (`recency.mjs`, tested via `recency.test.mjs`): circle
  vibrancy simulates how recent the last contribution was while size keeps
  encoding total participation. An "Activity simulation" panel advances a
  manual clock (+1 h / +24 h / +7 days) and edits the selected business's
  last-act-of-kindness age. The whole bubble fades by recency - opacity 100%
  within 1 h, 80% within 24 h, 50% within 7 d, 25% older, and 25% with no
  recorded act - while the teal outline desaturates through the same bands.
  Only **Record kindness** or the age editor sets the last act; ordinary
  visitor-count changes never refresh or clear it. Preview actions stay local
  and never update the backend's recorded kindness history.
- **Zoom clustering** (`business-clusters.mjs`, tested via
  `business-clusters.test.mjs`): the "Cluster nearby businesses" checkbox (on
  by default) draws businesses whose projected centers sit within 64 screen
  pixels as ONE round circle, so nearby businesses merge as you zoom out and
  split back into individual circles as you zoom in (all separate at zoom
  16+, and always separate with clustering off). Membership is computed in
  world coordinates (panning never regroups) by deterministic greedy
  agglomeration: a candidate group is accepted only when EVERY member lies
  within 200 m x populationWeight of the candidate's population-weighted
  centroid, so chains can never run away. populationWeight(total summed
  visitors) is 1 up to 5,000 and grows +0.2 per additional 5,000 (1.2 up to
  10,000, 1.4 up to 15,000, ...) - the sum is a clustering input across
  businesses, never a unique-people count. A cluster circle sits at that
  weighted centroid with a display radius of 3.6 * sqrt(sum r^2) - a
  display-only scale, not a reach or membership multiplier - and shares
  the vibrancy of its freshest member
  contribution. Hovering/focusing a cluster lists each member's own count
  and recency plus the summed population and inclusion limit on demand;
  clicking or pressing Enter zooms in to split it.
- **Phone preview**: the **Map lab / Phone preview** toggle (or
  `http://localhost:8081/bubble-simulation/?view=phone`) re-wraps the same map
  in a pure-CSS device frame with an app header and guide text - a browser
  mockup of how the map could feel in the mobile app, not the actual Expo app
  and not a second map instance.
