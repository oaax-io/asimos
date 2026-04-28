import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { propertyStatusLabels, propertyTypeLabels } from "@/lib/format";

const PROP_TYPES = ["apartment","house","commercial","land","parking","mixed_use","other"] as const;
const STATUSES = ["draft","preparation","active","available","reserved","sold","rented","archived"] as const;

export type PropertyFormValues = {
  title: string;
  description: string | null;
  property_type: string;
  listing_type: string;
  status: string;
  price: number | null;
  rent: number | null;
  rooms: number | null;
  bathrooms: number | null;
  living_area: number | null;
  area: number | null;
  plot_area: number | null;
  year_built: number | null;
  renovated_at: number | null;
  energy_class: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  features: string[] | null;
  images: string[] | null;
  internal_notes: string | null;
  assigned_to: string | null;
};

const empty = {
  title: "", description: "",
  property_type: "apartment", listing_type: "sale", status: "draft",
  price: "", rent: "", rooms: "", bathrooms: "",
  living_area: "", plot_area: "", year_built: "", renovated_at: "",
  address: "", city: "", postal_code: "", country: "DE",
  energy_class: "", features: "", image_url: "",
  internal_notes: "", assigned_to: "",
};

export function PropertyFormDialog({
  open, onOpenChange, employees = [], initial, onSubmit, submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees?: { id: string; full_name: string | null; email: string | null }[];
  initial?: Partial<Record<keyof PropertyFormValues, any>> & { images?: string[] | null; features?: string[] | null };
  onSubmit: (values: Partial<PropertyFormValues>) => void;
  submitting?: boolean;
}) {
  const [f, setF] = useState({ ...empty });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setF({
        title: initial.title ?? "",
        description: initial.description ?? "",
        property_type: initial.property_type ?? "apartment",
        listing_type: initial.listing_type ?? "sale",
        status: initial.status ?? "draft",
        price: initial.price != null ? String(initial.price) : "",
        rent: initial.rent != null ? String(initial.rent) : "",
        rooms: initial.rooms != null ? String(initial.rooms) : "",
        bathrooms: initial.bathrooms != null ? String(initial.bathrooms) : "",
        living_area: initial.living_area != null ? String(initial.living_area) : "",
        plot_area: initial.plot_area != null ? String(initial.plot_area) : "",
        year_built: initial.year_built != null ? String(initial.year_built) : "",
        renovated_at: initial.renovated_at != null ? String(initial.renovated_at) : "",
        address: initial.address ?? "",
        city: initial.city ?? "",
        postal_code: initial.postal_code ?? "",
        country: initial.country ?? "DE",
        energy_class: initial.energy_class ?? "",
        features: Array.isArray(initial.features) ? initial.features.join(", ") : "",
        image_url: Array.isArray(initial.images) ? (initial.images[0] ?? "") : "",
        internal_notes: initial.internal_notes ?? "",
        assigned_to: initial.assigned_to ?? "",
      });
    } else {
      setF({ ...empty });
    }
  }, [open, initial]);

  const handleSubmit = () => {
    const values: Partial<PropertyFormValues> = {
      title: f.title,
      description: f.description || null,
      property_type: f.property_type,
      listing_type: f.listing_type,
      status: f.status,
      price: f.price ? Number(f.price) : null,
      rent: f.rent ? Number(f.rent) : null,
      rooms: f.rooms ? Number(f.rooms) : null,
      bathrooms: f.bathrooms ? Number(f.bathrooms) : null,
      living_area: f.living_area ? Number(f.living_area) : null,
      area: f.living_area ? Number(f.living_area) : null,
      plot_area: f.plot_area ? Number(f.plot_area) : null,
      year_built: f.year_built ? Number(f.year_built) : null,
      renovated_at: f.renovated_at ? Number(f.renovated_at) : null,
      address: f.address || null,
      city: f.city || null,
      postal_code: f.postal_code || null,
      country: f.country || null,
      energy_class: f.energy_class || null,
      features: f.features ? f.features.split(",").map(s => s.trim()).filter(Boolean) : null,
      images: f.image_url ? [f.image_url] : null,
      internal_notes: f.internal_notes || null,
      assigned_to: f.assigned_to || null,
    };
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Immobilie bearbeiten" : "Neue Immobilie"}</DialogTitle>
          <DialogDescription>Erfasse die wichtigsten Eckdaten. Du kannst alles später ergänzen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titel *</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Helle 3-Zimmer-Wohnung mit Balkon" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Typ</Label>
              <Select value={f.property_type} onValueChange={(v) => setF({ ...f, property_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROP_TYPES.map(t => <SelectItem key={t} value={t}>{propertyTypeLabels[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vermarktung</Label>
              <Select value={f.listing_type} onValueChange={(v) => setF({ ...f, listing_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Kauf</SelectItem>
                  <SelectItem value="rent">Miete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div><Label>Kaufpreis (CHF)</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><Label>Miete / Mt. (CHF)</Label><Input type="number" value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value })} /></div>
            <div><Label>Zimmer</Label><Input type="number" step="0.5" value={f.rooms} onChange={(e) => setF({ ...f, rooms: e.target.value })} /></div>
            <div><Label>Bäder</Label><Input type="number" step="0.5" value={f.bathrooms} onChange={(e) => setF({ ...f, bathrooms: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div><Label>Wohnfläche (m²)</Label><Input type="number" value={f.living_area} onChange={(e) => setF({ ...f, living_area: e.target.value })} /></div>
            <div><Label>Grundstück (m²)</Label><Input type="number" value={f.plot_area} onChange={(e) => setF({ ...f, plot_area: e.target.value })} /></div>
            <div><Label>Baujahr</Label><Input type="number" value={f.year_built} onChange={(e) => setF({ ...f, year_built: e.target.value })} /></div>
            <div><Label>Renoviert</Label><Input type="number" value={f.renovated_at} onChange={(e) => setF({ ...f, renovated_at: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-3"><Label>Adresse</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
            <div className="col-span-1"><Label>PLZ</Label><Input value={f.postal_code} onChange={(e) => setF({ ...f, postal_code: e.target.value })} /></div>
            <div className="col-span-2"><Label>Ort</Label><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><Label>Land</Label><Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></div>
            <div><Label>Energieklasse</Label><Input value={f.energy_class} onChange={(e) => setF({ ...f, energy_class: e.target.value })} placeholder="A, B, C…" /></div>
            <div>
              <Label>Zuständig</Label>
              <Select value={f.assigned_to || "none"} onValueChange={(v) => setF({ ...f, assigned_to: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Niemand</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Hauptbild-URL</Label><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="https://…" /></div>
          <div><Label>Ausstattung (Komma-getrennt)</Label><Input value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} placeholder="Balkon, Aufzug, Einbauküche" /></div>
          <div><Label>Beschreibung</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>Interne Notizen</Label><Textarea rows={3} value={f.internal_notes} onChange={(e) => setF({ ...f, internal_notes: e.target.value })} placeholder="Nur intern sichtbar" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={!f.title || submitting}>{initial ? "Speichern" : "Erstellen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
