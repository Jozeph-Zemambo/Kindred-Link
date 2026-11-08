# Business Bubbles: Frontend Handoff

This is the backend contract and the agreed bubble behavior. The standalone
browser lab demonstrates the behavior; it is not the native mobile map.
Work is being prepared on `backend/business-catalog-geocoding`.

## Backend Contract

`GET /api/businesses` returns individual businesses, not precomputed clusters.
`POST /api/businesses/{id}/checkin` returns the same business shape nested in
`{ checkinId, business }`.

```ts
type BusinessHub = {
  id: number;
  name: string;
  logoUrl: string | null;
  lat: number;
  lng: number;
  visitors: number;
  kindnessActs: number;
  diameterUnits: number;
  lastKindnessAt: string | null;
  opacity: number;
};
```

- `visitors`: lifetime distinct device IDs per business, not verified unique
  people. Repeated scans on the same device do not increase this count.
- `kindnessActs`: check-in records linked to a kindness node; this is not a
  deduplicated count of unique acts.
- `diameterUnits`: logical diameter calculated by the backend; not pixels,
  meters, or a radius.
- `lastKindnessAt`: ISO-8601 timestamp of the latest business check-in whose
  `nodeId` is non-null, using the check-in's creation time. It is not the
  linked node's original creation time. Ordinary scans do not refresh it.
- `opacity`: whole-bubble opacity calculated at response time, not percentage
  transparency. Apply it once to the whole bubble, including its logo.

| Last linked kindness check-in | Opacity |
|---|---:|
| Within 1 hour, inclusive | 1.0 |
| Over 1 hour through 24 hours | 0.8 |
| Over 24 hours through 7 days | 0.5 |
| Over 7 days, or none recorded | 0.25 |

The fields require the updated backend process to be running. An old process
will omit them. Missing `lastKindnessAt` means unknown recency; explicit null
means no recorded linked kindness check-in. Do not invent a recent timestamp.

## Logos and Business Data

Resolve relative `logoUrl` values against the API origin, not the frontend's
origin. For example, `/images/businesses/cinnzeo-bakery-cafe.png` resolves to
`http://<backend-host>:8080/images/businesses/cinnzeo-bakery-cafe.png`.

| Business | Latitude | Longitude | Logo path |
|---|---:|---:|---|
| Cinnzeo Bakery Cafe | 51.07923 | -114.127219 | `/images/businesses/cinnzeo-bakery-cafe.png` |
| Lotus Fine Indian Cuisine - Charleswood | 51.087303 | -114.109781 | `/images/businesses/lotus-charleswood.png` |

Coordinates and images were supplied by the project owner. These are not a
successful geocoding test or proof of a partnership. Both start at zero
participation. Fresh databases seed these records; existing databases are not
automatically migrated. IDs are generated and must not be hardcoded.

Individual business logos should fill the round bubble, center-cropped and
clipped to the circle, with no permanent business-name overlay or separate
center dot. Keep names and counts in tap/hover details. Preserve recency color
in the outline, and fade the entire bubble and image together. A shared
cluster stays plain rather than using one member's logo as a group identity.

## Growth and Geographic Scale

The backend and browser lab use the same continuous growth rule:

- Zero visitors starts at 1 diameter unit.
- Visitors 1-50 add 0.1 units each: `d = 1 + visitors / 10`.
- Visitors 51-100 add 0.05 each; 101-200 add 0.025 each; 201-400 add 0.0125
  each. Subsequent bracket widths double as their slope halves.
- Examples: 50 visitors = 6 units; 100 = 8.5; 200 = 11; 400 = 13.5.

The agreed map presentation uses geographic circles, not fixed-pixel markers:

```text
baseDiameterMeters = diameterUnits * 5
baseRadiusMeters = baseDiameterMeters / 2
individualDisplayRadiusMeters = baseRadiusMeters * 1.3
```

For example, 50 visitors displays as 39 meters across, with a 19.5 meter
radius. A map API that expects a radius must not receive the diameter.
Zooming changes the screen size, not the geographic size.

## Zoom Clustering

These rules are implemented in the browser lab, not in the backend response
or the native app yet. Portable helpers live under
`frontend/public/bubble-simulation/`.

- Nearby businesses may share one round circle when their projected centers
  connect within 64 screen pixels. Use world projection coordinates so
  panning does not change membership.
- A candidate is accepted only if every member is within
  `200 meters * populationWeight` of its recomputed, population-weighted
  projected center. All-zero populations use the arithmetic-mean center.
