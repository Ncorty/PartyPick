import { useEffect, useState } from 'react';
import { checkHealth } from './health';

export type ApiHealth = 'loading' | 'online' | 'offline';

export function useApiHealth(): ApiHealth {
  const [status, setStatus] = useState<ApiHealth>('loading');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setStatus('offline');
      controller.abort();
    }, 5000);
    void checkHealth(controller.signal)
      .then(() => {
        if (active && !controller.signal.aborted) setStatus('online');
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setStatus('offline');
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  return status;
}
