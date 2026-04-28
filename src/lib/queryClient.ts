import { QueryClient } from "@tanstack/react-query";
import { isBackendUnavailableError } from "@/lib/backend-errors";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Backend-Unavailable (503, Recovery, Schema-Cache) sind transient:
        // mehrfach mit exponentiellem Backoff retryen, bevor wir den User mit
        // einer Fehlermeldung belasten. Andere Fehler nur einmal.
        retry: (failureCount, error) => {
          if (isBackendUnavailableError(error)) return failureCount < 5;
          return failureCount < 1;
        },
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 2 ** attemptIndex, 8000),
      },
      mutations: {
        retry: false,
      },
    },
  });
}
