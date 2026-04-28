import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Check, Printer, Save, Star, Image as ImageIcon, Eye, Pencil, ListChecks,
} from "lucide-react";
import {
  formatCurrency, formatArea, propertyTypeLabels, listingTypeLabels,
} from "@/lib/format";
import { renderExposeHTML } from "@/lib/expose-template";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/properties/$id/expose")({ component: ExposeWizard });

type FactKey =
  | "property_type" | "listing_type" | "price" | "rent"
  | "area" | "living_area" | "plot_area" | "rooms" | "bathrooms"
  | "year_built" | "renovated_at" | "floor" | "energy_class";

const FACT_DEFS: Array<{ key: FactKey; label: string }> = [
  { key: "property_type", label: "Objekttyp" },
  { key: "listing_type", label: "Vermarktung" },
  { key: "price", label: "Preis" },
  { key: "rent", label: "Miete" },
  { key: "area", label: "Fläche" },
  { key: "living_area", label: "Wohnfläche" },
  { key: "plot_area", label: "Grundstück" },
  { key: "rooms", label: "Zimmer" },
  { key: "bathrooms", label: "Bäder" },
  { key: "year_built", label: "Baujahr" },
  { key: "renovated_at", label: "Renoviert" },
  { key: "floor", label: "Stockwerk" },
  { key: "energy_class", label: "Energieklasse" },
];

