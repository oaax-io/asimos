import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, FileDown, Loader2, FileBadge, Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderDocumentPdf, fetchDocumentPdfBytes } from "@/lib/documents.functions";
import {
  TEMPLATES,
  TemplatePreview,
  type TemplateMeta,
  type ExposePreviewData,
  type ExposeSections,
  type ExposeTemplate,
} from "@/components/expose/TemplatePreview";
import { propertyTypeLabels } from "@/lib/format";

export const Route = createFileRoute("/_app/exposes")({ component: ExposesPage });

const DEFAULT_SECTIONS: Required<ExposeSections> = {
  beschreibung: true,
  mikrolage: true,
  einheiten: true,
  grundriss: true,
  kontakt: true,
  galerie: true,
  galerieLayout: "grid4",
  energieausweis: true,
};

const SECTION_LABELS: Array<{ key: keyof ExposeSections; label: string }> = [
  { key: "beschreibung", label: "Beschreibung" },
  { key: "mikrolage", label: "Mikrolage" },
  { key: "einheiten", label: "Einheiten" },
  { key: "galerie", label: "Galerie" },
  { key: "grundriss", label: "Grundriss" },
  { key: "energieausweis", label: "Energieausweis" },
  { key: "kontakt", label: "Kontakt" },
];

function ExposesPage() {
  const [templateId, setTemplateId] = useState<ExposeTemplate>("classic");
  const [propertyId, setPropertyId] = useState<string>("");
  const [sections, setSections] = useState<Required<ExposeSections>>(DEFAULT_SECTIONS);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateMeta | null>(null);

  const { data: properties = [] } = useQuery({
    queryKey: ["exposes-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id,title,address,city,postal_code,property_type,listing_type,images,rooms,year_built,living_area,plot_area")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const property = useMemo(
    () => properties.find((p) => p.id === propertyId) ?? null,
    [properties, propertyId],
  );

  const previewData: ExposePreviewData | undefined = useMemo(() => {
    if (!property) return undefined;
    return {
      name: property.title ?? "Objekt",
      bildUrl: property.images?.[0] ?? null,
      adresse: property.address ?? null,
      ort: property.city ?? null,
      plz: property.postal_code ?? null,
      kategorie: property.listing_type === "rent" ? "miete" : "kauf",
      einheitenCount: property.rooms ? Math.round(Number(property.rooms)) : undefined,
      anzahlEtagen: null,
      fertigstellung: property.year_built ? String(property.year_built) : null,
    };
  }, [property]);

  const template: TemplateMeta = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  const toggleSection = (key: keyof ExposeSections) => {
    setSections((s) => ({ ...s, [key]: !s[key as keyof typeof s] }));
  };

  return (
    <>
      <PageHeader
        title="Exposés"
        description="Wähle ein Template, ein Objekt und generiere ein professionelles Exposé."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* LEFT: Template gallery */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">1. Template wählen</h2>
              <Badge variant="outline" className="text-xs">{TEMPLATES.length} Templates</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {TEMPLATES.map((t) => {
                const active = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewTemplate(t)}
                    className={cn(
                      "group relative flex flex-col rounded-lg border bg-card p-2 text-left transition",
                      active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="relative w-full overflow-hidden rounded">
                      <TemplatePreview template={t} sections={sections} preview={previewData} scale="thumbnail" />
                      <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="mb-2 flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold shadow">
                          <Eye className="h-3 w-3" /> Vorschau
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{t.label}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{t.description}</div>
                      </div>
                      {active && (
                        <span className="ml-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t.orientation === "landscape" ? "Querformat" : "Hochformat"} · {t.family}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Object + sections + actions */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="font-display text-lg font-semibold">2. Objekt wählen</h2>
              <div className="space-y-2">
                <Label>Immobilie aus CRM</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger><SelectValue placeholder={properties.length === 0 ? "Keine Objekte" : "Objekt wählen…"} /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}{p.city ? ` · ${p.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {property && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <div className="font-semibold">{property.title}</div>
                  <div className="text-muted-foreground">
                    {[property.address, property.postal_code, property.city].filter(Boolean).join(", ") || "—"}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <Badge variant="secondary">{propertyTypeLabels[property.property_type as keyof typeof propertyTypeLabels]}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-lg font-semibold">3. Inhalte</h2>
              <div className="grid grid-cols-2 gap-2">
                {SECTION_LABELS.map(({ key, label }) => {
                  const checked = !!sections[key as keyof typeof sections];
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={() => toggleSection(key)} />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            disabled={!property}
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />Exposé drucken / als PDF speichern
          </Button>

        </div>
      </div>

      {/* Live full preview */}
      <Card className="mt-6">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Live-Vorschau · {template.label}</h2>
            <span className="text-xs text-muted-foreground">Schematische Vorschau · keine 1:1 PDF-Wiedergabe</span>
          </div>
          {property ? (
            <TemplatePreview template={template} sections={sections} preview={previewData} scale="full" />
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              <FileBadge className="h-5 w-5" />
              Wähle ein Objekt, um die Vorschau zu sehen.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template preview dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => { if (!o) setPreviewTemplate(null); }}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Template: {previewTemplate?.label}
              <Badge variant="secondary" className="ml-2 gap-1 border-0 bg-emerald-100 text-emerald-800">
                <Check className="h-3 w-3" /> Verfügbar
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.description} · {previewTemplate?.orientation === "landscape" ? "Querformat" : "Hochformat"} · {previewTemplate?.family}
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-3 py-2">
              <TemplatePreview
                template={previewTemplate}
                sections={sections}
                preview={previewData}
                scale="stack"
              />
              <p className="text-center text-[11px] text-muted-foreground">
                {property ? "Vorschau mit gewähltem Objekt" : "Schematische Vorschau · scrollen für alle Seiten"}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Schliessen</Button>
            <Button
              onClick={() => {
                if (previewTemplate) setTemplateId(previewTemplate.id);
                setPreviewTemplate(null);
              }}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" /> Dieses Template wählen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
