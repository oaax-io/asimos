import { AUDIT_LABEL, TENANT_STATUS_LABEL, fmtDateTime, type PlatformAuditLog } from "@/lib/platform-admin";

function detail(l: PlatformAuditLog) {
  const m = l.metadata ?? {};
  if (typeof m.previous_status === "string" && typeof m.new_status === "string")
    return `${TENANT_STATUS_LABEL[m.previous_status] ?? m.previous_status} → ${TENANT_STATUS_LABEL[m.new_status] ?? m.new_status}`;
  if (Array.isArray(m.changed_fields)) return `Geändert: ${(m.changed_fields as string[]).map((f) => (f === "name" ? "Firmenname" : f)).join(", ")}`;
  return "";
}

export function AuditLogList({ items, hideTenant }: { items: PlatformAuditLog[]; hideTenant?: boolean }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">Noch keine Audit-Aktionen.</div>;
  return (
    <ul className="divide-y">
      {items.map((l) => (
        <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
          <span className="w-32 shrink-0 text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span>
          <span className="w-48 shrink-0 font-medium">{AUDIT_LABEL[l.action] ?? l.action}</span>
          <span className="min-w-0 flex-1 truncate">{detail(l)}</span>
          {!hideTenant && <span className="shrink-0 text-xs text-muted-foreground">{l.target_label}</span>}
          <span className="w-40 shrink-0 truncate text-right text-xs text-muted-foreground">{l.actor_name ?? "–"}</span>
        </li>
      ))}
    </ul>
  );
}
