# Installable Android APK

`eas.json` has two build profiles. Both make an APK that installs on any Android phone from a QR
code. The Expo project is `@biggerguy/kindred-link`.

| Profile | Data | Sign-in |
|---|---|---|
| `live` | The shared Render server, `https://kindred-link-1.onrender.com` | Optional Google sign-in through Clerk (app only, see below) |
| `demo` | Built-in demo data (`EXPO_PUBLIC_USE_MOCKS=1`), no server needed | Off |

Use `live` for the real demo. Keep `demo` as the fallback if the server is down.

**Sign-in is app-only.** Signing in shows the person's name in the app, but the server still runs
anonymous: each act belongs to the phone that posted it, and anyone can post without signing in.
The Clerk publishable key in `eas.json` is public by design (it ships inside every app); the Clerk
secret key must never be in the app or in git.

The free Render server sleeps when idle. Open the app a minute or two before demoing so it's awake.

## 1. Google Maps key (one time)

Expo Go brings its own Maps key. An APK needs ours, or the Android maps won't load.

1. Google Cloud console → APIs & Services → **Enable "Maps SDK for Android"**.
2. Credentials → **Create credentials → API key**. Under API restrictions, allow only
   "Maps SDK for Android".
3. Store it on Expo (from `frontend/`), replacing `YOUR_KEY`:

```bash
npx eas-cli env:create --name GOOGLE_MAPS_ANDROID_KEY --value YOUR_KEY --environment preview --visibility sensitive
```

Never put the key in git. `app.config.js` reads it at build time.

## 2. Build

```bash
npx eas-cli build --platform android --profile live
```

(or `--profile demo` for the offline fallback). Takes about 10–20 minutes in Expo's cloud. When it
finishes, the build page on expo.dev shows an **Install** QR code.

## 3. Install

Scan the QR code with the Android phone's camera, download the APK, and allow
"Install unknown apps" for the browser when Android asks.

## Running the live setup in Expo Go

Put the same values in `frontend/.env.local` (gitignored) and restart `npx expo start`:

```dotenv
EXPO_PUBLIC_API_URL=https://kindred-link-1.onrender.com
EXPO_PUBLIC_USE_MOCKS=0
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<the publishable key from eas.json>
```
