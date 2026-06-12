import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileDown, Loader2, MapPin, Image as ImageIcon, FileText, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { propertyTypeLabels } from "@/lib/format";
import { renderExposeHTML } from "@/lib/expose-template";
import { renderDocumentPdf, fetchDocumentPdfBytes } from "@/lib/documents.functions";
import { getNearbyPois, buildStaticMapUrl, getMapboxToken } from "@/lib/mapbox.functions";
import type { TemplateMeta, ExposeSections, GalerieLayout } from "@/components/expose/TemplatePreview";

type Props = {
  open: boolean;
  template: TemplateMeta | null;
  onOpenChange: (open: boolean) => void;
};

type MediaRow = {
  id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  title: string | null;
};

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
  { key: "mikrolage", label: "Mikrolage & Karte" },
  { key: "einheiten", label: "Eckdaten" },
  { key: "galerie", label: "Galerie" },
  { key: "grundriss", label: "Grundriss" },
  { key: "energieausweis", label: "Energieausweis" },
  { key: "kontakt", label: "Kontakt" },
];

const GALLERY_OPTIONS: Array<{ id: GalerieLayout; label: string; cols: number; desc: string }> = [
  { id: "grid2", label: "Grid 2×2", cols: 2, desc: "4 große Bilder pro Seite" },
  { id: "grid4", label: "Grid 3×3", cols: 3, desc: "9 Bilder pro Seite" },
  { id: "fullpage", label: "Vollbild", cols: 1, desc: "Ein Bild pro Seite" },
  { id: "magazine", label: "Magazin", cols: 2, desc: "Hero + Kacheln" },
];

const STEPS = ["Objekt", "Inhalte", "Galerie", "Anhänge", "Generieren"] as const;
type StepIdx = 0 | 1 | 2 | 3 | 4;

const isImage = (m: MediaRow) =>
  m.file_type === "image" || /\.(jpe?g|png|webp|gif|avif|jfif)$/i.test(m.file_url);

