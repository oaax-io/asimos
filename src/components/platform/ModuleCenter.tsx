import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { QueryState } from "@/components/platform/PlatformLayout";
import { usePlatformModules, usePlatformTenants, setModuleEntitlement, type PlatformModule } from "@/lib/platform-admin";
import { MODULE_REGISTRY, MODULE_BY_KEY, moduleState, MODULE_STATE_LABEL, type ModuleState } from "@/lib/modules";

const DOT: Record<ModuleState, string> = { active: "bg-primary", entitled: "bg-primary/30", locked: "bg-muted-foreground/20" };

function StateBadge({ s }: { s: ModuleState }) {
  return <Badge variant={s === "active" ? "default" : s === "entitled" ? "secondary" : "outline"}>{MODULE_STATE_LABEL[s]}</Badge>;
}

function index(rows: PlatformModule[]) {
  const m = new Map<string, PlatformModule>();
  rows.forEach((r) => m.set(r.agency_id + ":" + r.module, r));
  return m;
}

/** /platform/modules – Übersicht und Matrix (nur Ansicht). */
export function ModuleMatrix() {
  const mods = usePlatformModules();
  const tenants = usePlatformTenants();
  const rows = mods.data ?? [];
  const idx = index(rows);
  const ts = tenants.data ?? [];
  const states = ts.flatMap((t) => MODULE_REGISTRY.map((m) => moduleState(idx.get(t.id + ":" + m.key))));
  const stats = [
    ["Unternehmen", ts.length], ["Module", MODULE_REGISTRY.length],
    ["Freigeschaltete Module", states.filter((s) => s !== "locked").length],
    ["Aktive Module", states.filter((s) => s === "active").length], ["Gesperrte Module", states.filter((s) => s === "locked").length],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([k, v]) => <Card key={k}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-semibold">{v}</div></CardContent></Card>)}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(Object.keys(DOT) as ModuleState[]).map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${DOT[s]}`} />{MODULE_STATE_LABEL[s]}</span>)}
      </div>
      <QueryState isLoading={mods.isLoading || tenants.isLoading} error={mods.error ?? tenants.error} />
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="sticky left-0 bg-card">Unternehmen</TableHead>
            {MODULE_REGISTRY.map((m) => <TableHead key={m.key} className="whitespace-nowrap text-center text-xs">{m.label}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {ts.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="sticky left-0 bg-card font-medium">{t.name}</TableCell>
                {MODULE_REGISTRY.map((m) => {
                  const s = moduleState(idx.get(t.id + ":" + m.key));
                  return <TableCell key={m.key} className="text-center"><span title={MODULE_STATE_LABEL[s]} className={`inline-block h-3 w-3 rounded-full ${DOT[s]}`} /></TableCell>;
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">Freischaltung ändern Sie im jeweiligen Unternehmen unter «Module».</p>
    </div>
  );
}

/** Tenant-Detail: Modulverwaltung. Plattform steuert nur die Freischaltung. */
export function TenantModules({ agencyId }: { agencyId: string }) {
  const q = usePlatformModules(agencyId);
  const qc = useQueryClient();
  const idx = index(q.data ?? []);
  const [confirm, setConfirm] = useState<{ key: string; entitled: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (key: string, entitled: boolean) => {
    setBusy(true);
    try {
      await setModuleEntitlement(agencyId, key, entitled);
      toast.success(entitled ? "Modul freigeschaltet" : "Modul gesperrt");
      await qc.invalidateQueries({ queryKey: ["platform"] });
    } catch (e) {
      const m = (e as { message?: string }).message;
      toast.error(m === "core_module" ? "Kernmodule können nicht gesperrt werden." : "Aktion fehlgeschlagen.");
    } finally { setBusy(false); }
  };
  const c = confirm ? MODULE_BY_KEY[confirm.key] : null;
  return (
    <Card>
      <QueryState isLoading={q.isLoading} error={q.error} />
      <Table>
        <TableHeader><TableRow>
          <TableHead>Modul</TableHead><TableHead>Kategorie</TableHead><TableHead>Freigeschaltet durch Immolia</TableHead>
          <TableHead>Vom Unternehmen aktiviert</TableHead><TableHead>Effektiver Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {MODULE_REGISTRY.map((m) => {
            const r = idx.get(agencyId + ":" + m.key);
            const s = moduleState(r);
            return (
              <TableRow key={m.key}>
                <TableCell><div className="font-medium">{m.label}</div><div className="text-xs text-muted-foreground">{m.description}</div></TableCell>
                <TableCell className="text-sm">{m.category}</TableCell>
                <TableCell>
                  {m.is_core ? <Badge variant="outline">Kernmodul</Badge> : (
                    <Switch checked={!!r?.is_entitled} disabled={busy || q.isLoading}
                      onCheckedChange={(v) => setConfirm({ key: m.key, entitled: v })} aria-label={`${m.label} freischalten`} />
                  )}
                </TableCell>
                <TableCell className="text-sm">{r?.is_entitled ? (r.is_enabled ? "Ja" : "Nein") : "–"}</TableCell>
                <TableCell><StateBadge s={s} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="p-4 text-xs text-muted-foreground">Immolia steuert die Freischaltung. Ein- und Ausschalten freigeschalteter Module erfolgt durch Inhaber/Admin des Unternehmens. Neu freigeschaltete Module bleiben ausgeschaltet, bis das Unternehmen sie aktiviert.</div>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.entitled ? `«${c?.label}» freischalten?` : `«${c?.label}» sperren?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.entitled
                ? "Das Unternehmen kann das Modul danach selbst einschalten."
                : "Das Modul ist danach für das Unternehmen nicht mehr nutzbar. Vorhandene Daten bleiben erhalten und sind nach erneuter Freischaltung wieder verfügbar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const x = confirm; setConfirm(null); if (x) run(x.key, x.entitled); }}>Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
