// Adds the Android Google Maps key at build time. Expo Go ships its own key, but an installable
// APK needs ours, or Android maps won't load. Store it on Expo as the GOOGLE_MAPS_ANDROID_KEY
// environment variable (eas env:create), never in git.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: { ...config.android?.config, googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } },
  },
});
