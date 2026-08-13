export type PresenceStatus = "available" | "busy" | "away" | "meeting" | "offline";

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

export function presenceMeta(status?: string | null) {
  return PRESENCE_OPTIONS.find((o) => o.value === status) ?? PRESENCE_OPTIONS[0];
}
