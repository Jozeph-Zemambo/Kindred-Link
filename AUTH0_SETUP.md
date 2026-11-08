# Kindred-Link Auth0 setup (Expo SDK 58 / Spring Boot 4)

This branch replaces spoofable `X-Device-Id` identification with Auth0-issued JWT access tokens. There are no app-managed passwords or client secrets. Existing service/database fields retain their old `*DeviceId` names for compatibility but now store a stable hash of the **verified JWT `sub`** claim. Do not manually send `X-Device-Id` or use an ID token as an API bearer token.

## 1. Configure Auth0 Dashboard

1. Open https://manage.auth0.com/ and select your tenant.
2. **Applications → APIs → Create API**: name `Kindred-Link API`, choose an Identifier such as `https://api.kindredlink.example`, and leave the signing algorithm at **RS256**. Copy the **exact Identifier** for `AUTH0_AUDIENCE` and `EXPO_PUBLIC_AUTH0_AUDIENCE`.
3. **Applications → Applications → Create Application**: type **Native**, name `Kindred-Link`. Copy the **Domain** (hostname without `https://`) and **Client ID**. Never use the Client Secret in the mobile app.
4. In that Native application, set both **Allowed Callback URLs** and **Allowed Logout URLs** to these two URLs (replace `YOUR_DOMAIN`):

   ```text
   kindredlink://YOUR_DOMAIN/ios/ca.kindredlink.app/callback,
   kindredlink://YOUR_DOMAIN/android/ca.kindredlink.app/callback
   ```

   Set **Allowed Web Origins** to your web dev origin if testing in the browser (for example `http://localhost:8081`). For web support, Auth0 may require a **Single Page Application** registration instead of reusing the Native client, with its own client ID and corresponding callback/logout URLs. Do not place a client secret in frontend source.
5. **Authentication → Database**: ensure a database connection (commonly `Username-Password-Authentication`) is enabled for the Native application and sign-ups are allowed.
6. **Authentication → Social**: enable **Google / google-oauth2** and **Facebook / facebook**. Configure each provider's own OAuth credentials in Auth0; enable each connection for the Kindred-Link application. Facebook may require app review for production use. Universal Login will display enabled social buttons; the Profile screen also has direct provider choices.
7. **Applications → Applications → Kindred-Link → Advanced**: enable Authorization Code with PKCE for native clients and refresh token rotation if using persistent sessions; enable offline access on your API if you need `offline_access`/refresh tokens.

**Important:** Auth0 `sub` values for Google, Facebook and database connections are distinct unless you implement Auth0 account linking. The same email does not automatically merge identities.

## 2. Backend environment and run (Windows)

Run a supported MySQL database first (see main README). In **PowerShell**:

```powershell
cd backend
$env:AUTH0_DOMAIN = "dev-YOUR-TENANT.us.auth0.com"
$env:AUTH0_AUDIENCE = "https://api.kindredlink.example"
.\mvnw.cmd spring-boot:run
```

Or in **Command Prompt (CMD)**:

```bat
cd backend
set AUTH0_DOMAIN=dev-YOUR-TENANT.us.auth0.com
set AUTH0_AUDIENCE=https://api.kindredlink.example
mvnw.cmd spring-boot:run
```

The backend refuses to start without domain and audience (fail closed). Spring Security checks token signature against Auth0 JWKS, issuer, audience, expiration, and not-before (when present). There are no hard-coded secrets. Use HTTPS and database migrations in production.

## 3. Frontend environment and run (Windows)

```powershell
cd frontend
Copy-Item .env.example .env.local
# Edit .env.local with your Auth0 domain, Native app Client ID, and the SAME API audience
npm install
```

**Expo Go is NOT supported** for `react-native-auth0` (native module). Use an Expo development build. For example, with Android configured locally:

```powershell
npx expo run:android
npx expo start --dev-client
```

`expo-dev-client` and `react-native-auth0` are installed dependencies. You can also use EAS development builds through Expo. Run the backend on your PC and set `EXPO_PUBLIC_API_URL=http://YOUR-PC-LAN-IP:8080` in `frontend/.env.local` when using a phone. Rebuild after changing the Auth0 Domain, native scheme or app identifiers. Keep `.env.local` out of Git. For real mobile production deployments use HTTPS for API requests.

## 4. How API access works

- **Public**: `GET /api/nodes`, `GET /api/nodes/{id}`, `GET /api/chains/{id}`, `GET /api/chains/{id}/stats`, `GET /api/businesses`, and approved `GET /api/photos/{id}` work anonymously.
- **Authenticated**: `GET /api/me`, `GET /api/nodes?mine=true`, `POST /api/nodes`, `POST /api/nodes/{id}/claim`, `POST /api/nodes/{id}/continue`, `POST /api/businesses/{id}/checkin`, and `POST /api/photos` require a valid access token for the Kindred-Link API.
- **Moderation**: photo approval/rejection still use the server-side secret `X-Admin-Key`, not normal user credentials. Do not expose this key to the app.

Sample request after signing in (use the **access token**, not the ID token):

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN_HERE" http://localhost:8080/api/me
```

Expect an opaque `userId` beginning with `auth0-`; it is derived from a verified `sub`. A missing or invalid token returns 401; another API's token fails the audience check. Existing old `dev-...` nodes do not automatically transfer to Auth0 accounts; plan an explicit, authenticated migration if preserving historic demo data matters.

## 5. Test and integration checklist

Run backend tests:

```powershell
cd backend
.\mvnw.cmd test
```

Run frontend checks after `npm install`:

```powershell
cd frontend
npx tsc --noEmit
```

Verify the flow on a development build: register via email; logout/login; Google login; Facebook login; GET `/api/me`; create a node; restart and verify `mine=true`; claim from a different account; ensure spoofing `X-Device-Id` does not allow anonymous writes. Ensure any photo upload requests use `Authorization: Bearer <access-token>` too.

### Current integration notes

- The entire backend is secured for existing write routes, and the Expo API helper attaches the access token automatically. Photos uploaded by future frontend code must attach the token too.
- No Auth0 tenant Domain/Client ID/API Identifier were in the ZIP. This cannot be end-to-end tested until you enter those real values in Auth0 and `.env.local`/backend environment.
- This package has been statically checked, but Maven/npm dependencies and physical login could not be tested offline.
