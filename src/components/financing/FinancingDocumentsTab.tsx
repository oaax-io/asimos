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

type Props = {
  dossierId: string;
  clientId?: string | null;
  clientIds?: string[];
  propertyId?: string | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  other: "Sonstiges",
  client: "Kunde",
  client_document: "Kundendokument",
  property: "Objekt",
  property_document: "Objektdokument",
  financing: "Finanzierung",
  financing_document: "Finanzierungsdokument",
  contract: "Vertrag",
  identity: "Ausweis",
  id_document: "Ausweis",
  salary: "Lohnausweis",
  salary_statement: "Lohnausweis",
  payslip: "Lohnabrechnung",
  tax: "Steuererklärung",
  tax_return: "Steuererklärung",
  bank_statement: "Kontoauszug",
  pension: "Pensionskasse",
  land_register: "Grundbuchauszug",
  insurance: "Versicherung",
  floor_plan: "Grundriss",
  photo: "Foto",
  image: "Bild",
  expose: "Exposé",
  invoice: "Rechnung",
  offer: "Offerte",
  nda: "NDA",
  mandate: "Mandat",
  reservation: "Reservation",
  self_disclosure: "Selbstauskunft",
  generated: "Generiert",
  report: "Bericht",
  lead: "Lead",
  appointment: "Termin",
};

function docLabel(value?: string | null) {
  if (!value) return "";
  return DOC_TYPE_LABELS[value] ?? value.replace(/_/g, " ");
}

type PreviewDoc = {
  name: string;
  url?: string | null;
  html?: string | null;
  mime?: string | null;
};

export function FinancingDocumentsTab({ dossierId, clientId, clientIds, propertyId }: Props) {
  const allClientIds = useMemo(
    () => Array.from(new Set([...(clientIds ?? []), clientId].filter(Boolean))) as string[],
    [clientIds, clientId],
  );
  const clientKey = allClientIds.join(",");

  const buildOr = () => {
    const orParts: string[] = [`and(related_type.eq.financing,related_id.eq.${dossierId})`];
    if (allClientIds.length > 0) {
      orParts.push(`and(related_type.eq.client,related_id.in.(${allClientIds.join(",")}))`);
    }
    if (propertyId) orParts.push(`and(related_type.eq.property,related_id.eq.${propertyId})`);
    return orParts.join(",");
  };

  const docsQuery = useQuery({
    queryKey: ["financing_documents", dossierId, clientKey, propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .or(buildOr())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const generatedQuery = useQuery({
    queryKey: ["financing_generated", dossierId, clientKey, propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_documents")
        .select("*")
        .or(buildOr())
        .order("created_at", { ascending: false })
        .limit(1000);
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
        const name = d.file_name || d.title || "Dokument";
        const type = d._generated ? "Generiert" : docLabel(d.document_type || d.related_type);
        const html = d._generated ? (d.html_content ?? null) : null;
        const handleOpen = async () => {
          let url: string | null = null;
          if (!html) {
            const raw = d.file_url || d.esign_url || null;
            if (raw) {
              if (/^https?:\/\//i.test(raw)) {
                url = raw;
              } else {
                const { data } = await supabase.storage.from("documents").createSignedUrl(raw, 60 * 10);
                url = data?.signedUrl ?? null;
              }
            }
          }
          onPreview({ name, url, html, mime: d.mime_type ?? null });
        };
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
                  {d.related_type && <span>{docLabel(d.related_type)}</span>}
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