- Population means summed per-business `visitors`, not geometric area. It
  may count the same person at multiple businesses.
- Weights: 0-5,000 = 1.0; 5,001-10,000 = 1.2; 10,001-15,000 = 1.4; continue
  adding 0.2 per 5,000. Recheck every member after the center changes.
- The current helper greedily merges the closest eligible pair with stable
  ID tie-breaking; it is deterministic, not a global clustering optimizer.
- Cluster display radius is `3.6 * sqrt(sum(baseRadiusMeters ** 2))`.
  Use unscaled member base radii: the individual 1.3 factor must not enlarge
  the shared cluster. The display radius does not set the inclusion limit.
- Clusters use their freshest member's known kindness recency for appearance.
- Split into individual businesses at zoom 16 or closer. Tapping a cluster
  should zoom in; do not retain small center dots for its member businesses.

Projection and geographic-distance callbacks are supplied by the map adapter.
The existing adapter is Leaflet-specific. Native integration is still needed;
do not import Leaflet, browser DOM modules, or SVG skin code into React Native.

## Integration Gaps in the Current App

The frontend team's demo is preserved. It currently needs these connections:

1. Extend `frontend/src/api/types.ts` with `lastKindnessAt` and `opacity`.
2. Normalize business logo URLs in the API layer against `API_URL`.
3. Pass opacity through both `ChainMap` and `JoinMap` to `BusinessBubble`.
   Apply it once to the bubble container; do not fade the logo a second time.
4. The current `BusinessBubble` is a fixed-screen-size marker view with a
   smaller logo inside. Geographic sizing, full-circle logo clipping, custom
   clustering, and zoom splitting still need a native map adapter.
5. Update the frontend mock growth formula if the demo should match the new
   first-50 curve; the existing mock formula still uses the old first-500 rule.
6. The home screen hides its map when the current device has no kindness
   nodes. The Explore screen currently requests nodes without businesses.
   Those are frontend visibility decisions, not empty backend business data.

The installed `react-native-maps` Circle supports meter-based radii but does
not expose a dedicated Circle tap callback in its typed props. Plan native
map-level hit testing or another supported interaction mechanism. Native
Apple Maps rendering, logo overlays, gestures, and clustering are not verified
by the browser lab.

## Local Verification

Prerequisites: JDK 21 and MySQL, using the setup in the root README. Restart
the backend after code changes; do not start a second process on port 8080.

```powershell
# From backend/ after stopping the old backend with Ctrl+C:
.\mvnw.cmd -o spring-boot:run

# In another terminal:
Invoke-RestMethod http://localhost:8080/api/businesses
```

For a physical phone, use the laptop's LAN address, not the phone's localhost:
`EXPO_PUBLIC_API_URL=http://<laptop-LAN-IP>:8080`. Ensure
`EXPO_PUBLIC_USE_MOCKS` is not `1` when testing the backend, then restart Expo.
The settings screen displays whether it uses mocks or an API URL.

Browser lab: `http://localhost:8081/bubble-simulation/?view=phone`.
It reads the catalog and logos from the API. Visitor edits, Record kindness,
time advancement, geocoding pin moves, and Reset are local simulations; they
never update MySQL. Reload businesses restores backend values.

Check before accepting the integration:

- Both supplied businesses and images load through the actual API, with
  `lastKindnessAt` and `opacity` present after the backend restart.
- A linked kindness check-in refreshes recency; an ordinary scan does not.
- Repeat scans do not inflate distinct visitors.
- A logo is clipped inside the circle and fades with the bubble exactly once.
- Zooming splits groups; individual radii and population-distance limits stay
  independent from cluster display-size multipliers.
- Missing timestamps, null logos, failed images, and API errors are handled
  without inventing data or silently falling back to fictional businesses.

Automated Java tests and browser simulation checks have passed for the
implemented backend/lab behavior. An actual iPhone/native-map acceptance test
is still required. Do not report the browser phone frame as an iOS test.

## Geocoding Caveat

`GET /api/geocoding/search?q=...` returns candidates for explicit searches.
The public Nominatim provider prohibits autocomplete and bulk lookups; honor
its usage policy and the in-process rate limit/cache. See the root README.
The supplied Alforno test address did not resolve to an exact storefront;
name-only search returned another branch. No Alforno location was hardcoded
to hide that failure. Candidate quality and address-selection UX remain open
work, separate from the bubble API contract.
