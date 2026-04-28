import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mail, Phone, Trash2, Copy, RefreshCw, Pencil, Link2, FileSignature } from "lucide-react";
import { clientTypeLabels, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/clients/$id")({ component: ClientDetail });

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: dossier } = useQuery({
    queryKey: ["financing_dossier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers")
        .select("*")
        .eq("client_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["financing_links", dossier?.id],
    enabled: !!dossier?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_links")
        .select("*")
        .eq("dossier_id", dossier!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gelöscht"); navigate({ to: "/clients" }); },
  });

  if (isLoading || !client) return <div className="text-sm text-muted-foreground">Lädt…</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" asChild><Link to="/clients"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link></Button>
        <Button variant="outline" size="icon" onClick={() => { if (confirm("Wirklich löschen?")) del.mutate(); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-6">
        <Badge variant="secondary">{clientTypeLabels[client.client_type as keyof typeof clientTypeLabels]}</Badge>
        <h1 className="mt-2 font-display text-3xl font-bold">{client.full_name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {client.email && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{client.email}</span>}
          {client.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{client.phone}</span>}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="financing">
            <FileSignature className="mr-1.5 h-4 w-4" />
            Finanzierung
            {dossier && <Badge variant="secondary" className="ml-2">{dossier.completion_percent}%</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card><CardContent className="p-6 space-y-4">
            {client.notes && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Notizen</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{client.notes}</p>
              </div>
            )}
            {(client.budget_max || client.preferred_cities?.length) && (
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-4">
                {client.budget_min || client.budget_max ? (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Budget</p>
                    <p className="mt-1 text-sm font-medium">
                      {client.budget_min ? formatCurrency(Number(client.budget_min)) : "—"} – {client.budget_max ? formatCurrency(Number(client.budget_max)) : "—"}
                    </p>
                  </div>
                ) : null}
                {client.preferred_cities?.length ? (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Städte</p>
                    <p className="mt-1 text-sm font-medium">{client.preferred_cities.join(", ")}</p>
                  </div>
                ) : null}
                {client.rooms_min ? (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Zimmer ab</p>
                    <p className="mt-1 text-sm font-medium">{client.rooms_min}</p>
                  </div>
                ) : null}
                {client.area_min ? (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Fläche ab</p>
                    <p className="mt-1 text-sm font-medium">{client.area_min} m²</p>
                  </div>
                ) : null}
              </div>
            )}
            {!client.notes && !client.budget_max && !client.preferred_cities?.length && (
              <p className="text-sm text-muted-foreground">Keine zusätzlichen Angaben.</p>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="financing" className="mt-6">
          <FinancingTab
            clientId={id}
            agencyId={client.agency_id}
            userId={user!.id}
            dossier={dossier}
            links={links}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["financing_dossier", id] });
              qc.invalidateQueries({ queryKey: ["financing_links"] });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function FinancingTab({
  clientId, agencyId, userId, dossier, links, onChange,
}: {
  clientId: string;
  agencyId: string;
  userId: string;
  dossier: any;
  links: any[];
  onChange: () => void;
}) {
  const [generating, setGenerating] = useState(false);

  const ensureDossier = async (): Promise<string> => {
    if (dossier?.id) return dossier.id;
    const { data, error } = await supabase
      .from("financing_dossiers")
      .insert({ client_id: clientId, agency_id: agencyId })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    try {
      const dossierId = await ensureDossier();
      const token = generateToken();
      const { error } = await supabase.from("financing_links").insert({
        dossier_id: dossierId,
        agency_id: agencyId,
        token,
        created_by: userId,
      });
      if (error) throw error;
      toast.success("Link generiert");
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelfFill = async () => {
    try {
      await ensureDossier();
      onChange();
      toast.info("Bearbeitung folgt in Schritt 2");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/finanzierung/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link kopiert");
  };

  const activeLink = links.find(l => !l.used_at && new Date(l.expires_at) > new Date());

  // Kein Dossier vorhanden
  if (!dossier) {
    return (
      <Card><CardContent className="p-8 text-center">
        <FileSignature className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-display text-lg font-semibold">Noch keine Finanzierungsangaben</h3>
        <p className="mt-1 text-sm text-muted-foreground">Wie möchtest du starten?</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={handleSelfFill}>
            <Pencil className="mr-1.5 h-4 w-4" />Selbst ausfüllen
          </Button>
          <Button variant="outline" onClick={handleGenerateLink} disabled={generating}>
            <Link2 className="mr-1.5 h-4 w-4" />Link für Kunden generieren
          </Button>
        </div>
      </CardContent></Card>
    );
  }

  const isComplete = dossier.completion_percent >= 100;
  const submittedDate = dossier.submitted_at ? new Date(dossier.submitted_at).toLocaleDateString("de-DE") : null;

  return (
    <div className="space-y-6">
      <Card><CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className={isComplete ? "bg-emerald-600 hover:bg-emerald-600" : "bg-orange-500 hover:bg-orange-500"}>
                {isComplete ? "Vollständig" : "Unvollständig"}
              </Badge>
              <Badge variant="outline">
                {dossier.status === "draft" ? "Entwurf" : dossier.status === "submitted" ? "Eingereicht" : "Geprüft"}
              </Badge>
            </div>
            {submittedDate && (
              <p className="mt-2 text-sm text-muted-foreground">Ausgefüllt am {submittedDate}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSelfFill}>
              <Pencil className="mr-1.5 h-4 w-4" />Bearbeiten
            </Button>
            <Button variant="outline" onClick={handleGenerateLink} disabled={generating}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Neu generieren (Link)
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vollständigkeit</span>
            <span className="font-medium">{dossier.completion_percent}%</span>
          </div>
          <Progress value={dossier.completion_percent} />
        </div>
      </CardContent></Card>

      {activeLink && (
        <Card><CardContent className="p-6">
          <p className="text-xs uppercase text-muted-foreground">Aktiver Kundenlink</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 text-xs">
              {window.location.origin}/finanzierung/{activeLink.token}
            </code>
            <Button size="icon" variant="outline" onClick={() => copyLink(activeLink.token)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Gültig bis {new Date(activeLink.expires_at).toLocaleDateString("de-DE")}
          </p>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-6">
        <p className="text-sm text-muted-foreground">
          Die ausgefüllten Sektionen werden hier in Leseansicht angezeigt — folgt in Schritt 2.
        </p>
      </CardContent></Card>
    </div>
  );
}
