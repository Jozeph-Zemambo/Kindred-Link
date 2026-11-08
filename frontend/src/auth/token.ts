type ClerkTokenProvider = () => Promise<string | null>;

let tokenProvider: ClerkTokenProvider | null = null;

export function setClerkTokenProvider(provider: ClerkTokenProvider | null): void {
  tokenProvider = provider;
}

export async function getClerkSessionToken(): Promise<string | null> {
  return tokenProvider ? tokenProvider() : null;
}
