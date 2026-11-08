// Expo loads .env.local into process.env before evaluating this config.
// Auth0 native redirects require its config plugin at build time.
const config = require('./app.json');
const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;

module.exports = {
  ...config.expo,
  plugins: [
    ...config.expo.plugins,
    ...(domain ? [['react-native-auth0', { domain, customScheme: 'kindredlink' }]] : []),
  ],
};
