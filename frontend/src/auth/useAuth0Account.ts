import { useEffect, useState } from 'react';
import { useAuth0 } from 'react-native-auth0';

import { getCurrentAccount } from '@/api/client';
import type { Account } from '@/api/types';

export type SocialConnection = 'google-oauth2' | 'github';

const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE!;
const customScheme = 'kindredlink';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected authentication error occurred.';
}

export function useAuth0Account() {
  const { authorize, clearSession, getCredentials, isLoading, user } = useAuth0();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConnection, setActiveConnection] = useState<SocialConnection | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setAccount(null);
      return;
    }

    async function loadAccount() {
      setAccountLoading(true);
      setError(null);
      try {
        const credentials = await getCredentials('openid profile email', 0, { audience });
        const currentAccount = await getCurrentAccount(credentials.accessToken);
        if (active) setAccount(currentAccount);
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setAccountLoading(false);
      }
    }

    void loadAccount();
    return () => {
      active = false;
    };
  }, [getCredentials, user]);

  async function login(connection: SocialConnection) {
    setActiveConnection(connection);
    setError(null);
    try {
      await authorize(
        { audience, scope: 'openid profile email', connection },
        { customScheme },
      );
    } catch (loginError) {
      setError(errorMessage(loginError));
    } finally {
      setActiveConnection(null);
    }
  }

  async function logout() {
    setError(null);
    try {
      await clearSession({}, { customScheme });
      setAccount(null);
    } catch (logoutError) {
      setError(errorMessage(logoutError));
    }
  }

  return { account, accountLoading, activeConnection, error, isLoading, login, logout, user };
}
