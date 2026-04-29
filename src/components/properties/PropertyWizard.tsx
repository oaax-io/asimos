import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Home, Building2, Building, Briefcase, TreePine, Car, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { propertyStatusLabels } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* -------------------- Typen -------------------- */

type Structure = "single" | "building" | "unit_in_building";
type Marketing = "sale" | "rent" | "off_market";

const PROP_TYPES = [
  { v: "house",       label: "Einfamilienhaus", icon: Home },
  { v: "mixed_use",   label: "Mehrfamilienhaus", icon: Building2 },
  { v: "apartment",   label: "Wohnung", icon: Building },
  { v: "commercial",  label: "Gewerbe", icon: Briefcase },
  { v: "land",        label: "Grundstück", icon: TreePine },
  { v: "parking",     label: "Parkplatz / Garage", icon: Car },
  { v: "other",       label: "Sonstige", icon: Layers },
] as const;

const STATUSES = ["draft","preparation","active","available","reserved","sold","rented","archived"] as const;

export type Unit = {
  unit_number: string;
  unit_type: string;        // apartment | commercial | parking
  unit_floor: string;
  rooms: string;
  living_area: string;
  price: string;
  rent: string;
  unit_status: string;
  separately_marketable: boolean;
};

export type WizardData = {
  // Schritt 1+2
  property_type: string;
  structure: Structure;
  parent_property_id: string | null;
  // Schritt 3
  title: string;
  marketing_type: Marketing;
  listing_type: "sale" | "rent";
  status: string;
  owner_client_id: string | null;
  assigned_to: string | null;
  // Schritt 4
  address: string;
  postal_code: string;
  city: string;
  country: string;
  floor: string;
  location_description: string;
  // Schritt 5
  living_area: string;
  usable_area: string;
  plot_area: string;
  rooms: string;
  bathrooms: string;
  total_floors: string;
  year_built: string;
  renovated_at: string;
  // Schritt 6
  price: string;
  rent: string;
  ancillary_costs: string;
  reservation_amount_default: string;
  internal_minimum_price: string;
  commission_model: string;
  commission_value: string;
  // Schritt 7
  has_balcony: boolean;
  has_terrace: boolean;
  has_garden: boolean;
  has_lift: boolean;
  has_garage: boolean;
  has_parking: boolean;
  cellar_available: boolean;
  heating_type: string;
  energy_source: string;
  energy_class: string;
  features_extra: string;
  // Schritt 8
  image_url: string;
  description: string;
  internal_notes: string;
  // Schritt 9
  units: Unit[];
};

const empty: WizardData = {
  property_type: "house",
  structure: "single",
  parent_property_id: null,
  title: "",
  marketing_type: "sale",
  listing_type: "sale",
  status: "draft",
  owner_client_id: null,
  assigned_to: null,
  address: "",
  postal_code: "",
  city: "",
  country: "CH",
  floor: "",
  location_description: "",
  living_area: "",
  usable_area: "",
  plot_area: "",
  rooms: "",
  bathrooms: "",
  total_floors: "",
  year_built: "",
  renovated_at: "",
  price: "",
  rent: "",
  ancillary_costs: "",
  reservation_amount_default: "",
  internal_minimum_price: "",
  commission_model: "",
  commission_value: "",
  has_balcony: false,
  has_terrace: false,
  has_garden: false,
  has_lift: false,
  has_garage: false,
  has_parking: false,
  cellar_available: false,
  heating_type: "",
  energy_source: "",
  energy_class: "",
  features_extra: "",
  image_url: "",
  description: "",
  internal_notes: "",
  units: [],
};

/* -------------------- Submit-Payload -------------------- */

export type WizardSubmit = {
  property: Record<string, any>;
  units: Record<string, any>[];
};

function buildFeatures(d: WizardData): string[] {
  const f: string[] = [];
  if (d.has_balcony) f.push("Balkon");
  if (d.has_terrace) f.push("Terrasse");
  if (d.has_garden) f.push("Garten");
  if (d.has_lift) f.push("Lift");
  if (d.has_garage) f.push("Garage");
  if (d.has_parking) f.push("Parkplatz");
  if (d.cellar_available) f.push("Keller");
  if (d.features_extra) {
    d.features_extra.split(",").map(s => s.trim()).filter(Boolean).forEach(x => f.push(x));
  }
  return f;
}

