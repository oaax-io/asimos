import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useIsMasterDataAdmin } from "@/hooks/useIsMasterDataAdmin";
import { MODULE_REGISTRY } from "@/lib/modules";

export const Route = createFileRoute("/_app/settings/modules")({
  head: () => ({ meta: [{ title: "Module – Einstellungen" }, { name: "description", content: "Freigeschaltete Module ein- und ausschalten." }] }),
  component: ModulesSettings,
});

function ModulesSettings() {
  const qc = useQueryClient();
  const { canEdit } = useIsMasterDataAdmin();
  const q = useQuery({
    queryKey: ["settings-modules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agency_modules").select("id, module, is_entitled, is_enabled");
      if (error) throw error;
      return data ?? [];
    },
  });
  const toggle = async (id: string, v: boolean) => {
    // Serverseitig abgesichert: nur Inhaber/Admin der aktiven Firma, nur is_enabled, nur bei Freischaltung.
    const { error } = await supabase.from("agency_modules").update({ is_enabled: v }).eq("id", id);
    if (error) toast.error("Änderung nicht möglich."); else toast.success(v ? "Modul eingeschaltet" : "Modul ausgeschaltet");
    await Promise.all([qc.invalidateQueries({ queryKey: ["settings-modules"] }), qc.invalidateQueries({ queryKey: ["agency-modules"] })]);
  };
  return (
    <div className="space-y-4">
      <Link to="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" />Einstellungen</Link>
      <div><h1 className="font-display text-2xl font-semibold">Module</h1><p className="text-sm text-muted-foreground">Schalten Sie verfügbare Bereiche für Ihr Unternehmen ein oder aus.</p></div>
      <Card className="divide-y">
        {MODULE_REGISTRY.map((m) => {
          const r = q.data?.find((x) => x.module === m.key);
          const available = !!r?.is_entitled;
          return (
            <div key={m.key} className="flex items-center justify-between gap-4 p-4">
              <div><div className="font-medium">{m.label}</div><div className="text-xs text-muted-foreground">{available ? m.description : "Nicht in Ihrem Paket verfügbar"}</div></div>
              {m.is_core ? <Badge variant="outline">Immer aktiv</Badge> : (
                <Switch checked={available && !!r?.is_enabled} disabled={!available || !canEdit || !r}
                  onCheckedChange={(v) => r && toggle(r.id, v)} aria-label={m.label} />
              )}
            </div>
          );
        })}
      </Card>
      {!canEdit && <p className="text-xs text-muted-foreground">Nur Inhaber und Admins können Module ändern.</p>}
    </div>
  );
}
