import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin, Bed, Bath, Maximize, Calendar, Zap, Building2, TrendingUp,
  Train, GraduationCap, ShoppingBag, HeartPulse, Trees, Shield, Briefcase,
  Users, Mountain, Theater, Star, Plane, Car,
} from "lucide-react";
import { formatCurrency, formatArea, propertyTypeLabels, listingTypeLabels } from "@/lib/format";

export const Route = createFileRoute("/p/$token")({
  component: PublicProperty,
  head: () => ({
    meta: [
      { title: "Immobilien-Exposé" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const ICON_MAP: Record<string, any> = {
  transport: Train, education: GraduationCap, shopping: ShoppingBag, healthcare: HeartPulse,
  leisure: Trees, safety: Shield, economy: Briefcase, demographics: Users,
  nature: Mountain, culture: Theater,
};

function mediaUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

function PublicProperty() {
  const { token } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-property", token],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("public_property_view", { _token: token });
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Wird geladen…</div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="max-w-md"><CardContent className="p-8 text-center space-y-2">
          <h1 className="font-display text-xl font-semibold">Link ungültig</h1>
          <p className="text-sm text-muted-foreground">Dieser Link ist abgelaufen oder wurde deaktiviert.</p>
        </CardContent></Card>
      </div>
    );
  }

  const p = data.property as any;
  const ma = data.market_analysis as any | null;
  const units = (data.units as any[]) ?? [];
  const media = (data.media as any[]) ?? [];
  const macro = p.macro_location as any | null;
  const sections = ma?.sections as any | null;

  const cover = media.find((m) => m.is_cover && (!m.file_type || m.file_type.startsWith("image"))) ??
                media.find((m) => !m.file_type || m.file_type.startsWith("image"));
  const galleryUrls = media
    .filter((m) => (!m.file_type || m.file_type.startsWith("image")))
    .map((m) => mediaUrl(m.file_url));

  const address = [p.address, [p.postal_code, p.city].filter(Boolean).join(" "), p.country].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-[55vh] min-h-[360px] max-h-[600px] w-full overflow-hidden bg-muted">
        {cover ? (
          <img src={mediaUrl(cover.file_url)} alt={p.title} className="h-full w-full object-cover" />
        ) : p.images?.[0] ? (
          <img src={mediaUrl(p.images[0])} alt={p.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-muted to-muted-foreground/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 text-white">
          <div className="mx-auto max-w-5xl space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/20 backdrop-blur border-0">{propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]}</Badge>
              <Badge className="bg-white/20 backdrop-blur border-0">{listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]}</Badge>
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-semibold drop-shadow">{p.title}</h1>
            {address && <p className="flex items-center gap-2 text-sm md:text-base opacity-90"><MapPin className="h-4 w-4" />{address}</p>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-10 p-6 md:p-10">
        {/* Price + key facts */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardContent className="p-6 space-y-2">
              {p.price && (
                <>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Kaufpreis</p>
                  <p className="font-display text-3xl font-semibold">{formatCurrency(Number(p.price))}</p>
                </>
              )}
              {p.rent && (
                <>
                  <p className="text-xs uppercase text-muted-foreground tracking-wide mt-2">Miete</p>
                  <p className="font-display text-2xl font-semibold">{formatCurrency(Number(p.rent))}<span className="text-sm text-muted-foreground"> / Monat</span></p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-6 text-sm">
              <Stat icon={Maximize} label="Wohnfläche" value={formatArea(p.living_area ? Number(p.living_area) : (p.area ? Number(p.area) : null))} />
              <Stat icon={Maximize} label="Grundstück" value={formatArea(p.plot_area ? Number(p.plot_area) : null)} />
              <Stat icon={Bed} label="Zimmer" value={p.rooms ? String(p.rooms) : "—"} />
              <Stat icon={Bath} label="Bäder" value={p.bathrooms ? String(p.bathrooms) : "—"} />
              <Stat icon={Calendar} label="Baujahr" value={p.year_built ? String(p.year_built) : "—"} />
              <Stat icon={Zap} label="Energie" value={p.energy_class ?? "—"} />
            </CardContent>
          </Card>
        </div>

        {/* Description */}
        {p.description && (
          <section>
            <h2 className="font-display text-2xl font-semibold mb-3">Beschreibung</h2>
            <p className="whitespace-pre-wrap text-sm md:text-base leading-relaxed text-muted-foreground">{p.description}</p>
          </section>
        )}

        {/* Features */}
        {Array.isArray(p.features) && p.features.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-semibold mb-3">Ausstattung</h2>
            <div className="flex flex-wrap gap-2">
              {p.features.map((f: string) => <Badge key={f} variant="secondary">{f}</Badge>)}
            </div>
          </section>
        )}

        {/* Gallery */}
        {galleryUrls.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-semibold mb-3">Fotos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {galleryUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                  <img src={u} alt="" className="h-full w-full object-cover hover:scale-105 transition" loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Macro location */}
        {macro && (
          <section>
            <h2 className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />Makrolage
              {typeof macro.score === "number" && <Badge variant="secondary">{macro.score}/10</Badge>}
            </h2>
            {(macro.municipality || macro.region) && (
              <p className="text-xs text-muted-foreground mb-3">{[macro.municipality, macro.region].filter(Boolean).join(" · ")}</p>
            )}
            {macro.summary && <p className="text-sm leading-relaxed text-muted-foreground mb-4">{macro.summary}</p>}
            {Array.isArray(macro.categories) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {macro.categories.map((c: any, i: number) => {
                  const Icon = ICON_MAP[c.key] ?? MapPin;
                  return (
                    <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="font-medium text-sm">{c.title}</div>
                        </div>
                        {typeof c.rating === "number" && (
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <Star key={j} className={`h-3 w-3 ${j < c.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                        )}
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>}
                      {Array.isArray(c.highlights) && c.highlights.length > 0 && (
                        <ul className="space-y-0.5">
                          {c.highlights.map((h: string, j: number) => (
                            <li key={j} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary">•</span><span>{h}</span></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {macro.connectivity && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-4 grid gap-2 sm:grid-cols-2 text-xs">
                {macro.connectivity.public_transport && <div className="flex gap-2"><Train className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.public_transport}</span></div>}
                {macro.connectivity.highway && <div className="flex gap-2"><Car className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.highway}</span></div>}
                {macro.connectivity.airport && <div className="flex gap-2"><Plane className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.airport}</span></div>}
                {macro.connectivity.city_center && <div className="flex gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.city_center}</span></div>}
              </div>
            )}
          </section>
        )}

        {/* Market analysis */}
        {sections && (
          <section>
            <h2 className="font-display text-2xl font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />Marktanalyse
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.location?.summary && (
                <Card><CardContent className="p-4 space-y-1">
                  <h3 className="text-sm font-semibold">Lage</h3>
                  <p className="text-xs text-muted-foreground">{sections.location.summary}</p>
                  {Array.isArray(sections.location.highlights) && (
                    <ul className="mt-1 space-y-0.5">
                      {sections.location.highlights.map((h: string, i: number) => (
                        <li key={i} className="text-xs flex gap-1.5"><span className="text-primary">•</span><span>{h}</span></li>
                      ))}
                    </ul>
                  )}
                </CardContent></Card>
              )}
              {sections.purchase_price && (
                <Card><CardContent className="p-4 space-y-1">
                  <h3 className="text-sm font-semibold">Kaufpreis-Einschätzung</h3>
                  {sections.purchase_price.estimated_value_min && sections.purchase_price.estimated_value_max && (
                    <p className="text-xs">Wertspanne: <span className="font-medium">{formatCurrency(sections.purchase_price.estimated_value_min)} – {formatCurrency(sections.purchase_price.estimated_value_max)}</span></p>
                  )}
                  {sections.purchase_price.comment && <p className="text-xs text-muted-foreground">{sections.purchase_price.comment}</p>}
                </CardContent></Card>
              )}
              {sections.rental?.comment && (
                <Card><CardContent className="p-4 space-y-1">
                  <h3 className="text-sm font-semibold">Miet-Potenzial</h3>
                  <p className="text-xs text-muted-foreground">{sections.rental.comment}</p>
                </CardContent></Card>
              )}
              {sections.trend?.outlook && (
                <Card><CardContent className="p-4 space-y-1">
                  <h3 className="text-sm font-semibold">Markttrend</h3>
                  <p className="text-xs text-muted-foreground">{sections.trend.outlook}</p>
                </CardContent></Card>
              )}
            </div>
          </section>
        )}

        {/* Units */}
        {units.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-semibold mb-3">Einheiten ({units.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {units.map((u: any) => (
                <Card key={u.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{u.title}</h4>
                      {u.status && <Badge variant="outline" className="text-[10px]">{u.status}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {u.living_area && <span><Maximize className="inline h-3 w-3 mr-1" />{formatArea(Number(u.living_area))}</span>}
                      {u.rooms && <span><Bed className="inline h-3 w-3 mr-1" />{u.rooms}</span>}
                      {u.bathrooms && <span><Bath className="inline h-3 w-3 mr-1" />{u.bathrooms}</span>}
                      {u.floor != null && <span>Etage {u.floor}</span>}
                    </div>
                    <div className="text-sm font-medium">
                      {u.price ? formatCurrency(Number(u.price)) : u.rent ? `${formatCurrency(Number(u.rent))} / Mt.` : "—"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-8 border-t text-center text-xs text-muted-foreground">
          Dieses Exposé wurde über ASIMO Real Estate geteilt.
        </footer>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
