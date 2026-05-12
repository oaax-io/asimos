import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Role = "owner" | "admin" | "manager" | "agent" | "assistant" | "employee";

const ROLE_COLUMNS: { key: Role; label: string }[] = [
  { key: "owner", label: "Inhaber" },
  { key: "admin", label: "Administrator" },
  { key: "manager", label: "Manager" },
  { key: "agent", label: "Makler" },
  { key: "assistant", label: "Assistenz" },
];

const MODULE_GROUPS: { label: string; modules: { key: string; label: string }[] }[] = [
  {
    label: "Vertrieb",
    modules: [
      { key: "dashboard", label: "Dashboard" },
      { key: "leads", label: "Leads" },
      { key: "clients", label: "Kunden" },
      { key: "properties", label: "Immobilien" },
      { key: "matching", label: "Matching" },
      { key: "financing", label: "Finanzierungen" },
      { key: "appointments", label: "Termine" },
      { key: "tasks", label: "Aufgaben" },
      { key: "analytics", label: "Analytics" },
    ],
  },
  {
    label: "Verwaltung",
    modules: [
      { key: "documents", label: "Dokumente" },
      { key: "media", label: "Mediathek" },
      { key: "checklists", label: "Checklisten" },
      { key: "mandates", label: "Mandate" },
      { key: "reservations", label: "Reservationen" },
      { key: "ndas", label: "NDAs" },
      { key: "exposes", label: "Exposés" },
    ],
  },
  {
    label: "Administration",
    modules: [
      { key: "employees", label: "Mitarbeiter" },
      { key: "feedback", label: "Feedback" },
      { key: "docs", label: "Dokumentation" },
      { key: "company_settings", label: "Einstellungen" },
    ],
  },
];

const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

type PermRow = {
  role: Role;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit_own: boolean;
  can_edit_all: boolean;
  can_delete: boolean;
};

export function RolePermissionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["module-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_permissions")
        .select("role, module, can_view, can_create, can_edit_own, can_edit_all, can_delete");
      if (error) throw error;
      return (data ?? []) as PermRow[];
    },
    enabled: open,
  });

  const map = useMemo(() => {
    const m = new Map<string, PermRow>();
    (data ?? []).forEach((r) => m.set(`${r.role}:${r.module}`, r));
    return m;
  }, [data]);

  const isEnabled = (role: Role, module: string) => {
    // Owner & Admin haben immer Zugriff (außer explizit deaktiviert)
    const row = map.get(`${role}:${module}`);
    if (row) return row.can_view;
    if (role === "owner" || role === "admin") return true;
    return false;
  };

  const toggle = useMutation({
    mutationFn: async ({ role, module, value }: { role: Role; module: string; value: boolean }) => {
      const existing = map.get(`${role}:${module}`);
      const payload = {
        role,
        module,
        can_view: value,
        can_create: existing?.can_create ?? value,
        can_edit_own: existing?.can_edit_own ?? value,
        can_edit_all: existing?.can_edit_all ?? false,
        can_delete: existing?.can_delete ?? false,
      };
      const { error } = await supabase
        .from("module_permissions")
        .upsert(payload, { onConflict: "module,role" });
      if (error) throw error;
    },
    onMutate: ({ role, module }) => {
      setPending((p) => ({ ...p, [`${role}:${module}`]: true }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["module-permissions"] }),
    onError: (e: Error) => toast.error(e.message),
    onSettled: (_d, _e, { role, module }) => {
      setPending((p) => {
        const next = { ...p };
        delete next[`${role}:${module}`];
        return next;
      });
    },
  });

  const setAllForRole = useMutation({
    mutationFn: async ({ role, value }: { role: Role; value: boolean }) => {
      const rows = ALL_MODULES.map((module) => {
        const existing = map.get(`${role}:${module}`);
        return {
          role,
          module,
          can_view: value,
          can_create: existing?.can_create ?? value,
          can_edit_own: existing?.can_edit_own ?? value,
          can_edit_all: existing?.can_edit_all ?? false,
          can_delete: existing?.can_delete ?? false,
        };
      });
      const { error } = await supabase
        .from("module_permissions")
        .upsert(rows, { onConflict: "module,role" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module-permissions"] });
      toast.success("Aktualisiert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Rollen & Modul-Berechtigungen
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Aktiviere oder deaktiviere einzelne Module pro Rolle. Inhaber und Administrator haben standardmäßig Zugriff auf alles.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Modul</th>
                    {ROLE_COLUMNS.map((r) => (
                      <th key={r.key} className="px-3 py-3 text-center font-medium">
                        <div>{r.label}</div>
                        <button
                          className="mt-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                          onClick={() => setAllForRole.mutate({ role: r.key, value: true })}
                          disabled={setAllForRole.isPending}
                        >
                          alle an
                        </button>
                        <span className="mx-1 text-[10px] text-muted-foreground">·</span>
                        <button
                          className="text-[10px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                          onClick={() => setAllForRole.mutate({ role: r.key, value: false })}
                          disabled={setAllForRole.isPending}
                        >
                          alle aus
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULE_GROUPS.map((group) => (
                    <Fragment key={`grp-${group.label}`}>
                      <tr className="bg-muted/20">
                        <td colSpan={1 + ROLE_COLUMNS.length} className="px-4 py-2">
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                            {group.label}
                          </Badge>
                        </td>
                      </tr>
                      {group.modules.map((mod) => (
                        <tr key={mod.key} className="border-t">
                          <td className="px-4 py-3 font-medium">{mod.label}</td>
                          {ROLE_COLUMNS.map((r) => {
                            const key = `${r.key}:${mod.key}`;
                            const enabled = isEnabled(r.key, mod.key);
                            return (
                              <td key={r.key} className="px-3 py-3 text-center">
                                <Switch
                                  checked={enabled}
                                  disabled={pending[key]}
                                  onCheckedChange={(v) =>
                                    toggle.mutate({ role: r.key, module: mod.key, value: v })
                                  }
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Hinweis: Detaillierte Rechte (Erstellen, Bearbeiten, Löschen) werden automatisch mitgesetzt, wenn ein Modul aktiviert ist.
              Über die Datenbankrichtlinien (RLS) bleibt der Datenzugriff auch dann geschützt.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
