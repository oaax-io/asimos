import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Bed, Bath, Maximize, Calendar, Zap, FileText, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatArea, propertyTypeLabels, propertyStatusLabels, listingTypeLabels } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/properties/$id")({ component: PropertyDetail });

const STATUSES = ["draft","available","reserved","sold","rented","archived"] as const;

function PropertyDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: p, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("properties").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status aktualisiert"); qc.invalidateQueries({ queryKey: ["property", id] }); },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gelöscht"); navigate({ to: "/properties" }); },
  });

  if (isLoading || !p) return <div className="text-sm text-muted-foreground">Lädt…</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" asChild><Link to="/properties"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/properties/$id/expose" params={{ id }}><FileText className="mr-1 h-4 w-4" />Exposé</Link>
          </Button>
          <Select value={p.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { if (confirm("Wirklich löschen?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-[16/10] overflow-hidden rounded-2xl border bg-muted">
            {p.images?.[0] ? (
              <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">Kein Bild</div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
              <Badge variant="secondary">{propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]}</Badge>
              <Badge variant="outline">{listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]}</Badge>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold">{p.title}</h1>
            <p className="mt-2 flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{[p.address, p.postal_code, p.city].filter(Boolean).join(", ") || "—"}</p>
          </div>

          {p.description && (
            <Card><CardContent className="p-6">
              <h2 className="mb-2 font-semibold">Beschreibung</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            </CardContent></Card>
          )}

          {p.features?.length ? (
            <Card><CardContent className="p-6">
              <h2 className="mb-3 font-semibold">Ausstattung</h2>
              <div className="flex flex-wrap gap-2">
                {p.features.map(f => <Badge key={f} variant="secondary">{f}</Badge>)}
              </div>
            </CardContent></Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card><CardContent className="p-6">
            <p className="text-xs uppercase text-muted-foreground">Preis</p>
            <p className="font-display text-3xl font-bold text-gradient-brand">{formatCurrency(p.price ? Number(p.price) : null)}</p>
            {p.area && p.price && (
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(p.price)/Number(p.area))} / m²</p>
            )}
          </CardContent></Card>

          <Card><CardContent className="grid grid-cols-2 gap-4 p-6">
            <Stat icon={Maximize} label="Fläche" value={formatArea(p.area ? Number(p.area) : null)} />
            <Stat icon={Bed} label="Zimmer" value={p.rooms ? String(p.rooms) : "—"} />
            <Stat icon={Bath} label="Bäder" value={p.bathrooms ? String(p.bathrooms) : "—"} />
            <Stat icon={Calendar} label="Baujahr" value={p.year_built ? String(p.year_built) : "—"} />
            <Stat icon={Zap} label="Energie" value={p.energy_class ?? "—"} />
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
