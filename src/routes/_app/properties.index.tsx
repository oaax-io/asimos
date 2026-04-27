import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Bed, Maximize, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatCurrency, formatArea, propertyTypeLabels, propertyStatusLabels, listingTypeLabels } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/properties/")({ component: PropertiesPage });

const PROP_TYPES = ["apartment","house","commercial","land","other"] as const;
const STATUSES = ["draft","available","reserved","sold","rented","archived"] as const;

function PropertiesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", property_type: "apartment", listing_type: "sale", status: "available",
    price: "", rooms: "", bathrooms: "", area: "", year_built: "", energy_class: "",
    address: "", city: "", postal_code: "", features: "", image_url: "",
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      const { error } = await supabase.from("properties").insert({
        agency_id: profile!.agency_id, owner_id: user!.id,
        title: form.title,
        description: form.description || null,
        property_type: form.property_type as any,
        listing_type: form.listing_type as any,
        status: form.status as any,
        price: form.price ? Number(form.price) : null,
        rooms: form.rooms ? Number(form.rooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        area: form.area ? Number(form.area) : null,
        year_built: form.year_built ? Number(form.year_built) : null,
        energy_class: form.energy_class || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        features: form.features ? form.features.split(",").map(s => s.trim()).filter(Boolean) : null,
        images: form.image_url ? [form.image_url] : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Immobilie erstellt");
      qc.invalidateQueries({ queryKey: ["properties"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = properties.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Immobilien"
        description="Dein Immobilienportfolio"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Neue Immobilie</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader><DialogTitle>Neue Immobilie</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Helle 3-Zimmer-Wohnung mit Balkon" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Typ</Label>
                    <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROP_TYPES.map(t => <SelectItem key={t} value={t}>{propertyTypeLabels[t]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Vermarktung</Label>
                    <Select value={form.listing_type} onValueChange={(v) => setForm({ ...form, listing_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="sale">Kauf</SelectItem><SelectItem value="rent">Miete</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div><Label>Preis (€)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                  <div><Label>Fläche (m²)</Label><Input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
                  <div><Label>Zimmer</Label><Input type="number" step="0.5" value={form.rooms} onChange={(e) => setForm({ ...form, rooms: e.target.value })} /></div>
                  <div><Label>Bäder</Label><Input type="number" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div><Label>PLZ</Label><Input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Stadt</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div><Label>Baujahr</Label><Input type="number" value={form.year_built} onChange={(e) => setForm({ ...form, year_built: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Energieklasse</Label><Input value={form.energy_class} onChange={(e) => setForm({ ...form, energy_class: e.target.value })} placeholder="A, B, C…" /></div>
                  <div><Label>Bild-URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" /></div>
                </div>
                <div><Label>Ausstattung (Komma-getrennt)</Label><Input value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Balkon, Aufzug, Einbauküche" /></div>
                <div><Label>Beschreibung</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Suchen nach Titel oder Stadt…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Noch keine Immobilien" description="Erfasse dein erstes Objekt — Titel, Adresse, Preis und Bild reichen zum Start." />
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
                  <span className="font-display text-lg font-bold">{formatCurrency(p.price ? Number(p.price) : null)}</span>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {p.rooms && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{p.rooms}</span>}
                    {p.area && <span className="flex items-center gap-1"><Maximize className="h-3 w-3" />{formatArea(Number(p.area))}</span>}
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
