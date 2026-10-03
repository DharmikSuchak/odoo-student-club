import { useEffect, useState } from 'react';

import { fetchApiHealth } from '@/lib/api-client';
import type { ApiHealthResponse } from '@/lib/api-client';

type ApiStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; data: ApiHealthResponse }
  | { kind: 'error'; message: string };

export function useApiHealth(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: 'loading' });

    fetchApiHealth()
      .then((data) => {
        if (!cancelled) setStatus({ kind: 'ok', data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          setStatus({ kind: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
