import { useCallback, useEffect, useState } from 'react';

/** Run an async loader on mount (and when deps change); expose data / error / loading / reload. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    run()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [run]);

  useEffect(reload, [reload]);

  return { data, error, loading, reload };
}
