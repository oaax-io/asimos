import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Video, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import {
  getLivekitStatus,
  saveLivekitSettings,
  testLivekitConnection,
} from "@/lib/livekit.functions";

export function LivekitSettingsForm() {
  const qc = useQueryClient();
  const status = useServerFn(getLivekitStatus);
  const saveFn = useServerFn(saveLivekitSettings);
  const testFn = useServerFn(testLivekitConnection);

  const { data, isLoading } = useQuery({
    queryKey: ["livekit_status"],
    queryFn: () => status({}),
  });

  const [form, setForm] = useState({
    ws_url: "",
    api_key: "",
    api_secret: "",
    enabled: false,
  });

  useEffect(() => {
    if (!data) return;
    setForm((f) => ({
      ...f,
      ws_url: data.wsUrl ?? "",
      api_key: data.apiKey ?? "",
      enabled: !!data.enabled,
    }));
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Video-Zugangsdaten gespeichert");
      setForm((f) => ({ ...f, api_secret: "" }));
      qc.invalidateQueries({ queryKey: ["livekit_status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });

  const test = useMutation({
    mutationFn: () => testFn({}),
    onSuccess: (res: any) =>
      res?.ok ? toast.success(res.message) : toast.error(res?.message ?? "Fehlgeschlagen"),
    onError: (e: any) => toast.error(e?.message ?? "Test fehlgeschlagen"),
  });

  return (
    <Card className="max-w-3xl">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <Video className="mt-1 h-5 w-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Video-Telefonie (LiveKit)</h2>
            <p className="text-sm text-muted-foreground">
              Zugangsdaten aus der LiveKit Cloud oder dem eigenen Server hinterlegen.
              Danach können Videoanrufe direkt im Chat und bei Terminen gestartet werden.
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Badge variant={data?.configured ? "default" : "outline"}>
              {data?.configured ? "Verbunden" : "Nicht konfiguriert"}
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Server-URL (wss://…)</Label>
          <Input
            placeholder="wss://mein-projekt.livekit.cloud"
            value={form.ws_url}
            onChange={(e) => setForm({ ...form, ws_url: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>API Key</Label>
            <Input
              placeholder="APIxxxxxxxxxxx"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Secret</Label>
            <Input
              type="password"
              placeholder={data?.hasSecret ? "•••••••• (gespeichert)" : "Secret einfügen"}
              value={form.api_secret}
              onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leer lassen, um das gespeicherte Secret beizubehalten.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Video-Telefonie aktiv</p>
            <p className="text-xs text-muted-foreground">
              Schaltet die Anruf-Buttons in Chat und Terminen frei.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => test.mutate()}
            disabled={test.isPending}
          >
            {test.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="mr-2 h-4 w-4" />
            )}
            Verbindung testen
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
