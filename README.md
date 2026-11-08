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

Send an `X-Device-Id` header (any random string per install) on writes; there are no accounts yet.
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

- `visitors <= 500`: `diameter = 1 + visitors/100` (1.0 at 0, 6.0 at 500)
- Above 500 the slope halves every bracket: widths double (500, 1000, 2000, ...)
  and each adds +2.5 diameter - 500=6, 1000=8.5, 2000=11, 4000=13.5

See `backend/src/main/java/ca/kindredlink/business/BusinessBubbleSize.java`.
