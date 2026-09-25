import { ACTIVITY_LABEL, fmtDateTime, type PlatformActivity } from "@/lib/platform-admin";

export function ActivityList({ items, hideTenant }: { items: PlatformActivity[]; hideTenant?: boolean }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">Keine Aktivitäten.</div>;
  return (
    <ul className="divide-y">
      {items.map((e, i) => (
        <li key={i} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-32 shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.at)}</span>
          <span className="w-44 shrink-0 font-medium">{ACTIVITY_LABEL[e.kind] ?? e.kind}</span>
          <span className="min-w-0 flex-1 truncate">{e.label}</span>
          {!hideTenant && <span className="shrink-0 text-xs text-muted-foreground">{e.agency_name}</span>}
        </li>
      ))}
    </ul>
  );
}
