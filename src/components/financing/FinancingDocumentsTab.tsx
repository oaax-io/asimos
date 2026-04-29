import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, ExternalLink, FileBadge } from "lucide-react";

type Props = { dossierId: string; clientId?: string | null; propertyId?: string | null };

export function FinancingDocumentsTab({ dossierId, clientId, propertyId }: Props) {
  const docsQuery = useQuery({
    queryKey: ["financing_documents", dossierId, clientId, propertyId],
    queryFn: async () => {
      const orParts: string[] = [`and(related_type.eq.financing,related_id.eq.${dossierId})`];
      if (clientId) orParts.push(`and(related_type.eq.client,related_id.eq.${clientId})`);
      if (propertyId) orParts.push(`and(related_type.eq.property,related_id.eq.${propertyId})`);
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .or(orParts.join(","))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const generatedQuery = useQuery({
    queryKey: ["financing_generated", dossierId, clientId, propertyId],
    queryFn: async () => {
      const orParts: string[] = [`and(related_type.eq.financing,related_id.eq.${dossierId})`];
      if (clientId) orParts.push(`and(related_type.eq.client,related_id.eq.${clientId})`);
      if (propertyId) orParts.push(`and(related_type.eq.property,related_id.eq.${propertyId})`);
      const { data, error } = await supabase
        .from("generated_documents")
        .select("*")
        .or(orParts.join(","))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const docs = docsQuery.data ?? [];
  const generated = generatedQuery.data ?? [];

  const groups = useMemo(() => ({
    client: docs.filter((d: any) => d.related_type === "client"),
    property: docs.filter((d: any) => d.related_type === "property"),
    financing: docs.filter((d: any) => d.related_type === "financing"),
  }), [docs]);

  const [tab, setTab] = useState("all");

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Alle ({docs.length + generated.length})</TabsTrigger>
          <TabsTrigger value="client">Kunde ({groups.client.length})</TabsTrigger>
          <TabsTrigger value="property">Objekt ({groups.property.length})</TabsTrigger>
          <TabsTrigger value="financing">Finanzierung ({groups.financing.length})</TabsTrigger>
          <TabsTrigger value="generated">Generiert ({generated.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all"><DocList items={[...docs, ...generated.map((g: any) => ({ ...g, _generated: true }))]} /></TabsContent>
        <TabsContent value="client"><DocList items={groups.client} /></TabsContent>
        <TabsContent value="property"><DocList items={groups.property} /></TabsContent>
        <TabsContent value="financing"><DocList items={groups.financing} /></TabsContent>
        <TabsContent value="generated"><DocList items={generated.map((g: any) => ({ ...g, _generated: true }))} /></TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Dokumente werden über Kunden, Immobilie und Finanzierung verknüpft. Hochladen direkt im jeweiligen Modul.
      </p>
    </div>
  );
}

function DocList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Keine Dokumente vorhanden.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((d) => {
        const url = d.file_url || d.esign_url;
        const name = d.file_name || d.title || "Dokument";
        const type = d._generated ? "generiert" : (d.document_type || d.related_type || "");
        return (
          <Card key={d.id}>
            <CardContent className="flex items-center gap-3 p-3">
              {d._generated ? <FileBadge className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {type && <Badge variant="secondary" className="text-[10px]">{type}</Badge>}
                  {d.related_type && <span>{d.related_type}</span>}
                </div>
              </div>
              {url && (
                <a href={url} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                </a>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
