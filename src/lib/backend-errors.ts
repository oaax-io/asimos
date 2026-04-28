const BACKEND_UNAVAILABLE_PATTERNS = [
  "could not query the database for the schema cache",
  "database client error",
  "database connection error",
  "no connection to the server",
  "the database system is not accepting connections",
  "the database system is in recovery mode",
  "backend aktuell nicht erreichbar",
  "pgrst000",
  "pgrst001",
  "pgrst002",
];

export function isBackendUnavailableError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error && typeof error.message === "string"
          ? error.message
          : "";

  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : null;

  const normalizedMessage = message.toLowerCase();

  return status === 503 || BACKEND_UNAVAILABLE_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
}

export function getBackendErrorMessage(error: unknown) {
  if (isBackendUnavailableError(error)) {
    return "Backend aktuell nicht erreichbar. Bitte in wenigen Sekunden erneut versuchen.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Es ist ein unerwarteter Fehler aufgetreten.";
}

/**
 * Custom Error-Klasse, die als "Backend Unavailable" erkannt wird.
 * Wird von isBackendUnavailableError() automatisch erkannt -> globaler Retry greift.
 */
export class BackendUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Backend aktuell nicht erreichbar. Bitte in wenigen Sekunden erneut versuchen.");
    this.name = "BackendUnavailableError";
  }
}

/**
 * Wirft den Supabase-Fehler so, dass der globale QueryClient-Retry
 * Backend-Unavailable-Fehler erkennen und mit Backoff erneut versuchen kann.
 *
 * Verwende dies in jedem `useQuery({ queryFn })`, das direkt mit Supabase spricht:
 *
 *   const { data, error } = await supabase.from("xyz").select("*");
 *   throwIfError(error);
 *   return data ?? [];
 */
export function throwIfError(error: unknown): void {
  if (!error) return;
  if (isBackendUnavailableError(error)) {
    throw new BackendUnavailableError(getBackendErrorMessage(error));
  }
  throw error;
}

/**
 * Konvertiert ein ServerResult ({ data, error, unavailable }) in entweder
 * geworfenen Fehler oder die enthaltenen Daten. Damit funktionieren die
 * automatischen Retries der `useQuery`-Aufrufe von `createServerFn`-Resultaten.
 *
 * Verwendung:
 *   const result = await getLeads({ headers: ... });
 *   return unwrapServerResult(result); // wirft bei unavailable, sonst data
 */
export function unwrapServerResult<T>(result: {
  data: T;
  error: string | null;
  unavailable: boolean;
}): T {
  if (result.unavailable) {
    throw new BackendUnavailableError(result.error ?? undefined);
  }
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data;
}
