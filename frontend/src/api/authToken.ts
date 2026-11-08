/** Access tokens come only from the Auth0 SDK's secure credential manager. */
type TokenProvider = () => Promise<string>;
let tokenProvider: TokenProvider | null = null;

export function setAccessTokenProvider(next: TokenProvider | null): void {
  tokenProvider = next;
}

export function getAccessToken(): Promise<string | null> {
  return tokenProvider ? tokenProvider() : Promise.resolve(null);
}
