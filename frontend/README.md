# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`. Set `EXPO_PUBLIC_API_URL` to the backend's reachable
   address (for a physical device, use your computer's LAN IP instead of `localhost`).

3. Configure the Auth0 Native application:

   - Enable the Google and GitHub social connections and assign them to the application.
   - Configure the GitHub connection to request access to the user's email address.
   - Add these exact URLs to Allowed Callback URLs and Allowed Logout URLs:

     ```text
     kindredlink://dev-axj0j24qp5ihpd8r.us.auth0.com/ios/ca.kindredlink.app/callback
     kindredlink://dev-axj0j24qp5ihpd8r.us.auth0.com/android/ca.kindredlink.app/callback
     ```

4. Create a **Post Login** Action using
   [`backend/auth0/post-login-email-claim.js`](../backend/auth0/post-login-email-claim.js), deploy
   it, and add it to the Login flow. The backend requires this namespaced email claim when it first
   provisions an Auth0 identity.

5. Start a custom development build; Expo Go is not supported by the native Auth0 SDK:

   ```bash
   npx expo run:android
   # or: npx expo run:ios
   ```

After the native build is installed, use `npx expo start --dev-client` for subsequent runs.

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