export function ExposeGeneratorDialog({ open, template, onOpenChange }: Props) {
  const [step, setStep] = useState<StepIdx>(0);
  const [propertyId, setPropertyId] = useState<string>("");
  const [sections, setSections] = useState<Required<ExposeSections>>(DEFAULT_SECTIONS);
  const [galleryLayout, setGalleryLayout] = useState<GalerieLayout>("grid2");
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const renderPdf = useServerFn(renderDocumentPdf);
  const fetchBytes = useServerFn(fetchDocumentPdfBytes);
  const fetchPois = useServerFn(getNearbyPois);
  const fetchMapboxToken = useServerFn(getMapboxToken);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPropertyId("");
      setSelectedImageIds(new Set());
      setSelectedDocIds(new Set());
      setSections(DEFAULT_SECTIONS);
      setGalleryLayout("grid2");
    }
  }, [open]);

  const { data: properties = [] } = useQuery({
    queryKey: ["expose-gen-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id,title,description,address,city,postal_code,country,property_type,listing_type,images,rooms,bathrooms,year_built,renovated_at,living_area,plot_area,area,floor,energy_class,price,rent,features")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: companyData } = useQuery({
    queryKey: ["expose-gen-company"],
    queryFn: async () => (await supabase.from("company").select("name").maybeSingle()).data,
    enabled: open,
  });
  const { data: profileData } = useQuery({
    queryKey: ["expose-gen-profile"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data } = await supabase.from("profiles").select("full_name,email,phone").eq("id", userRes.user.id).maybeSingle();
      return data;
    },
    enabled: open,
  });

  const property = useMemo(() => properties.find((p) => p.id === propertyId) ?? null, [properties, propertyId]);

  const { data: media = [] } = useQuery<MediaRow[]>({
    queryKey: ["expose-gen-media", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("property_media")
        .select("id,file_url,file_name,file_type,title")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!propertyId,
  });

  const imageMedia = useMemo(() => media.filter(isImage), [media]);
  const docMedia = useMemo(() => media.filter((m) => !isImage(m)), [media]);

  // Pre-select all image media when changing property
  useEffect(() => {
    if (!propertyId) return;
    setSelectedImageIds(new Set(imageMedia.map((m) => m.id)));
    setSelectedDocIds(new Set());
  }, [propertyId, imageMedia.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = (k: keyof ExposeSections) =>
    setSections((s) => ({ ...s, [k]: !s[k as keyof typeof s] }));

  const toggleSet = (setter: typeof setSelectedImageIds, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canNext =
    step === 0 ? !!propertyId :
    step === 1 ? true :
    step === 2 ? true :
    step === 3 ? true :
    true;

  const next = () => setStep((s) => (s < 4 ? ((s + 1) as StepIdx) : s));
  const prev = () => setStep((s) => (s > 0 ? ((s - 1) as StepIdx) : s));

  async function handleGenerate() {
    if (!property || !template) return;
    setGenerating(true);
    try {
      const p = property as any;
      const facts: Array<{ label: string; value: string }> = [];
      const push = (label: string, v: unknown) => {
        if (v == null || v === "" || v === "—") return;
        facts.push({ label, value: String(v) });
      };
      const ptLabel = propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels];
      push("Objektart", ptLabel);
      push("Vermarktung", p.listing_type === "rent" ? "Miete" : "Kauf");
      if (p.living_area) push("Wohnfläche", `${Number(p.living_area)} m²`);
      if (p.area) push("Fläche", `${Number(p.area)} m²`);
      if (p.plot_area) push("Grundstück", `${Number(p.plot_area)} m²`);
      if (p.rooms) push("Zimmer", String(p.rooms));
      if (p.bathrooms) push("Bäder", String(p.bathrooms));
      if (p.floor != null) push("Etage", String(p.floor));
      if (p.year_built) push("Baujahr", String(p.year_built));
      if (p.renovated_at) push("Renoviert", String(p.renovated_at));
      if (p.energy_class) push("Energieklasse", p.energy_class);

      // Gallery: selected image media (or fall back to images array)
      const selectedImgUrls = imageMedia
        .filter((m) => selectedImageIds.has(m.id))
        .map((m) => m.file_url);
      const fallbackImgs: string[] = Array.isArray(p.images) ? p.images : [];
      const gallerySource = selectedImgUrls.length > 0 ? selectedImgUrls : fallbackImgs;
      const coverUrl = gallerySource[0] ?? null;
      const galleryUrls = sections.galerie ? gallerySource.slice(1) : [];

      // Map + POIs
      let mapUrl: string | null = null;
      let pois: Array<{ name: string; category: string; distance_m: number }> = [];
      if (sections.mikrolage && p.latitude && p.longitude) {
        try {
          const { token } = await fetchMapboxToken();
          const poisRes = await fetchPois({ data: { latitude: Number(p.latitude), longitude: Number(p.longitude), country: p.country || undefined } });
          pois = poisRes.map((x) => ({ name: x.name, category: x.category, distance_m: x.distance_m }));
          if (token) {
            mapUrl = buildStaticMapUrl({
              token,
              latitude: Number(p.latitude),
              longitude: Number(p.longitude),
              pois: poisRes.map((x) => ({ latitude: x.latitude, longitude: x.longitude })),
              width: 900, height: 540, zoom: 14,
            });
          }
        } catch {
          /* ignore — map is optional */
        }
      }

      const galleryCols = GALLERY_OPTIONS.find((o) => o.id === galleryLayout)?.cols ?? 2;

      const html = renderExposeHTML(
        {
          title: p.title,
          description: sections.beschreibung ? p.description : null,
          address: p.address,
          postal_code: p.postal_code,
          city: p.city,
          property_type_label: ptLabel,
          listing_type_label: p.listing_type === "rent" ? "Miet" : "Verkaufs",
          price: p.price ? Number(p.price) : null,
          rent: p.rent ? Number(p.rent) : null,
          features: p.features ?? [],
          facts: sections.einheiten ? facts : [],
          cover_url: coverUrl,
          gallery_urls: galleryUrls,
          gallery_cols: galleryCols,
          static_map_url: mapUrl,
          pois,
          attachment_image_urls: imageMedia
            .filter((m) => selectedImageIds.has(m.id) && !gallerySource.includes(m.file_url))
            .map((m) => m.file_url),
          attachment_doc_names: docMedia
            .filter((m) => selectedDocIds.has(m.id))
            .map((m) => m.title || m.file_name || m.file_url.split("/").pop() || "Dokument"),
          agency_name: companyData?.name ?? "ASIMO",
          contact_name: sections.kontakt ? profileData?.full_name ?? null : null,
          contact_email: sections.kontakt ? profileData?.email ?? null : null,
          contact_phone: sections.kontakt ? profileData?.phone ?? null : null,
          generated_on: new Date().toLocaleDateString("de-CH"),
        },
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

      const safeTitle = p.title || "Expose";
      const fileName = `Expose-${safeTitle.replace(/[^\w\s-]/g, "").trim() || "Objekt"}-${template.label}.pdf`;
      const res = await renderPdf({
        data: {
          html, title: safeTitle, fileName,
          documentType: "expose",
          propertyTitle: p.title,
          companyName: companyData?.name ?? null,
        },
      });
      if (!res.ok || !res.fileUrl) {
        toast.error("PDF konnte nicht erstellt werden", { description: "message" in res ? res.message : undefined });
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
        } catch {}
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("PDF wurde erstellt");
      onOpenChange(false);
    } catch (err) {
      toast.error("PDF konnte nicht erstellt werden", { description: (err as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Exposé generieren · {template.label}
          </DialogTitle>
          <DialogDescription>
            {template.description} · {template.orientation === "landscape" ? "Querformat" : "Hochformat"}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <ol className="mb-2 flex items-center gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                  i === step ? "border-primary bg-primary text-primary-foreground" :
                  i < step ? "border-primary/40 bg-primary/10 text-primary" :
                  "border-border bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn(i === step ? "font-semibold" : "text-muted-foreground")}>{label}</span>
              {i < STEPS.length - 1 && <span className="text-muted-foreground/40">›</span>}
            </li>
          ))}
        </ol>

        <div className="min-h-[280px] py-2">
          {step === 0 && (
            <div className="space-y-3">
              <Label>Immobilie</Label>
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
              {property && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <div className="font-semibold">{property.title}</div>
                  <div className="text-muted-foreground">
                    {[property.address, property.postal_code, property.city].filter(Boolean).join(", ") || "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary">{propertyTypeLabels[property.property_type as keyof typeof propertyTypeLabels]}</Badge>
                    {(property as any).latitude && (property as any).longitude && (
                      <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" /> Koordinaten vorhanden</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <Label>Welche Inhalte sollen im Exposé enthalten sein?</Label>
              <div className="grid grid-cols-2 gap-2">
                {SECTION_LABELS.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox
                      checked={!!sections[key as keyof typeof sections]}
                      onCheckedChange={() => toggleSection(key)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {sections.mikrolage && property && !(property as any).latitude && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  Objekt hat keine Koordinaten — Karte & POIs werden übersprungen.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label>Galerie-Layout</Label>
              <div className="grid grid-cols-2 gap-2">
                {GALLERY_OPTIONS.map((o) => {
                  const active = o.id === galleryLayout;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setGalleryLayout(o.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition",
                        active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="text-sm font-semibold">{o.label}</div>
                      <div className="text-xs text-muted-foreground">{o.desc}</div>
                      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${o.cols}, 1fr)` }}>
                        {Array.from({ length: Math.min(o.cols * 2, 6) }).map((_, i) => (
                          <div key={i} className="aspect-[4/3] rounded bg-muted" />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> <Label className="m-0">Fotos ({imageMedia.length})</Label>
                  <span className="ml-auto text-xs text-muted-foreground">{selectedImageIds.size} ausgewählt</span>
                </div>
                {imageMedia.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Keine Fotos beim Objekt.</div>
                ) : (
                  <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-md border p-2">
                    {imageMedia.map((m) => {
                      const checked = selectedImageIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleSet(setSelectedImageIds, m.id)}
                          className={cn(
                            "group relative aspect-[4/3] overflow-hidden rounded border-2 transition",
                            checked ? "border-primary" : "border-transparent hover:border-primary/40",
                          )}
                        >
                          <img src={m.file_url} alt="" className="h-full w-full object-cover" />
                          {checked && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> <Label className="m-0">Dokumente ({docMedia.length})</Label>
                  <span className="ml-auto text-xs text-muted-foreground">{selectedDocIds.size} ausgewählt</span>
                </div>
                {docMedia.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Keine Dokumente beim Objekt.</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-md border">
                    {docMedia.map((m) => {
                      const checked = selectedDocIds.has(m.id);
                      return (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2 border-b p-2 text-sm last:border-0">
                          <Checkbox checked={checked} onCheckedChange={() => toggleSet(setSelectedDocIds, m.id)} />
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{m.title || m.file_name || m.file_url.split("/").pop()}</span>
                          {m.file_type && <Badge variant="outline" className="ml-auto text-[10px]">{m.file_type}</Badge>}
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Dokumente werden im Exposé als Anhang-Liste aufgeführt (Namen).
                </p>
              </div>
            </div>
          )}

          {step === 4 && property && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="font-semibold">{property.title}</div>
                <div className="text-xs text-muted-foreground">{template.label} · {template.orientation === "landscape" ? "Querformat" : "Hochformat"}</div>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• {Object.entries(sections).filter(([k, v]) => v && k !== "galerieLayout").length} Sektionen</li>
                <li>• Galerie-Layout: {GALLERY_OPTIONS.find((o) => o.id === galleryLayout)?.label}</li>
                <li>• {selectedImageIds.size} Fotos, {selectedDocIds.size} Dokumente</li>
                <li>• Karte/POIs: {sections.mikrolage && (property as any).latitude ? "ja" : "nein"}</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={prev} disabled={step === 0 || generating}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
          </Button>
          {step < 4 ? (
            <Button onClick={next} disabled={!canNext}>
              Weiter <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={!property || generating}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              {generating ? "PDF wird erstellt…" : "Exposé generieren"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