function ExposeWizard() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);

  // Step state
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibleFacts, setVisibleFacts] = useState<Set<FactKey>>(
    new Set(["property_type", "listing_type", "price", "rent", "area", "rooms", "bathrooms", "energy_class"]),
  );

  const property = useQuery({
    queryKey: ["expose-property", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const media = useQuery({
    queryKey: ["expose-media", id],
    queryFn: async () => {
      const { data } = await supabase.from("property_media").select("*").eq("property_id", id).order("sort_order");
      return data ?? [];
    },
  });

  const profile = useQuery({
    queryKey: ["expose-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user!.id).single();
      return data;
    },
  });

  const company = useQuery({
    queryKey: ["expose-company"],
    queryFn: async () => {
      const { data } = await supabase.from("company").select("name").limit(1).single();
      return data;
    },
  });

  // Build pool of available images: media bucket urls + property.images legacy
  const imagePool = useMemo(() => {
    const fromMedia = (media.data ?? [])
      .filter((m: any) => !m.file_type || m.file_type.startsWith("image"))
      .map((m: any) => {
        const { data } = supabase.storage.from("media").getPublicUrl(m.file_url);
        return { url: data.publicUrl, isCover: m.is_cover };
      });
    const fromImages = (property.data?.images ?? []).map((u: string) => ({ url: u, isCover: false }));
    // dedupe
    const seen = new Set<string>();
    const out: { url: string; isCover: boolean }[] = [];
    [...fromMedia, ...fromImages].forEach((i) => { if (!seen.has(i.url)) { seen.add(i.url); out.push(i); } });
    return out;
  }, [media.data, property.data]);

  // Initialize defaults once data loads
  useEffect(() => {
    if (!property.data) return;
    if (!title) setTitle(property.data.title);
    if (!description && property.data.description) setDescription(property.data.description);
  }, [property.data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (imagePool.length === 0) return;
    if (!coverUrl) {
      const cover = imagePool.find((i) => i.isCover) ?? imagePool[0];
      setCoverUrl(cover.url);
    }
    if (galleryUrls.length === 0) {
      setGalleryUrls(imagePool.slice(0, 6).map((i) => i.url));
    }
  }, [imagePool]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = property.data;

  const facts = useMemo(() => {
    if (!p) return [];
    const m: Record<FactKey, string> = {
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
      .filter((f) => visibleFacts.has(f.key) && m[f.key] && m[f.key] !== "—")
      .map((f) => ({ label: f.label, value: m[f.key] }));
  }, [p, visibleFacts]);

  const html = useMemo(() => {
    if (!p) return "";
    return renderExposeHTML({
      title,
      description,
      address: p.address,
      postal_code: p.postal_code,
      city: p.city,
      property_type_label: visibleFacts.has("property_type") ? propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels] : null,
      listing_type_label: listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels],
      price: visibleFacts.has("price") && p.price ? Number(p.price) : null,
      rent: visibleFacts.has("rent") && p.rent ? Number(p.rent) : null,
      features: p.features,
      facts,
      cover_url: coverUrl,
      gallery_urls: galleryUrls.filter((u) => u !== coverUrl),
      agency_name: company.data?.name ?? "ASIMO Real Estate",
      contact_name: profile.data?.full_name ?? null,
      contact_email: profile.data?.email ?? null,
      contact_phone: profile.data?.phone ?? null,
      generated_on: new Date().toLocaleDateString("de-CH"),
    });
  }, [p, title, description, facts, coverUrl, galleryUrls, visibleFacts, company.data, profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("generated_documents").insert({
        related_type: "property",
        related_id: id,
        html_content: html,
        created_by: user!.id,
        variables: {
          kind: "expose",
          title,
          description,
          cover_url: coverUrl,
          gallery_urls: galleryUrls,
          visible_facts: Array.from(visibleFacts),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Exposé gespeichert");
      navigate({ to: "/properties/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (property.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Wird geladen…</div>;
  }
  if (!p) {
    return <div className="p-8">Objekt nicht gefunden.</div>;
  }

  const steps = [
    { n: 0, label: "Objekt", icon: Eye },
    { n: 1, label: "Cover", icon: Star },
    { n: 2, label: "Galerie", icon: ImageIcon },
    { n: 3, label: "Inhalt", icon: Pencil },
    { n: 4, label: "Eckdaten", icon: ListChecks },
    { n: 5, label: "Vorschau", icon: Check },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/properties/$id" params={{ id }}>
            <ArrowLeft className="mr-1 h-4 w-4" />Zurück zum Objekt
          </Link>
        </Button>
        <div className="flex gap-2">
          {step === 5 && (
            <>
              <Button variant="outline" size="sm" onClick={() => {
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400); }
              }}>
                <Printer className="mr-1 h-4 w-4" />Drucken / PDF
              </Button>
              <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="mr-1 h-4 w-4" />{save.isPending ? "Speichert…" : "Exposé speichern"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap gap-2">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = step === s.n;
          const done = step > s.n;
          return (
            <li key={s.n}>
              <button
                onClick={() => setStep(s.n)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active && "border-primary bg-primary text-primary-foreground",
                  !active && done && "border-primary/40 bg-primary/10 text-primary",
                  !active && !done && "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/20 text-[10px] font-bold">
                  {done ? <Check className="h-3 w-3" /> : s.n + 1}
                </span>
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Objekt bestätigen</h2>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-muted-foreground">{[p.address, p.postal_code, p.city].filter(Boolean).join(", ") || "Keine Adresse hinterlegt"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary">{propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]}</Badge>
                  <Badge variant="secondary">{listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]}</Badge>
                  {p.price && <Badge variant="outline">{formatCurrency(Number(p.price))}</Badge>}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Coverbild auswählen</h2>
              {imagePool.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Bilder vorhanden. Lade zuerst Medien zum Objekt hoch.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {imagePool.map((img) => (
                    <button
                      key={img.url}
                      onClick={() => setCoverUrl(img.url)}
                      className={cn(
                        "group relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition",
                        coverUrl === img.url ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-primary/40",
                      )}
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      {coverUrl === img.url && (
                        <div className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Bilder für die Galerie</h2>
                <p className="text-xs text-muted-foreground">{galleryUrls.length} ausgewählt</p>
              </div>
              {imagePool.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Bilder vorhanden.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {imagePool.map((img) => {
                    const selected = galleryUrls.includes(img.url);
                    return (
                      <button
                        key={img.url}
                        onClick={() =>
                          setGalleryUrls((prev) =>
                            prev.includes(img.url) ? prev.filter((u) => u !== img.url) : [...prev, img.url],
                          )
                        }
                        className={cn(
                          "relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition",
                          selected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-primary/40",
                        )}
                      >
                        <img src={img.url} alt="" className={cn("h-full w-full object-cover", !selected && "opacity-60")} />
                        {selected && (
                          <div className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Titel & Beschreibung</h2>
              <div>
                <Label>Titel</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Beschreibung</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={10} className="mt-1" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Sichtbare Eckdaten</h2>
              <p className="text-sm text-muted-foreground">Wähle die Fakten, die im Exposé erscheinen sollen.</p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {FACT_DEFS.map((f) => (
                  <label
                    key={f.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition",
                      visibleFacts.has(f.key) ? "border-primary bg-primary/5" : "hover:border-primary/40",
                    )}
                  >
                    <Checkbox
                      checked={visibleFacts.has(f.key)}
                      onCheckedChange={(c) =>
                        setVisibleFacts((prev) => {
                          const n = new Set(prev);
                          if (c) n.add(f.key); else n.delete(f.key);
                          return n;
                        })
                      }
                    />
                    <span className="text-sm font-medium">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Vorschau</h2>
              <div className="overflow-hidden rounded-xl border bg-[#f5f3ef]">
                <iframe
                  title="Exposé-Vorschau"
                  srcDoc={html}
                  className="h-[1100px] w-full"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="mr-1 h-4 w-4" />Zurück
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Weiter<ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-1 h-4 w-4" />{save.isPending ? "Speichert…" : "Exposé speichern"}
          </Button>
        )}
      </div>
    </div>
  );
}
