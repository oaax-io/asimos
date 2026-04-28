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