/** These are public IDs, not Auth0 client secrets. */
export const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '';
export const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '';
export const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? '';
export const AUTH0_SCHEME = 'kindredlink';
export const AUTH0_SCOPE = 'openid profile email offline_access';
export const AUTH0_CONFIGURED = !!(AUTH0_DOMAIN && AUTH0_CLIENT_ID && AUTH0_AUDIENCE);