function num(s: string): number | null {
  if (s === "" || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function buildSubmitPayload(d: WizardData): WizardSubmit {
  const isUnit = d.structure === "unit_in_building";
  const isMfh = d.property_type === "mixed_use" || d.structure === "building";
  const listing_type: "sale" | "rent" = d.marketing_type === "rent" ? "rent" : "sale";
  const property: Record<string, any> = {
    title: d.title,
    property_type: d.property_type,
    listing_type,
    status: d.status,
    marketing_type: d.marketing_type,
    building_type: isMfh ? "multi_family" : "single",
    is_unit: isUnit,
    parent_property_id: isUnit ? d.parent_property_id : null,
    owner_client_id: d.owner_client_id,
    seller_client_id: d.owner_client_id,
    assigned_to: d.assigned_to,
    address: d.address || null,
    postal_code: d.postal_code || null,
    city: d.city || null,
    country: d.country || null,
    floor: num(d.floor),
    living_area: num(d.living_area),
    area: num(d.living_area),
    usable_area: num(d.usable_area),
    plot_area: num(d.plot_area),
    rooms: num(d.rooms),
    bathrooms: num(d.bathrooms),
    total_floors: num(d.total_floors),
    year_built: num(d.year_built),
    renovated_at: num(d.renovated_at),
    price: num(d.price),
    rent: num(d.rent),
    reservation_amount_default: num(d.reservation_amount_default),
    internal_minimum_price: num(d.internal_minimum_price),
    heating_type: d.heating_type || null,
    energy_source: d.energy_source || null,
    energy_class: d.energy_class || null,
    description: [d.description, d.location_description ? `\n\nLage: ${d.location_description}` : ""].filter(Boolean).join("") || null,
    internal_notes: d.internal_notes || null,
    features: buildFeatures(d),
    images: d.image_url ? [d.image_url] : null,
  };

  const units = isMfh
    ? d.units.map((u) => ({
        title: u.unit_number ? `Einheit ${u.unit_number}` : "Einheit",
        property_type: u.unit_type || "apartment",
        listing_type,
        status: u.unit_status || "draft",
        is_unit: true,
        unit_number: u.unit_number || null,
        unit_type: u.unit_type || null,
        unit_floor: u.unit_floor || null,
        unit_status: u.unit_status || null,
        rooms: num(u.rooms),
        living_area: num(u.living_area),
        area: num(u.living_area),
        price: num(u.price),
        rent: num(u.rent),
        // Adresse erbt vom Hauptobjekt:
        address: d.address || null,
        postal_code: d.postal_code || null,
        city: d.city || null,
        country: d.country || null,
      }))
    : [];

  return { property, units };
}

/* -------------------- Wizard-Komponente -------------------- */

const STEPS = [
  "Objektart",
  "Struktur",
  "Grunddaten",
  "Adresse",
  "Flächen",
  "Preis",
  "Ausstattung",
  "Medien",
  "Einheiten",
  "Zusammenfassung",
];

export function PropertyWizard({
  open, onOpenChange, onSubmit, submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (payload: WizardSubmit) => void;
  submitting?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<WizardData>({ ...empty });

  useEffect(() => {
    if (open) { setStep(0); setD({ ...empty }); }
  }, [open]);

  const isMfh = d.property_type === "mixed_use" || d.structure === "building";
  const showUnitsStep = isMfh;

  // Schritt 9 überspringen, wenn nicht MFH
  const visibleSteps = useMemo(() => {
    return STEPS.map((label, idx) => ({ idx, label }))
      .filter(s => showUnitsStep || s.idx !== 8);
  }, [showUnitsStep]);

  const employees = useQuery({
    queryKey: ["wizard_employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true);
      return data ?? [];
    },
    enabled: open,
  });

  const owners = useQuery({
    queryKey: ["wizard_owner_clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, email, client_type")
        .in("client_type", ["seller", "landlord", "investor", "other"])
        .order("full_name");
      return data ?? [];
    },
    enabled: open,
  });

  const buildings = useQuery({
    queryKey: ["wizard_parent_buildings"],
    queryFn: async () => {
      const { data } = await supabase.from("properties")
        .select("id, title, address, city")
        .or("property_type.eq.mixed_use,building_type.eq.multi_family")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open && d.structure === "unit_in_building",
  });

  const canProceed = (() => {
    if (step === 2) return !!d.title;
    if (step === 9) return !!d.title && (!!d.address || !!d.city);
    return true;
  })();

  const goNext = () => {
    // Skip Schritt 8 (Einheiten Index 8) wenn nicht MFH
    let next = step + 1;
    if (next === 8 && !showUnitsStep) next = 9;
    if (next > 9) return;
    setStep(next);
  };
  const goBack = () => {
    let prev = step - 1;
    if (prev === 8 && !showUnitsStep) prev = 7;
    if (prev < 0) return;
    setStep(prev);
  };

  const finish = () => {
    onSubmit(buildSubmitPayload(d));
  };

  const update = (patch: Partial<WizardData>) => setD((p) => ({ ...p, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b p-6 pb-4">
          <DialogTitle className="font-display text-xl">Neue Immobilie</DialogTitle>
          <DialogDescription>
            Schritt {visibleSteps.findIndex(s => s.idx === step) + 1} von {visibleSteps.length} · {STEPS[step]}
          </DialogDescription>
          {/* Progress */}
          <div className="mt-3 flex gap-1">
            {visibleSteps.map((s) => (
              <div
                key={s.idx}
                className={cn(
                  "h-1 flex-1 rounded-full transition",
                  s.idx <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {step === 0 && <Step1Type d={d} update={update} />}
          {step === 1 && <Step2Structure d={d} update={update} buildings={buildings.data ?? []} />}
          {step === 2 && <Step3Basics d={d} update={update} owners={owners.data ?? []} employees={employees.data ?? []} />}
          {step === 3 && <Step4Address d={d} update={update} />}
          {step === 4 && <Step5Areas d={d} update={update} />}
          {step === 5 && <Step6Price d={d} update={update} />}
          {step === 6 && <Step7Equipment d={d} update={update} />}
          {step === 7 && <Step8Media d={d} update={update} />}
          {step === 8 && showUnitsStep && <Step9Units d={d} update={update} />}
          {step === 9 && <Step10Summary d={d} owners={owners.data ?? []} employees={employees.data ?? []} />}
        </div>

        <div className="flex items-center justify-between border-t p-4">
          <Button variant="ghost" onClick={goBack} disabled={step === 0 || submitting}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
          </Button>
          <div className="text-xs text-muted-foreground">
            Pflicht: Titel, Objektart, Vermarktung, Status, Adresse oder Ort
          </div>
          {step < 9 ? (
            <Button onClick={goNext} disabled={!canProceed || submitting}>
              Weiter <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={!canProceed || submitting}>
              <Check className="mr-1 h-4 w-4" /> Immobilie speichern
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Schritte -------------------- */

function Step1Type({ d, update }: { d: WizardData; update: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Welche Objektart erfasst du?</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PROP_TYPES.map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            type="button"
            onClick={() => update({ property_type: v })}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-5 text-sm transition hover:border-primary hover:bg-accent",
              d.property_type === v && "border-primary bg-primary/5 ring-2 ring-primary/30"
            )}
          >
            <Icon className="h-7 w-7 text-primary" />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step2Structure({ d, update, buildings }: { d: WizardData; update: (p: Partial<WizardData>) => void; buildings: any[] }) {
  const opts: { v: Structure; label: string; desc: string }[] = [
    { v: "single", label: "Einzelobjekt", desc: "Ein eigenständiges Objekt ohne Untereinheiten." },
    { v: "building", label: "Liegenschaft mit mehreren Einheiten", desc: "Mehrfamilienhaus oder Gebäude mit Wohnungen/Gewerbeeinheiten." },
    { v: "unit_in_building", label: "Einheit innerhalb bestehender Liegenschaft", desc: "Diese Wohnung gehört zu einem bereits erfassten Gebäude." },
  ];
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Wie ist das Objekt strukturiert?</h3>
      <div className="space-y-2">
        {opts.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => update({ structure: o.v })}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition hover:border-primary hover:bg-accent",
              d.structure === o.v && "border-primary bg-primary/5 ring-2 ring-primary/30"
            )}
          >
            <div className="font-medium">{o.label}</div>
            <p className="text-sm text-muted-foreground">{o.desc}</p>
          </button>
        ))}
      </div>
      {d.structure === "unit_in_building" && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <Label>Übergeordnete Liegenschaft</Label>
          <Select value={d.parent_property_id ?? ""} onValueChange={(v) => update({ parent_property_id: v || null })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Liegenschaft wählen" /></SelectTrigger>
            <SelectContent>
              {buildings.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Keine Mehrfamilienhäuser gefunden</div>}
              {buildings.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.title} {b.city ? `· ${b.city}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function Step3Basics({ d, update, owners, employees }: { d: WizardData; update: (p: Partial<WizardData>) => void; owners: any[]; employees: any[] }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Titel *</Label>
        <Input value={d.title} onChange={(e) => update({ title: e.target.value })} placeholder="z. B. Helle 4.5-Zimmer-Wohnung mit Seesicht" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vermarktung</Label>
          <Select value={d.marketing_type} onValueChange={(v: Marketing) => update({ marketing_type: v, listing_type: v === "rent" ? "rent" : "sale" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sale">Verkauf</SelectItem>
              <SelectItem value="rent">Vermietung</SelectItem>
              <SelectItem value="off_market">Off-Market</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={d.status} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Eigentümer</Label>
          <Select value={d.owner_client_id ?? "none"} onValueChange={(v) => update({ owner_client_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keiner</SelectItem>
              {owners.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Zuständiger Mitarbeiter</Label>
          <Select value={d.assigned_to ?? "none"} onValueChange={(v) => update({ assigned_to: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Niemand</SelectItem>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function Step4Address({ d, update }: { d: WizardData; update: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Label>Strasse / Nr.</Label><Input value={d.address} onChange={(e) => update({ address: e.target.value })} /></div>
        <div><Label>Etage</Label><Input value={d.floor} onChange={(e) => update({ floor: e.target.value })} placeholder="z. B. 3" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>PLZ</Label><Input value={d.postal_code} onChange={(e) => update({ postal_code: e.target.value })} /></div>
        <div className="col-span-2"><Label>Ort</Label><Input value={d.city} onChange={(e) => update({ city: e.target.value })} /></div>
      </div>
      <div><Label>Land</Label><Input value={d.country} onChange={(e) => update({ country: e.target.value })} /></div>
      <div>
        <Label>Lagebeschreibung</Label>
        <Textarea rows={3} value={d.location_description} onChange={(e) => update({ location_description: e.target.value })} placeholder="Quartier, Verkehrsanbindung, Aussicht, …" />
      </div>
    </div>
  );
}

function Step5Areas({ d, update }: { d: WizardData; update: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Wohnfläche (m²)</Label><Input type="number" value={d.living_area} onChange={(e) => update({ living_area: e.target.value })} /></div>
        <div><Label>Nutzfläche (m²)</Label><Input type="number" value={d.usable_area} onChange={(e) => update({ usable_area: e.target.value })} /></div>
        <div><Label>Grundstück (m²)</Label><Input type="number" value={d.plot_area} onChange={(e) => update({ plot_area: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div><Label>Zimmer</Label><Input type="number" step="0.5" value={d.rooms} onChange={(e) => update({ rooms: e.target.value })} /></div>
        <div><Label>Bäder</Label><Input type="number" step="0.5" value={d.bathrooms} onChange={(e) => update({ bathrooms: e.target.value })} /></div>
        <div><Label>Etage</Label><Input value={d.floor} onChange={(e) => update({ floor: e.target.value })} /></div>
        <div><Label>Anz. Etagen</Label><Input type="number" value={d.total_floors} onChange={(e) => update({ total_floors: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Baujahr</Label><Input type="number" value={d.year_built} onChange={(e) => update({ year_built: e.target.value })} /></div>
        <div><Label>Renoviert</Label><Input type="number" value={d.renovated_at} onChange={(e) => update({ renovated_at: e.target.value })} /></div>
      </div>
    </div>
  );
}

function Step6Price({ d, update }: { d: WizardData; update: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Verkaufspreis (CHF)</Label><Input type="number" value={d.price} onChange={(e) => update({ price: e.target.value })} /></div>
        <div><Label>Miete / Mt. (CHF)</Label><Input type="number" value={d.rent} onChange={(e) => update({ rent: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nebenkosten (CHF)</Label><Input type="number" value={d.ancillary_costs} onChange={(e) => update({ ancillary_costs: e.target.value })} /></div>
        <div><Label>Reservationsbetrag (CHF)</Label><Input type="number" value={d.reservation_amount_default} onChange={(e) => update({ reservation_amount_default: e.target.value })} /></div>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <Label className="text-amber-700 dark:text-amber-400">Mindestpreis intern (vertraulich)</Label>
        <Input type="number" value={d.internal_minimum_price} onChange={(e) => update({ internal_minimum_price: e.target.value })} />
        <p className="mt-1 text-xs text-muted-foreground">Nur intern sichtbar, erscheint nicht im Exposé.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Provision / Mandatsmodell</Label>
          <Select value={d.commission_model || "none"} onValueChange={(v) => update({ commission_model: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="percent">Prozent vom Verkaufspreis</SelectItem>
              <SelectItem value="fixed">Pauschale</SelectItem>
              <SelectItem value="months_rent">Monatsmieten</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Wert</Label><Input type="number" value={d.commission_value} onChange={(e) => update({ commission_value: e.target.value })} placeholder="z. B. 3" /></div>
      </div>
    </div>
  );
}

function Step7Equipment({ d, update }: { d: WizardData; update: (p: Partial<WizardData>) => void }) {
  const checks: { k: keyof WizardData; label: string }[] = [
    { k: "has_balcony", label: "Balkon" },
    { k: "has_terrace", label: "Terrasse" },
    { k: "has_garden", label: "Garten" },
    { k: "has_lift", label: "Lift" },
    { k: "has_garage", label: "Garage" },
    { k: "has_parking", label: "Parkplatz" },
    { k: "cellar_available", label: "Keller" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {checks.map(c => (
          <label key={c.k} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 hover:bg-accent">
            <Checkbox
              checked={d[c.k] as boolean}
              onCheckedChange={(v) => update({ [c.k]: !!v } as any)}
            />
            <span className="text-sm font-medium">{c.label}</span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Heizung</Label>
          <Select value={d.heating_type || "none"} onValueChange={(v) => update({ heating_type: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="gas">Gas</SelectItem>
              <SelectItem value="oil">Öl</SelectItem>
              <SelectItem value="heat_pump">Wärmepumpe</SelectItem>
              <SelectItem value="district">Fernwärme</SelectItem>
              <SelectItem value="wood">Holz/Pellets</SelectItem>
              <SelectItem value="electric">Elektro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Energiequelle</Label>
          <Input value={d.energy_source} onChange={(e) => update({ energy_source: e.target.value })} placeholder="z. B. Solar" />
        </div>
        <div><Label>Energieklasse</Label><Input value={d.energy_class} onChange={(e) => update({ energy_class: e.target.value })} placeholder="A, B, C…" /></div>
      </div>
      <div>
        <Label>Weitere Features (Komma-getrennt)</Label>
        <Input value={d.features_extra} onChange={(e) => update({ features_extra: e.target.value })} placeholder="Cheminée, Whirlpool, Smart Home" />
      </div>
    </div>
  );
}

function Step8Media({ d, update }: { d: WizardData; update: (p: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Hauptbild-URL</Label>
        <Input value={d.image_url} onChange={(e) => update({ image_url: e.target.value })} placeholder="https://…" />
        <p className="mt-1 text-xs text-muted-foreground">Weitere Bilder, Grundrisse und Dokumente kannst du nach dem Erstellen über die Tabs Medien & Dokumente hochladen.</p>
      </div>
      <div>
        <Label>Beschreibung</Label>
        <Textarea rows={4} value={d.description} onChange={(e) => update({ description: e.target.value })} placeholder="Kurze Objektbeschreibung für Exposé und Inserate" />
      </div>
      <div>
        <Label>Interne Notizen</Label>
        <Textarea rows={3} value={d.internal_notes} onChange={(e) => update({ internal_notes: e.target.value })} placeholder="Nur intern sichtbar" />
      </div>
    </div>
  );
}

function Step9Units({ d, update }: { d: WizardData; update: (p: Partial<WizardData>) => void }) {
  const addUnit = () => {
    update({
      units: [
        ...d.units,
        {
          unit_number: "",
          unit_type: "apartment",
          unit_floor: "",
          rooms: "",
          living_area: "",
          price: "",
          rent: "",
          unit_status: "draft",
          separately_marketable: true,
        },
      ],
    });
  };
  const removeUnit = (i: number) => update({ units: d.units.filter((_, idx) => idx !== i) });
  const patchUnit = (i: number, patch: Partial<Unit>) =>
    update({ units: d.units.map((u, idx) => idx === i ? { ...u, ...patch } : u) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Erfasse die einzelnen Wohnungen / Einheiten dieser Liegenschaft. Du kannst weitere später hinzufügen.
        </p>
        <Button size="sm" onClick={addUnit}><Plus className="mr-1 h-4 w-4" />Einheit hinzufügen</Button>
      </div>
      {d.units.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Noch keine Einheiten erfasst.
        </div>
      )}
      <div className="space-y-3">
        {d.units.map((u, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Einheit {i + 1}</Badge>
                <Button size="sm" variant="ghost" onClick={() => removeUnit(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Bezeichnung / Nr.</Label><Input value={u.unit_number} onChange={(e) => patchUnit(i, { unit_number: e.target.value })} placeholder="z. B. 1A" /></div>
                <div>
                  <Label>Typ</Label>
                  <Select value={u.unit_type} onValueChange={(v) => patchUnit(i, { unit_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">Wohnung</SelectItem>
                      <SelectItem value="commercial">Gewerbe</SelectItem>
                      <SelectItem value="parking">Parkplatz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Etage</Label><Input value={u.unit_floor} onChange={(e) => patchUnit(i, { unit_floor: e.target.value })} placeholder="EG, 1, 2…" /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Zimmer</Label><Input type="number" step="0.5" value={u.rooms} onChange={(e) => patchUnit(i, { rooms: e.target.value })} /></div>
                <div><Label>Wohnfläche m²</Label><Input type="number" value={u.living_area} onChange={(e) => patchUnit(i, { living_area: e.target.value })} /></div>
                <div><Label>Preis CHF</Label><Input type="number" value={u.price} onChange={(e) => patchUnit(i, { price: e.target.value })} /></div>
                <div><Label>Miete CHF</Label><Input type="number" value={u.rent} onChange={(e) => patchUnit(i, { rent: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={u.unit_status} onValueChange={(v) => patchUnit(i, { unit_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <label className="mt-6 flex items-center gap-2 text-sm">
                  <Checkbox checked={u.separately_marketable} onCheckedChange={(v) => patchUnit(i, { separately_marketable: !!v })} />
                  Separat vermarktbar
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Step10Summary({ d, owners, employees }: { d: WizardData; owners: any[]; employees: any[] }) {
  const owner = owners.find(o => o.id === d.owner_client_id);
  const emp = employees.find(e => e.id === d.assigned_to);
  const rows: [string, string][] = [
    ["Objektart", PROP_TYPES.find(p => p.v === d.property_type)?.label ?? d.property_type],
    ["Struktur", d.structure === "single" ? "Einzelobjekt" : d.structure === "building" ? "Liegenschaft mit Einheiten" : "Einheit in Liegenschaft"],
    ["Titel", d.title || "—"],
    ["Vermarktung", d.marketing_type === "sale" ? "Verkauf" : d.marketing_type === "rent" ? "Vermietung" : "Off-Market"],
    ["Status", propertyStatusLabels[d.status as keyof typeof propertyStatusLabels] ?? d.status],
    ["Adresse", [d.address, d.postal_code, d.city].filter(Boolean).join(", ") || "—"],
    ["Wohnfläche", d.living_area ? `${d.living_area} m²` : "—"],
    ["Zimmer", d.rooms || "—"],
    ["Verkaufspreis", d.price ? `CHF ${d.price}` : "—"],
    ["Miete", d.rent ? `CHF ${d.rent}` : "—"],
    ["Eigentümer", owner?.full_name ?? "—"],
    ["Zuständig", emp?.full_name || emp?.email || "—"],
    ["Einheiten", d.units.length ? String(d.units.length) : "—"],
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Bitte prüfe die Angaben und speichere die Immobilie.</p>
      <Card><CardContent className="p-0">
        <dl className="divide-y">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-3 gap-4 px-5 py-2.5 text-sm">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="col-span-2 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent></Card>
      {d.units.length > 0 && (
        <Card><CardContent className="p-4">
          <h4 className="mb-2 text-sm font-semibold">Einheiten ({d.units.length})</h4>
          <ul className="space-y-1 text-sm">
            {d.units.map((u, i) => (
              <li key={i} className="flex justify-between border-b py-1 last:border-0">
                <span>{u.unit_number || `Einheit ${i + 1}`} · {u.unit_type}</span>
                <span className="text-muted-foreground">{u.rooms ? `${u.rooms} Zi · ` : ""}{u.living_area ? `${u.living_area} m²` : ""}</span>
              </li>
            ))}
          </ul>
        </CardContent></Card>
      )}
    </div>
  );
}
