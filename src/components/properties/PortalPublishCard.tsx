import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { publishPropertyToPortal } from "@/lib/portal.functions";

export function PortalPublishCard({ property }: { property: any }) {
  const qc = useQueryClient();
  const publish = useServerFn(publishPropertyToPortal);
  const enabled: boolean = !!property.portal_published;

  const toggle = useMutation({
    mutationFn: async (next: boolean) =>
      publish({ data: { propertyId: property.id, unpublish: !next } }),
    onSuccess: (_res, next) => {
      qc.invalidateQueries({ queryKey: ["property", property.id] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success(next ? "Auf ASIMO Portal veröffentlicht" : "Vom ASIMO Portal entfernt");
    },
    onError: (e: any) => toast.error(e?.message ?? "Veröffentlichung fehlgeschlagen"),
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Auf ASIMO Portal veröffentlichen</h3>
              {enabled && <Badge variant="secondary" className="text-[10px]">Veröffentlicht</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Überträgt dieses Objekt auf die öffentliche ASIMO-Website (unabhängig vom Freigabelink).
              Änderungen werden bei veröffentlichten Objekten automatisch synchronisiert.
            </p>
            {enabled && property.portal_published_at && (
              <p className="text-xs text-muted-foreground">
                Zuletzt übertragen: {new Date(property.portal_published_at).toLocaleString("de-CH")}
              </p>
            )}
          </div>
          <Switch
            checked={enabled}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
