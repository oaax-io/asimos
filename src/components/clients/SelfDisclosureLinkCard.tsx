import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Copy, RefreshCw, Mail, Send } from "lucide-react";
import { toast } from "sonner";

function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function SelfDisclosureLinkCard({
  clientId,
  clientEmail,
  userId,
}: {
  clientId: string;
  clientEmail?: string | null;
  userId: string;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: links = [] } = useQuery({
    queryKey: ["self_disclosure_links", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_links")
        .select("*")
        .eq("client_id", clientId)
        .eq("link_type", "self_disclosure")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = links.find(
    (l: any) => !l.used_at && new Date(l.expires_at) > new Date(),
  );

  const generate = async () => {
    setBusy(true);
    try {
      const token = generateToken();
      const { error } = await supabase.from("financing_links").insert({
        token,
        client_id: clientId,
        link_type: "self_disclosure",
        created_by: userId,
        dossier_id: null,
      } as any);
      if (error) throw error;

      // Status auf "sent" markieren (nur falls Datensatz existiert)
      await supabase
        .from("client_self_disclosures")
        .update({ status: "sent", sent_at: new Date().toISOString() } as any)
        .eq("client_id", clientId);

      toast.success("Link erstellt");
      qc.invalidateQueries({ queryKey: ["self_disclosure_links", clientId] });
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Erstellen");
    } finally {
      setBusy(false);
    }
  };

  const buildUrl = (token: string) =>
    `${window.location.origin}/selbstauskunft/${token}`;

  const copy = (token: string) => {
    navigator.clipboard.writeText(buildUrl(token));
    toast.success("Link kopiert");
  };

  const mailto = (token: string) => {
    const subject = encodeURIComponent("Ihre Selbstauskunft");
    const body = encodeURIComponent(
      `Guten Tag\n\nbitte füllen Sie Ihre Selbstauskunft über folgenden Link aus:\n\n${buildUrl(
        token,
      )}\n\nFreundliche Grüsse`,
    );
    window.location.href = `mailto:${clientEmail ?? ""}?subject=${subject}&body=${body}`;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">
                Externer Selbstauskunft-Link
              </h3>
              <p className="text-xs text-muted-foreground">
                Senden Sie dem Kunden einen sicheren Link zum Ausfüllen.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {active ? (
              <Button variant="outline" onClick={generate} disabled={busy}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Neu generieren
              </Button>
            ) : (
              <Button onClick={generate} disabled={busy}>
                <Link2 className="mr-1.5 h-4 w-4" />
                Link erstellen
              </Button>
            )}
          </div>
        </div>

        {active ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                {buildUrl(active.token)}
              </code>
              <Button size="icon" variant="outline" onClick={() => copy(active.token)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => mailto(active.token)}
                title="Per E-Mail senden"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Aktiv</Badge>
              <span>
                Gültig bis{" "}
                {new Date(active.expires_at).toLocaleDateString("de-CH")}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Noch kein aktiver Link. Erstellen Sie einen Link, um die
            Selbstauskunft direkt vom Kunden ausfüllen zu lassen.
          </p>
        )}

        {links.filter((l: any) => l.used_at).length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Eingereicht
            </p>
            <div className="space-y-1">
              {links
                .filter((l: any) => l.used_at)
                .slice(0, 3)
                .map((l: any) => (
                  <p key={l.id} className="text-xs text-muted-foreground">
                    Eingereicht am{" "}
                    {new Date(l.used_at).toLocaleDateString("de-CH")}
                  </p>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
