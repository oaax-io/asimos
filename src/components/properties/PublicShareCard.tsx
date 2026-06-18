import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Copy, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";

export function PublicShareCard({ property }: { property: any }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const enabled: boolean = !!property.public_enabled;
  const token: string | null = property.public_token ?? null;
  const url = token ? `${window.location.origin}/p/${token}` : null;

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { data, error } = await (supabase.rpc as any)("property_set_public", {
        _id: property.id, _enabled: next,
      });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property", property.id] });
      toast.success("Aktualisiert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Link kopiert");
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="font-display text-base font-semibold">Öffentlicher Link</h3>
              {enabled && <Badge variant="secondary" className="text-[10px]">Aktiv</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Teile dieses Objekt mit Interessenten via öffentlichem Link – Details, Fotos, Makrolage, Marktanalyse und Einheiten sind ohne Login einsehbar.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </div>

        {enabled && url && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyUrl} title="Link kopieren">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" asChild title="Öffnen">
                <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Eigentümer-Daten, interne Notizen und Mandatsinfos werden nicht geteilt.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
