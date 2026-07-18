import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, ExternalLink, FileBadge, Files, User, Building2, Banknote, Sparkles, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { dossierId: string; clientId?: string | null; propertyId?: string | null };

type PreviewDoc = {
  name: string;
  url?: string | null;
  html?: string | null;
  mime?: string | null;
};

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
  const [preview, setPreview] = useState<PreviewDoc | null>(null);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex justify-start gap-0 bg-transparent border-b border-border rounded-none p-0 h-auto">
          <SubTabTrigger value="all" active={tab === "all"} icon={<Files className="h-4 w-4" />} count={docs.length + generated.length}>
            Alle
          </SubTabTrigger>
          <SubTabTrigger value="client" active={tab === "client"} icon={<User className="h-4 w-4" />} count={groups.client.length}>
            Kunde
          </SubTabTrigger>
          <SubTabTrigger value="property" active={tab === "property"} icon={<Building2 className="h-4 w-4" />} count={groups.property.length}>
            Objekt
          </SubTabTrigger>
          <SubTabTrigger value="financing" active={tab === "financing"} icon={<Banknote className="h-4 w-4" />} count={groups.financing.length}>
            Finanzierung
          </SubTabTrigger>
          <SubTabTrigger value="generated" active={tab === "generated"} icon={<Sparkles className="h-4 w-4" />} count={generated.length}>
            Generiert
          </SubTabTrigger>
        </TabsList>

        <TabsContent value="all"><DocList items={[...docs, ...generated.map((g: any) => ({ ...g, _generated: true }))]} onPreview={setPreview} /></TabsContent>
        <TabsContent value="client"><DocList items={groups.client} onPreview={setPreview} /></TabsContent>
        <TabsContent value="property"><DocList items={groups.property} onPreview={setPreview} /></TabsContent>
        <TabsContent value="financing"><DocList items={groups.financing} onPreview={setPreview} /></TabsContent>
        <TabsContent value="generated"><DocList items={generated.map((g: any) => ({ ...g, _generated: true }))} onPreview={setPreview} /></TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Dokumente werden über Kunden, Immobilie und Finanzierung verknüpft. Hochladen direkt im jeweiligen Modul.
      </p>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.name ?? "Vorschau"}</DialogTitle>
          </DialogHeader>
          {preview?.html ? (
            <iframe title="Vorschau" srcDoc={preview.html} className="h-[75vh] w-full rounded-md border bg-white" />
          ) : preview?.url ? (
            isImage(preview.url, preview.mime) ? (
              <div className="flex h-[75vh] w-full items-center justify-center rounded-md border bg-muted/40">
                <img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <iframe title="Vorschau" src={preview.url} className="h-[75vh] w-full rounded-md border bg-white" />
            )
          ) : (
            <div className="flex h-[75vh] items-center justify-center text-sm text-muted-foreground">
              Keine Vorschau verfügbar.
            </div>
          )}
          {preview?.url && (
            <div className="flex justify-end">
              <a href={preview.url} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-2" />In neuem Tab öffnen</Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isImage(url: string, mime?: string | null) {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(url);
}

function DocList({ items, onPreview }: { items: any[]; onPreview: (d: PreviewDoc) => void }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Keine Dokumente vorhanden.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((d) => {
        const url = d.file_url || d.esign_url || null;
        const name = d.file_name || d.title || "Dokument";
        const type = d._generated ? "generiert" : (d.document_type || d.related_type || "");
        const html = d._generated ? (d.html_content ?? null) : null;
        const handleOpen = () => onPreview({ name, url, html, mime: d.mime_type ?? null });
        return (
          <Card
            key={d.id}
            onClick={handleOpen}
            className="cursor-pointer transition-colors hover:bg-muted/50"
          >
            <CardContent className="flex items-center gap-3 p-3">
              {d._generated ? <FileBadge className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {type && <Badge variant="secondary" className="text-[10px]">{type}</Badge>}
                  {d.related_type && <span>{d.related_type}</span>}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleOpen(); }}
                title="Vorschau"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SubTabTrigger({
  value,
  active,
  icon,
  count,
  children,
}: {
  value: string;
  active: boolean;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground rounded-none border-b-2 border-transparent transition-colors hover:text-foreground data-[state=active]:text-foreground data-[state=active]:border-primary",
        active && "border-primary"
      )}
    >
      {icon}
      <span>{children}</span>
      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-muted text-[10px] font-semibold tabular-nums">
        {count}
      </span>
    </TabsTrigger>
  );
}
