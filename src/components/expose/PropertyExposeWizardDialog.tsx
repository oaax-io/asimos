import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check, ChevronLeft, ChevronRight, FileDown, Image as ImageIcon, LayoutTemplate,
  Loader2, ListChecks, Eye, Star, Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { formatCurrency, formatArea, propertyTypeLabels, listingTypeLabels } from "@/lib/format";
import { renderExposeHTML } from "@/lib/expose-template";
import { renderDocumentPdf, fetchDocumentPdfBytes } from "@/lib/documents.functions";
import { TEMPLATES, type TemplateMeta, type GalerieLayout } from "@/components/expose/TemplatePreview";

type Props = {
  propertyId: string;
  property: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FactKey =
  | "property_type" | "listing_type" | "price" | "rent"
  | "area" | "living_area" | "plot_area" | "rooms" | "bathrooms"
  | "year_built" | "renovated_at" | "floor" | "energy_class";

const FACT_DEFS: Array<{ key: FactKey; label: string }> = [
  { key: "property_type", label: "Objekttyp" },
  { key: "listing_type", label: "Vermarktung" },
  { key: "price", label: "Kaufpreis" },
  { key: "rent", label: "Miete" },
  { key: "living_area", label: "Wohnfläche" },
  { key: "area", label: "Fläche" },
  { key: "plot_area", label: "Grundstück" },
  { key: "rooms", label: "Zimmer" },
  { key: "bathrooms", label: "Bäder" },
  { key: "floor", label: "Etage" },
  { key: "year_built", label: "Baujahr" },
  { key: "renovated_at", label: "Renoviert" },
  { key: "energy_class", label: "Energieklasse" },
];

const GALLERY_OPTIONS: Array<{ id: GalerieLayout; label: string; cols: number; desc: string }> = [
  { id: "grid2", label: "Grid 2×2", cols: 2, desc: "4 grosse Bilder pro Seite" },
  { id: "grid4", label: "Grid 3×3", cols: 3, desc: "9 Bilder pro Seite" },
  { id: "fullpage", label: "Vollbild", cols: 1, desc: "Ein Bild pro Seite" },
];

const STEPS = [
  { label: "Vorlage", icon: LayoutTemplate },
  { label: "Inhalte", icon: ListChecks },
  { label: "Galerie", icon: ImageIcon },
  { label: "Ansprechperson", icon: UserRound },
  { label: "Vorschau", icon: Eye },
  { label: "Generieren", icon: FileDown },
] as const;

function mediaUrl(path?: string | null) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

async function urlToDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export function PropertyExposeWizardDialog({ propertyId, property, open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<TemplateMeta>(TEMPLATES[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [withDescription, setWithDescription] = useState(true);
  const [withFeatures, setWithFeatures] = useState(true);
  const [withContact, setWithContact] = useState(true);
  const [visibleFacts, setVisibleFacts] = useState<Set<FactKey>>(
    new Set<FactKey>(["property_type", "listing_type", "price", "rent", "living_area", "rooms", "bathrooms", "energy_class"]),
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryLayout, setGalleryLayout] = useState<GalerieLayout>("grid2");
  const [generating, setGenerating] = useState(false);

  const renderPdf = useServerFn(renderDocumentPdf);
  const fetchBytes = useServerFn(fetchDocumentPdfBytes);

  const { data: media = [] } = useQuery({
    queryKey: ["expose-wizard-media", propertyId],
    enabled: open && !!propertyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("property_media")
        .select("id,file_url,file_type,is_cover,sort_order")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
  });

  const { data: company } = useQuery({
    queryKey: ["expose-wizard-company"],
    enabled: open,
    queryFn: async () => (await supabase.from("company").select("name").maybeSingle()).data,
  });

  const { data: profile } = useQuery({
    queryKey: ["expose-wizard-profile"],
    enabled: open,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("full_name,email,phone").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const imagePool = useMemo(() => {
    const fromMedia = (media as any[])
      .filter((m) => !m.file_type || String(m.file_type).startsWith("image") || /\.(jpe?g|png|webp|gif|avif)$/i.test(m.file_url))
      .map((m) => ({ url: mediaUrl(m.file_url), isCover: !!m.is_cover }));
    const legacy: string[] = Array.isArray(property?.images) ? property.images : [];
    const out: Array<{ url: string; isCover: boolean }> = [];
    const seen = new Set<string>();
    [...fromMedia, ...legacy.map((u) => ({ url: mediaUrl(u), isCover: false }))].forEach((i) => {
      if (i.url && !seen.has(i.url)) { seen.add(i.url); out.push(i); }
    });
    return out;
  }, [media, property]);

  // Reset / initialize when opening
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setGenerating(false);
    setTitle(property?.title ?? "");
    setDescription(property?.description ?? "");
  }, [open, property]);

  useEffect(() => {
    if (!open || imagePool.length === 0) return;
    setCoverUrl((c) => c ?? (imagePool.find((i) => i.isCover)?.url ?? imagePool[0].url));
    setGalleryUrls((g) => (g.length ? g : imagePool.slice(0, 8).map((i) => i.url)));
  }, [open, imagePool]);

  const facts = useMemo(() => {
    const p = property ?? {};
    const map: Record<FactKey, string> = {
      property_type: propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels] ?? "—",
      listing_type: listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels] ?? "—",
      price: p.price ? formatCurrency(Number(p.price)) : "—",
      rent: p.rent ? `${formatCurrency(Number(p.rent))} / Mt.` : "—",
      area: formatArea(p.area ? Number(p.area) : null),
      living_area: formatArea(p.living_area ? Number(p.living_area) : null),
      plot_area: formatArea(p.plot_area ? Number(p.plot_area) : null),
      rooms: p.rooms ? String(p.rooms) : "—",
      bathrooms: p.bathrooms ? String(p.bathrooms) : "—",
      year_built: p.year_built ? String(p.year_built) : "—",
      renovated_at: p.renovated_at ? String(p.renovated_at) : "—",
      floor: p.floor != null ? String(p.floor) : "—",
      energy_class: p.energy_class ?? "—",
    };
    return FACT_DEFS
      .filter((f) => visibleFacts.has(f.key) && map[f.key] && map[f.key] !== "—")
      .map((f) => ({ label: f.label, value: map[f.key] }));
  }, [property, visibleFacts]);

  const buildHtml = (cover: string | null, gallery: string[]) => {
    const p = property ?? {};
    const cols = GALLERY_OPTIONS.find((o) => o.id === galleryLayout)?.cols ?? 2;
    return renderExposeHTML(
      {
        title: title || p.title,
        description: withDescription ? description : null,
        address: p.address,
        postal_code: p.postal_code,
        city: p.city,
        property_type_label: propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels] ?? null,
        listing_type_label: p.listing_type === "rent" ? "Miet" : "Verkaufs",
        price: visibleFacts.has("price") && p.price ? Number(p.price) : null,
        rent: visibleFacts.has("rent") && p.rent ? Number(p.rent) : null,
        features: withFeatures ? (p.features ?? []) : [],
        facts,
        cover_url: cover,
        gallery_urls: gallery.filter((u) => u !== cover),
        gallery_cols: cols,
        agency_name: company?.name ?? "ASIMO",
        contact_name: withContact ? profile?.full_name ?? null : null,
        contact_email: withContact ? profile?.email ?? null : null,
        contact_phone: withContact ? profile?.phone ?? null : null,
        generated_on: new Date().toLocaleDateString("de-CH"),
      } as any,
      {
        primary: template.primary,
        accent: template.accent,
        pageBg: template.pageBg,
        titleFont: template.titleFont,
        bodyFont: template.bodyFont,
        orientation: template.orientation,
        templateLabel: template.label,
        family: template.family,
      },
    );
  };

  const previewHtml = useMemo(
    () => (step === 3 ? buildHtml(coverUrl, galleryUrls) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, coverUrl, galleryUrls, galleryLayout, template, title, description, withDescription, withFeatures, withContact, facts, company, profile],
  );

  async function handleGenerate() {
    setGenerating(true);
    try {
      const coverData = coverUrl ? await urlToDataUri(coverUrl) : null;
      const galleryData = (
        await Promise.all(galleryUrls.filter((u) => u !== coverUrl).map((u) => urlToDataUri(u)))
      ).filter((u): u is string => !!u);

      const html = buildHtml(coverData, galleryData);
      const safeTitle = title || property?.title || "Expose";
      const fileName = `Expose-${safeTitle.replace(/[^\w\s-]/g, "").trim() || "Objekt"}-${template.label}.pdf`;

      const res = await renderPdf({
        data: {
          html, title: safeTitle, fileName,
          documentType: "expose",
          propertyTitle: property?.title,
          companyName: company?.name ?? null,
        },
      });
      if (!res.ok || !res.fileUrl) {
        toast.error("PDF konnte nicht erstellt werden", { description: "message" in res ? (res as any).message : undefined });
        return;
      }

      let url = res.fileUrl;
      if (res.path) {
        try {
          const bytes = await fetchBytes({ data: { path: res.path } });
          if (bytes.ok && bytes.base64) {
            const bin = atob(bytes.base64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
          }
        } catch { /* fall back to fileUrl */ }
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Persist a record so it shows up under "Bisher erstellte Exposés"
      try {
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("generated_documents").insert({
          related_type: "property",
          related_id: propertyId,
          html_content: buildHtml(coverUrl, galleryUrls),
          created_by: u.user?.id ?? null,
          variables: {
            kind: "expose",
            title: safeTitle,
            template: template.id,
            gallery_layout: galleryLayout,
            visible_facts: Array.from(visibleFacts),
          } as any,
        } as any);
      } catch { /* record is optional */ }

      toast.success("Exposé wurde erstellt und heruntergeladen");
      onOpenChange(false);
    } catch (err) {
      toast.error("PDF konnte nicht erstellt werden", { description: (err as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  const toggleFact = (k: FactKey) =>
    setVisibleFacts((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!generating) onOpenChange(o); }}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />Exposé erstellen
          </DialogTitle>
          <DialogDescription>
            Schritt für Schritt: Vorlage wählen, Inhalte auswählen, Galerie bestimmen, Vorschau prüfen und als PDF herunterladen.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active && "border-primary bg-primary text-primary-foreground",
                    !active && done && "border-primary/40 bg-primary/10 text-primary",
                    !active && !done && "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>

        <ScrollArea className="-mx-2 flex-1 px-2">
          <div className="min-h-[320px] py-3">
            {step === 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left transition",
                      template.id === t.id ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className="mb-2 flex h-14 overflow-hidden rounded-md" style={{ background: t.pageBg }}>
                      <div className="w-1/3" style={{ background: t.primary }} />
                      <div className="w-2 self-stretch" style={{ background: t.accent }} />
                    </div>
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      {t.orientation === "landscape" ? "Querformat" : "Hochformat"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Titel</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Beschreibung</Label>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={withDescription} onCheckedChange={() => setWithDescription((v) => !v)} />
                      Im Exposé anzeigen
                    </label>
                  </div>
                  <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!withDescription} />
                </div>
                <div>
                  <Label className="mb-2 block">Eckdaten auswählen</Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {FACT_DEFS.map((f) => (
                      <label key={f.key} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                        <Checkbox checked={visibleFacts.has(f.key)} onCheckedChange={() => toggleFact(f.key)} />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={withFeatures} onCheckedChange={() => setWithFeatures((v) => !v)} />
                    Ausstattung anzeigen
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={withContact} onCheckedChange={() => setWithContact((v) => !v)} />
                    Kontaktangaben anzeigen
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {imagePool.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Bilder vorhanden. Lade zuerst Medien zum Objekt hoch.</p>
                ) : (
                  <>
                    <div>
                      <Label className="mb-2 block">Galerie-Layout</Label>
                      <div className="flex flex-wrap gap-2">
                        {GALLERY_OPTIONS.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setGalleryLayout(o.id)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-left text-xs transition",
                              galleryLayout === o.id ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40",
                            )}
                          >
                            <span className="block font-semibold">{o.label}</span>
                            <span className="text-muted-foreground">{o.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label>Bilder ({galleryUrls.length} ausgewählt)</Label>
                        <span className="text-xs text-muted-foreground">Klick = Auswahl · Stern = Coverbild</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {imagePool.map((img) => {
                          const selected = galleryUrls.includes(img.url);
                          const isCover = coverUrl === img.url;
                          return (
                            <div
                              key={img.url}
                              className={cn(
                                "relative aspect-[4/3] cursor-pointer overflow-hidden rounded-xl border-2 transition",
                                selected ? "border-primary ring-2 ring-primary/25" : "border-transparent hover:border-primary/40",
                              )}
                              onClick={() =>
                                setGalleryUrls((prev) =>
                                  prev.includes(img.url) ? prev.filter((u) => u !== img.url) : [...prev, img.url],
                                )
                              }
                            >
                              <img src={img.url} alt="" className={cn("h-full w-full object-cover", !selected && "opacity-60")} />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setCoverUrl(img.url); }}
                                className={cn(
                                  "absolute left-1.5 top-1.5 rounded-full p-1 transition",
                                  isCover ? "bg-primary text-primary-foreground" : "bg-background/80 text-muted-foreground hover:text-primary",
                                )}
                                title="Als Coverbild verwenden"
                              >
                                <Star className={cn("h-3.5 w-3.5", isCover && "fill-current")} />
                              </button>
                              {selected && (
                                <div className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Vorschau · Vorlage {template.label} · {galleryUrls.filter((u) => u !== coverUrl).length} Galeriebilder
                </p>
                <iframe title="Exposé-Vorschau" srcDoc={previewHtml} className="h-[60vh] w-full rounded-lg border bg-white" />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 py-6 text-center">
                <FileDown className="mx-auto h-10 w-10 text-primary" />
                <div>
                  <p className="font-semibold">Bereit zum Generieren</p>
                  <p className="text-sm text-muted-foreground">
                    {title || property?.title} · Vorlage {template.label} · {facts.length} Eckdaten ·{" "}
                    {galleryUrls.filter((u) => u !== coverUrl).length} Galeriebilder
                  </p>
                </div>
                <Button size="lg" onClick={handleGenerate} disabled={generating}>
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                  {generating ? "PDF wird erstellt…" : "Exposé generieren & herunterladen"}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between border-t pt-3">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || generating}>
            <ChevronLeft className="mr-1 h-4 w-4" />Zurück
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Weiter<ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>Schliessen</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
