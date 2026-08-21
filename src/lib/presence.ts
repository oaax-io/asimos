export type PresenceStatus = "available" | "busy" | "away" | "meeting" | "offline";

/** Ohne Heartbeat innerhalb dieser Zeit gilt ein User als offline. */
export const PRESENCE_STALE_MS = 2 * 60 * 1000;
/** Intervall, in dem der eigene Heartbeat geschrieben wird. */
export const PRESENCE_HEARTBEAT_MS = 45 * 1000;

export const PRESENCE_OPTIONS: {
  value: PresenceStatus;
  label: string;
  dot: string;
  text: string;
  bg: string;
}[] = [
  { value: "available", label: "Verfügbar", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-100" },
  { value: "busy", label: "Beschäftigt", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-100" },
  { value: "meeting", label: "Im Termin", dot: "bg-violet-500", text: "text-violet-700", bg: "bg-violet-100" },
  { value: "away", label: "Abwesend", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-100" },
  { value: "offline", label: "Offline", dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-100" },
];

/**
 * Effektiver Status: veraltete Heartbeats (User hat App geschlossen)
 * werden als "offline" dargestellt, egal was in der DB steht.
 */
export function effectivePresence(
  status?: string | null,
  updatedAt?: string | null,
): PresenceStatus {
  if (!status) return "offline";
  if (status === "offline") return "offline";
  if (!updatedAt) return "offline";
  const ts = new Date(updatedAt).getTime();
  if (!Number.isFinite(ts) || Date.now() - ts > PRESENCE_STALE_MS) return "offline";
  return status as PresenceStatus;
}

export function presenceMeta(status?: string | null) {
  return PRESENCE_OPTIONS.find((o) => o.value === status) ?? PRESENCE_OPTIONS[4];
}
