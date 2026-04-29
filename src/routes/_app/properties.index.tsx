import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Bed, Maximize, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatCurrency, formatArea, propertyTypeLabels, propertyStatusLabels, listingTypeLabels } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { PropertyWizard, type WizardSubmit } from "@/components/properties/PropertyWizard";

export const Route = createFileRoute("/_app/properties/")({ component: PropertiesPage });

const PROP_TYPES = ["apartment","house","commercial","land","parking","mixed_use","other"] as const;
const STATUSES = ["draft","preparation","active","available","reserved","sold","rented","archived"] as const;

function PropertiesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fType, setFType] = useState<string>("all");
  const [fListing, setFListing] = useState<string>("all");
  const [fCity, setFCity] = useState<string>("all");
  const [fAssigned, setFAssigned] = useState<string>("all");

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const cities = useMemo(() => Array.from(new Set(properties.map(p => p.city).filter(Boolean))) as string[], [properties]);

  const create = useMutation({
    mutationFn: async (payload: WizardSubmit) => {
      const propPayload = { ...payload.property, owner_id: user!.id };
      const { data: created, error } = await supabase
        .from("properties")
        .insert(propPayload as any)
        .select("id")
        .single();
      if (error) throw error;
      if (payload.units.length > 0 && created?.id) {
        const unitsPayload = payload.units.map((u) => ({
          ...u,
          owner_id: user!.id,
          parent_property_id: created.id,
        }));
        const { error: uErr } = await supabase.from("properties").insert(unitsPayload as any);
        if (uErr) throw uErr;
      }
      if (payload.media.length > 0 && created?.id) {
        const mediaRows = payload.media.map((m, i) => ({
          property_id: created.id,
          file_url: m.file_url,
          file_name: m.file_name,
          file_type: m.file_type,
          title: m.title,
          is_cover: m.is_cover,
          sort_order: i + 1,
        }));
        const { error: mErr } = await supabase.from("property_media").insert(mediaRows as any);
        if (mErr) throw mErr;
      }
      return created;
    },
    onSuccess: () => {
      toast.success("Immobilie erstellt");
      qc.invalidateQueries({ queryKey: ["properties"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = properties.filter(p => {
    if (search && !(`${p.title} ${p.city ?? ""} ${p.address ?? ""}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (fStatus !== "all" && p.status !== fStatus) return false;
    if (fType !== "all" && p.property_type !== fType) return false;
    if (fListing !== "all" && p.listing_type !== fListing) return false;
    if (fCity !== "all" && p.city !== fCity) return false;
    if (fAssigned !== "all" && p.assigned_to !== fAssigned) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Immobilien"
        description="Dein Immobilienportfolio im Überblick"
        action={
          <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Neue Immobilie</Button>
        }
      />

      <PropertyWizard
        open={open}
        onOpenChange={setOpen}
        onSubmit={(payload) => create.mutate(payload)}
        submitting={create.isPending}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fType} onValueChange={setFType}>
          <SelectTrigger><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {PROP_TYPES.map(t => <SelectItem key={t} value={t}>{propertyTypeLabels[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fListing} onValueChange={setFListing}>
          <SelectTrigger><SelectValue placeholder="Vermarktung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kauf & Miete</SelectItem>
            <SelectItem value="sale">Kauf</SelectItem>
            <SelectItem value="rent">Miete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fCity} onValueChange={setFCity}>
          <SelectTrigger><SelectValue placeholder="Stadt" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Städte</SelectItem>
            {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fAssigned} onValueChange={setFAssigned}>
          <SelectTrigger><SelectValue placeholder="Zuständig" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
            {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lädt…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={properties.length === 0 ? "Noch keine Immobilien" : "Keine Treffer"}
          description={properties.length === 0
            ? "Erfasse dein erstes Objekt — Titel, Adresse, Preis und Bild reichen zum Start."
            : "Passe die Filter an oder leere die Suche."}
          action={properties.length === 0 ? (
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Neue Immobilie</Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <Link key={p.id} to="/properties/$id" params={{ id: p.id }} className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:shadow-glow">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">Kein Bild</div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-xs">{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
                  <span className="text-xs text-muted-foreground">{listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]}</span>
                </div>
                <h3 className="mt-2 line-clamp-1 font-semibold">{p.title}</h3>
                <p className="mt-1 line-clamp-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />{[p.address, p.city].filter(Boolean).join(", ") || "—"}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display text-lg font-bold">
                    {formatCurrency(p.listing_type === "rent" ? (p.rent ? Number(p.rent) : null) : (p.price ? Number(p.price) : null))}
                    {p.listing_type === "rent" && p.rent ? <span className="text-xs font-normal text-muted-foreground"> /Mt.</span> : null}
                  </span>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {p.rooms && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{p.rooms}</span>}
                    {(p.living_area || p.area) && <span className="flex items-center gap-1"><Maximize className="h-3 w-3" />{formatArea(Number(p.living_area || p.area))}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
