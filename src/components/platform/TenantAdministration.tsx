import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { STATUS_TRANSITIONS, setTenantStatus, updateTenantName, type PlatformTenant } from "@/lib/platform-admin";

type S = "active" | "suspended" | "archived";
const ACTION: Record<S, { button: string; title: string; text: string }> = {
  suspended: { button: "Sperren", title: "Unternehmen sperren?", text: "Benutzer dieses Unternehmens können Immolia nicht mehr verwenden. Daten bleiben vollständig erhalten." },
  archived: { button: "Archivieren", title: "Unternehmen archivieren?", text: "Das Unternehmen und seine Daten bleiben erhalten, der Zugriff wird jedoch deaktiviert." },
  active: { button: "Reaktivieren", title: "Unternehmen reaktivieren?", text: "Benutzer dieses Unternehmens können Immolia wieder wie gewohnt verwenden." },
};

export function TenantAdministration({ tenant }: { tenant: PlatformTenant }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<S | null>(null);
  const [name, setName] = useState(tenant.name);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["platform"] });

  async function applyStatus() {
    if (!target) return;
    setBusy(true);
    try { await setTenantStatus(tenant.id, target); toast.success("Status geändert."); await refresh(); }
    catch { toast.error("Aktion konnte nicht ausgeführt werden."); }
    finally { setBusy(false); setTarget(null); }
  }
  async function saveName() {
    const n = name.trim();
    if (!n || n.length > 120) { toast.error("Bitte einen gültigen Firmennamen (max. 120 Zeichen) eingeben."); return; }
    setBusy(true);
    try { await updateTenantName(tenant.id, n); toast.success("Firmenname gespeichert."); await refresh(); }
    catch { toast.error("Aktion konnte nicht ausgeführt werden."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold">Unternehmensverwaltung</h3>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Firmenname</div>
        <div className="flex max-w-lg gap-2">
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button variant="outline" disabled={busy || name.trim() === tenant.name} onClick={saveName}>Speichern</Button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Status ändern</div>
        <div className="flex flex-wrap gap-2">
          {STATUS_TRANSITIONS[tenant.status].map((s) => (
            <Button key={s} variant={s === "active" ? "default" : "outline"} disabled={busy} onClick={() => setTarget(s)}>{ACTION[s].button}</Button>
          ))}
        </div>
      </div>
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target && ACTION[target].title}</AlertDialogTitle>
            <AlertDialogDescription>{target && ACTION[target].text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); applyStatus(); }}>{target && ACTION[target].button}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
