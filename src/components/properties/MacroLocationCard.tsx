import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, MapPin, Train, GraduationCap, ShoppingBag, HeartPulse,
  Trees, Shield, Briefcase, Users, Mountain, Theater, Star, Plane, Car, Building2, TrendingUp,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  transport: Train,
  education: GraduationCap,
  shopping: ShoppingBag,
  healthcare: HeartPulse,
  leisure: Trees,
  safety: Shield,
  economy: Briefcase,
  demographics: Users,
  nature: Mountain,
  culture: Theater,
};

function Stars({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

export function MacroLocationCard({ property }: { property: any }) {
  const qc = useQueryClient();
  const macro = property.macro_location as any | null;
  const [open, setOpen] = useState(false);

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("property-macro-location", {
        body: { property },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Makrolage generiert");
      qc.invalidateQueries({ queryKey: ["property", property.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Generierung fehlgeschlagen"),
  });

  if (!macro) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-display text-base font-semibold">Makrolage-Analyse</h3>
          <p className="text-sm text-muted-foreground">
            Lass die KI eine vollständige Makrolage-Analyse mit Verkehrsanbindung, Infrastruktur, Demografie und Wirtschaft erstellen.
          </p>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generate.isPending ? "Analysiert…" : "Makrolage mit KI generieren"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const cats: any[] = Array.isArray(macro.categories) ? macro.categories : [];
  const visible = open ? cats : cats.slice(0, 6);

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Makrolage</h2>
              {typeof macro.score === "number" && (
                <Badge variant="secondary" className="ml-1">{macro.score}/10</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {[macro.municipality, macro.region].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generate.isPending ? "animate-spin" : ""}`} />
            Neu generieren
          </Button>
        </div>

        {macro.summary && (
          <p className="text-sm leading-relaxed text-muted-foreground">{macro.summary}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((c, i) => {
            const Icon = ICON_MAP[c.key] ?? MapPin;
            return (
              <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="font-medium text-sm">{c.title}</div>
                  </div>
                  {typeof c.rating === "number" && <Stars n={c.rating} />}
                </div>
                {c.description && <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>}
                {Array.isArray(c.highlights) && c.highlights.length > 0 && (
                  <ul className="space-y-0.5">
                    {c.highlights.map((h: string, j: number) => (
                      <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-primary">•</span><span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        {cats.length > 6 && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? "Weniger anzeigen" : `Alle ${cats.length} Kategorien anzeigen`}
          </Button>
        )}

        {macro.connectivity && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Train className="h-4 w-4 text-primary" />Erreichbarkeit</h3>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              {macro.connectivity.public_transport && (
                <div className="flex gap-2"><Train className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.public_transport}</span></div>
              )}
              {macro.connectivity.highway && (
                <div className="flex gap-2"><Car className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.highway}</span></div>
              )}
              {macro.connectivity.airport && (
                <div className="flex gap-2"><Plane className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.airport}</span></div>
              )}
              {macro.connectivity.city_center && (
                <div className="flex gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.connectivity.city_center}</span></div>
              )}
            </div>
          </div>
        )}

        {macro.demographics && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Demografie & Wirtschaft</h3>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              {macro.demographics.population && <div><span className="text-muted-foreground">Einwohner: </span>{macro.demographics.population}</div>}
              {macro.demographics.tax_rate && <div><span className="text-muted-foreground">Steuern: </span>{macro.demographics.tax_rate}</div>}
              {macro.demographics.income_level && <div><span className="text-muted-foreground">Einkommen: </span>{macro.demographics.income_level}</div>}
              {macro.demographics.development && <div className="sm:col-span-2 flex gap-2"><TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /><span>{macro.demographics.development}</span></div>}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {Array.isArray(macro.strengths) && macro.strengths.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">Stärken</h4>
              <ul className="space-y-1">
                {macro.strengths.map((s: string, i: number) => (
                  <li key={i} className="text-xs flex gap-1.5"><span className="text-emerald-600">+</span><span>{s}</span></li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(macro.weaknesses) && macro.weaknesses.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">Schwächen</h4>
              <ul className="space-y-1">
                {macro.weaknesses.map((s: string, i: number) => (
                  <li key={i} className="text-xs flex gap-1.5"><span className="text-amber-600">−</span><span>{s}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {macro.generated_at && (
          <p className="text-[10px] text-muted-foreground text-right">
            Generiert: {new Date(macro.generated_at).toLocaleString("de-CH")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
