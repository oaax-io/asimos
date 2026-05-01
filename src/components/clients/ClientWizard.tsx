// Rollenbasierter Kunden-Wizard.
// Flow: Entity (Privat/Firma) -> Rolle -> dynamische Schritte je nach Rolle -> Review.
// Schreibt in: clients (Stammdaten), client_roles (Rollenkontext),
// client_search_profiles (Suchprofile), property_ownerships (Eigentum),
// client_relationships (Kontaktperson <-> Firma), activity_logs.
// Schweizer Rechtschreibung, kein ß.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Check, Loader2, User, Building2, Mail,
  Target, Wallet, Home, Users, ClipboardCheck, Tag, Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { propertyTypeLabels } from "@/lib/format";

// ----- Typen -----
type EntityType = "person" | "company";

type RoleChoice =
  | "buyer"               // Käufer / Suchkunde
  | "seller_owner"        // Verkäufer / Eigentümer
  | "tenant"              // Mieter
  | "landlord"            // Vermieter
  | "financing_applicant" // Finanzierungskunde
  | "investor"            // Investor
  | "general_contact";    // Allgemeiner Kontakt

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (clientId: string) => void;
}

// ----- Konstanten -----
const ROLE_OPTIONS: {
  value: RoleChoice; label: string; description: string; icon: typeof Tag;
}[] = [
  { value: "buyer",               label: "Käufer / Suchkunde",     description: "Sucht eine Immobilie zum Kauf",          icon: Target },
  { value: "seller_owner",        label: "Verkäufer / Eigentümer", description: "Bietet eine Immobilie an oder besitzt eine", icon: Home },
  { value: "tenant",              label: "Mieter",                 description: "Sucht eine Mietwohnung",                 icon: User },
  { value: "landlord",            label: "Vermieter",              description: "Vermietet eine Immobilie",               icon: Building2 },
  { value: "financing_applicant", label: "Finanzierungskunde",     description: "Benötigt Finanzierungsberatung",         icon: Wallet },
  { value: "investor",            label: "Investor",               description: "Sucht Renditeobjekte",                   icon: Briefcase },
  { value: "general_contact",     label: "Allgemeiner Kontakt",    description: "Sonstiger Kontakt ohne klare Rolle",     icon: Mail },
];

const ROLE_TO_DB_ROLE: Record<RoleChoice, string> = {
  buyer: "buyer",
  seller_owner: "seller",
  tenant: "tenant",
  landlord: "landlord",
  financing_applicant: "financing_applicant",
  investor: "investor",
  general_contact: "general_contact",
};

const ROLE_TO_CLIENT_TYPE: Record<RoleChoice, string> = {
  buyer: "buyer",
  seller_owner: "seller",
  tenant: "tenant",
  landlord: "landlord",
  financing_applicant: "other",
  investor: "investor",
  general_contact: "other",
};

const PROP_TYPES = ["apartment", "house", "commercial", "land", "mixed_use", "other"] as const;
const FINANCING_GOALS: { value: string; label: string }[] = [
  { value: "purchase",           label: "Immobilienkauf" },
  { value: "renovation",         label: "Renovation" },
  { value: "increase",           label: "Aufstockung" },
  { value: "refinance",          label: "Refinanzierung" },
  { value: "new_build",          label: "Neubau" },
  { value: "mortgage_increase",  label: "Hypothekenerhöhung" },
];

// ----- Form State -----
type FormState = {
  entity_type: EntityType;
  role_choice: RoleChoice | "";

  // Person
  salutation: string;
  first_name: string;
  last_name: string;

  // Firma
  company_name: string;
  contact_mode: "manual" | "existing";
  linked_contact_client_id: string;
  contact_first_name: string;
  contact_last_name: string;

  // Kontakt
  email: string;
  phone: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;

  // Suchprofil (Käufer/Mieter/Investor)
  preferred_listing: "sale" | "rent" | "";
  preferred_cities: string;
  preferred_types: string[];
  budget_min: string;
  budget_max: string;
  rooms_min: string;
  area_min: string;
  yield_target: string;
  usage_types: string[];

  // Finanzierung
  equity: string;
  financing_status: string;
  financing_goal: string;

  // Eigentum (Verkäufer/Vermieter/Eigentümer)
  property_mode: "existing" | "new" | "none";
  selected_property_id: string;
  new_property_title: string;
  new_property_address: string;
  new_property_postal_code: string;
  new_property_city: string;
  new_property_type: string;
  new_property_price: string;
  ownership_share: string;
  ownership_start_date: string;
  ownership_notes: string;

  // Allgemein
  tags: string;
  notes: string;
};

const empty: FormState = {
  entity_type: "person", role_choice: "",
  salutation: "", first_name: "", last_name: "",
  company_name: "", contact_mode: "manual", linked_contact_client_id: "",
  contact_first_name: "", contact_last_name: "",
  email: "", phone: "", street: "", postal_code: "", city: "", country: "CH",
  preferred_listing: "", preferred_cities: "", preferred_types: [],
  budget_min: "", budget_max: "", rooms_min: "", area_min: "",
  yield_target: "", usage_types: [],
  equity: "", financing_status: "", financing_goal: "purchase",
  property_mode: "none", selected_property_id: "",
  new_property_title: "", new_property_address: "", new_property_postal_code: "",
  new_property_city: "", new_property_type: "apartment", new_property_price: "",
  ownership_share: "", ownership_start_date: new Date().toISOString().slice(0, 10),
  ownership_notes: "",
  tags: "", notes: "",
};

const num = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ----- Dynamische Schritte je nach Rolle -----
type StepKey = "entity" | "role" | "stamm" | "company_contact" | "search"
  | "investment" | "financing" | "property" | "ownership" | "tags" | "review";

function buildSteps(entity: EntityType, role: RoleChoice | ""): StepKey[] {
  const s: StepKey[] = ["entity", "role"];
  if (!role) return s;
  s.push("stamm");
  if (entity === "company") s.push("company_contact");
  switch (role) {
    case "buyer":
    case "tenant":
      s.push("search");
      if (role === "buyer") s.push("financing");
      break;
    case "investor":
      s.push("investment");
      break;
    case "seller_owner":
    case "landlord":
      s.push("property", "ownership");
      break;
    case "financing_applicant":
      s.push("financing", "property");
      break;
    case "general_contact":
      s.push("tags");
      break;
  }
  s.push("review");
  return s;
}

const STEP_LABELS: Record<StepKey, string> = {
  entity: "Art",
  role: "Rolle",
  stamm: "Stammdaten",
  company_contact: "Kontaktperson",
  search: "Suchprofil",
  investment: "Investment-Profil",
  financing: "Finanzierung",
  property: "Immobilie",
  ownership: "Eigentum",
  tags: "Notizen & Tags",
  review: "Übersicht",
};

// ===========================================================
export function ClientWizard({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<FormState>(empty);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const steps = useMemo(() => buildSteps(form.entity_type, form.role_choice as RoleChoice | ""), [form.entity_type, form.role_choice]);
  const currentStep = steps[Math.min(stepIdx, steps.length - 1)];

  // ---- Daten für Selects ----
  const personClientsQuery = useQuery({
    queryKey: ["clients-persons-for-link"],
    enabled: open && form.entity_type === "company",
    queryFn: async () => {
      const { data } = await supabase.from("clients")
        .select("id, full_name, email")
        .eq("entity_type", "person").eq("is_archived", false).order("full_name");
      return data ?? [];
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ["properties-for-wizard"],
    enabled: open && (form.role_choice === "seller_owner" || form.role_choice === "landlord" || form.role_choice === "financing_applicant"),
    queryFn: async () => {
      const { data } = await supabase.from("properties")
        .select("id, title, city, address").order("title");
      return data ?? [];
    },
  });

  // ---- Validation ----
  const personName = `${form.first_name} ${form.last_name}`.trim();
  const fullName = form.entity_type === "company" ? form.company_name.trim() : personName;
  const canSave = !!form.role_choice && fullName.length > 0;

  const reset = () => { setForm(empty); setStepIdx(0); };

  // ---- Save ----
  const create = useMutation({
    mutationFn: async () => {
      if (!form.role_choice) throw new Error("Bitte Rolle wählen");
      if (!fullName) throw new Error(form.entity_type === "company"
        ? "Firmenname ist erforderlich"
        : "Vor- und Nachname sind erforderlich");

      const role = form.role_choice as RoleChoice;
      const { data: userData } = await supabase.auth.getUser();
      const owner_id = userData.user?.id ?? null;

      // 1) Client
      const clientPayload: any = {
        full_name: fullName,
        entity_type: form.entity_type,
        company_name: form.entity_type === "company" ? (form.company_name || null) : null,
        contact_first_name: form.entity_type === "company"
          ? (form.contact_mode === "manual" ? (form.contact_first_name || null) : null)
          : null,
        contact_last_name: form.entity_type === "company"
          ? (form.contact_mode === "manual" ? (form.contact_last_name || null) : null)
          : null,
        email: form.email || null,
        phone: form.phone || null,
        client_type: ROLE_TO_CLIENT_TYPE[role] as any,
        notes: form.notes || null,
        owner_id,
        address: form.street || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        country: form.country || null,
        equity: num(form.equity),
        financing_status: form.financing_status || null,
      };
      const { data: client, error: clientErr } = await supabase
        .from("clients").insert(clientPayload).select("id").single();
      if (clientErr) throw clientErr;
      const clientId = client.id as string;

      // 2) Hauptrolle in client_roles
      const dbRole = ROLE_TO_DB_ROLE[role];
      const { error: roleErr } = await supabase.from("client_roles").insert({
        client_id: clientId,
        role_type: dbRole as any,
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
      });
      if (roleErr) console.warn("Rolle:", roleErr);

      // 3) Firma -> Kontaktperson
      if (form.entity_type === "company") {
        if (form.contact_mode === "existing" && form.linked_contact_client_id) {
          // Verknüpfen über client_relationships
          const { error: relErr } = await supabase.from("client_relationships").insert({
            client_id: clientId,
            related_client_id: form.linked_contact_client_id,
            relationship_type: "other" as any,
            notes: "Kontaktperson",
          });
          if (relErr) console.warn("Relationship:", relErr);
          // Zusätzlich client_roles contact_person für die verknüpfte Person
          await supabase.from("client_roles").insert({
            client_id: form.linked_contact_client_id,
            role_type: "contact_person" as any,
            status: "active",
            start_date: new Date().toISOString().slice(0, 10),
            related_id: clientId,
            related_type: "client",
            notes: `Kontaktperson für ${fullName}`,
          });
        }
      }

      // 4) Suchprofil
      if (role === "buyer" || role === "tenant" || role === "investor") {
        const profilePayload: any = {
          client_id: clientId,
          role_type: dbRole as any,
          listing_type: role === "tenant" ? "rent" : (form.preferred_listing || (role === "investor" ? "sale" : "sale")),
          preferred_cities: form.preferred_cities
            ? form.preferred_cities.split(",").map((s) => s.trim()).filter(Boolean) : null,
          preferred_property_types: form.preferred_types.length ? form.preferred_types : null,
          budget_min: num(form.budget_min),
          budget_max: num(form.budget_max),
          rooms_min: num(form.rooms_min),
          area_min: num(form.area_min),
          yield_target: role === "investor" ? num(form.yield_target) : null,
          usage_types: role === "investor" && form.usage_types.length ? form.usage_types : null,
          notes: null,
        };
        const { error: spErr } = await supabase.from("client_search_profiles").insert(profilePayload);
        if (spErr) console.warn("Suchprofil:", spErr);
      }

      // 5) Eigentum / Immobilie (Verkäufer/Vermieter/Eigentümer)
      let createdPropertyId: string | null = null;
      if (role === "seller_owner" || role === "landlord") {
        let propertyId: string | null = null;
        if (form.property_mode === "existing" && form.selected_property_id) {
          propertyId = form.selected_property_id;
        } else if (form.property_mode === "new" && form.new_property_title.trim()) {
          const { data: prop, error: propErr } = await supabase.from("properties").insert({
            title: form.new_property_title,
            address: form.new_property_address || null,
            postal_code: form.new_property_postal_code || null,
            city: form.new_property_city || null,
            property_type: form.new_property_type as any,
            listing_type: (role === "landlord" ? "rent" : "sale") as any,
            status: "draft" as any,
            price: num(form.new_property_price),
            owner_client_id: clientId,
            owner_id,
          }).select("id").single();
          if (propErr) console.warn("Immobilie:", propErr);
          propertyId = prop?.id ?? null;
          createdPropertyId = propertyId;
        }

        if (propertyId) {
          // Owner-Rolle für Client mit Bezug zur Immobilie
          await supabase.from("client_roles").insert({
            client_id: clientId,
            role_type: "owner" as any,
            status: "active",
            start_date: form.ownership_start_date || new Date().toISOString().slice(0, 10),
            related_id: propertyId,
            related_type: "property",
            notes: form.ownership_notes || null,
          });

          // property_ownerships Eintrag
          await supabase.from("property_ownerships").insert({
            property_id: propertyId,
            client_id: clientId,
            ownership_type: "owner" as any,
            source: "manual",
            start_date: form.ownership_start_date || new Date().toISOString().slice(0, 10),
            share_percent: num(form.ownership_share),
            notes: form.ownership_notes || null,
            is_primary_contact: true,
          });

          // Activity Log
          await supabase.from("activity_logs").insert({
            action: "ownership_created",
            actor_id: owner_id,
            related_id: propertyId,
            related_type: "property",
            metadata: { client_id: clientId, source: "client_wizard", role: dbRole },
          });
        }
      }

      // 6) Finanzierungskunde -> optional Immobilienbezug
      if (role === "financing_applicant" && form.property_mode === "existing" && form.selected_property_id) {
        await supabase.from("client_roles").insert({
          client_id: clientId,
          role_type: "financing_applicant" as any,
          status: "active",
          start_date: new Date().toISOString().slice(0, 10),
          related_id: form.selected_property_id,
          related_type: "property",
        });
      }

      return {
        clientId,
        role,
        propertyId: createdPropertyId
          ?? (form.property_mode === "existing" ? form.selected_property_id : null),
      };
    },
    onSuccess: ({ clientId, role, propertyId }) => {
      toast.success("Kunde erfolgreich erstellt");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      onCreated?.(clientId);

      // Rollenabhängige Folgeaktion
      if (role === "buyer" || role === "tenant" || role === "investor") {
        navigate({ to: "/matching", search: {} } as any).catch(() => {});
      } else if ((role === "seller_owner" || role === "landlord") && propertyId) {
        navigate({ to: "/properties/$id", params: { id: propertyId } }).catch(() => {});
      } else if (role === "financing_applicant") {
        navigate({ to: "/financing" }).catch(() => {});
      } else {
        navigate({ to: "/clients/$id", params: { id: clientId } }).catch(() => {});
      }

      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  // ---- Navigation ----
  const isLast = stepIdx === steps.length - 1;
  const canProceed = (() => {
    if (currentStep === "role") return !!form.role_choice;
    if (currentStep === "stamm") {
      return form.entity_type === "company" ? form.company_name.trim().length > 0 : personName.length > 0;
    }
    return true;
  })();

  const progress = ((stepIdx + 1) / steps.length) * 100;

  // ---- UI Render ----
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] w-full max-w-4xl overflow-hidden p-0">
        <div className="flex flex-col max-h-[92vh]">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle className="text-xl">Neuen Kunden erfassen</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Schritt {stepIdx + 1} von {steps.length} · {STEP_LABELS[currentStep]}
            </p>
            <div className="mt-3"><Progress value={progress} className="h-1.5" /></div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* ENTITY */}
            {currentStep === "entity" && (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Was möchtest du erfassen?</p>
                  <p className="text-sm text-muted-foreground">Wähle die Art des Kunden.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {([
                    { v: "person",  title: "Privatperson",        desc: "Eine natürliche Person",   Icon: User },
                    { v: "company", title: "Unternehmen / Firma", desc: "Eine juristische Person", Icon: Building2 },
                  ] as const).map(({ v, title, desc, Icon }) => {
                    const active = form.entity_type === v;
                    return (
                      <button type="button" key={v}
                        onClick={() => set("entity_type", v)}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-primary/60 hover:bg-accent/40 ${
                          active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : ""
                        }`}>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="flex-1">
                          <span className="block font-semibold">{title}</span>
                          <span className="block text-sm text-muted-foreground">{desc}</span>
                        </span>
                        {active && <Check className="h-5 w-5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ROLE */}
            {currentStep === "role" && (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Welche Rolle hat dieser Kunde?</p>
                  <p className="text-sm text-muted-foreground">Bestimmt die nächsten Schritte.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                    const active = form.role_choice === value;
                    return (
                      <button type="button" key={value}
                        onClick={() => set("role_choice", value)}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-primary/60 hover:bg-accent/40 ${
                          active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : ""
                        }`}>
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="flex-1">
                          <span className="block font-semibold">{label}</span>
                          <span className="block text-sm text-muted-foreground">{description}</span>
                        </span>
                        {active && <Check className="h-5 w-5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STAMM */}
            {currentStep === "stamm" && (
              <div className="space-y-4">
                {form.entity_type === "company" ? (
                  <>
                    <div>
                      <Label>Firmenname *</Label>
                      <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="ACME AG" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                      <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Anrede</Label>
                        <Select value={form.salutation} onValueChange={(v) => set("salutation", v)}>
                          <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Herr">Herr</SelectItem>
                            <SelectItem value="Frau">Frau</SelectItem>
                            <SelectItem value="Divers">Divers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Vorname *</Label><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></div>
                      <div><Label>Nachname *</Label><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                      <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2"><Label>Strasse</Label><Input value={form.street} onChange={(e) => set("street", e.target.value)} /></div>
                  <div><Label>PLZ</Label><Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></div>
                  <div><Label>Ort</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
                </div>
              </div>
            )}

            {/* COMPANY CONTACT (Firma -> Kontaktperson) */}
            {currentStep === "company_contact" && (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Kontaktperson</p>
                  <p className="text-sm text-muted-foreground">Wer ist der Ansprechpartner für diese Firma?</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    { v: "manual",   title: "Neue Kontaktperson",         desc: "Direkt erfassen",                 Icon: User },
                    { v: "existing", title: "Bestehenden Kunden wählen",  desc: "Aus der Kundenliste verknüpfen", Icon: Users },
                  ] as const).map(({ v, title, desc, Icon }) => {
                    const active = form.contact_mode === v;
                    return (
                      <button type="button" key={v}
                        onClick={() => set("contact_mode", v)}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-primary/60 ${
                          active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : ""
                        }`}>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{title}</span>
                          <span className="block text-xs text-muted-foreground">{desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {form.contact_mode === "manual" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><Label>Vorname</Label><Input value={form.contact_first_name} onChange={(e) => set("contact_first_name", e.target.value)} /></div>
                    <div><Label>Nachname</Label><Input value={form.contact_last_name} onChange={(e) => set("contact_last_name", e.target.value)} /></div>
                  </div>
                )}

                {form.contact_mode === "existing" && (
                  <div>
                    <Label>Bestehender Kunde</Label>
                    <Select value={form.linked_contact_client_id} onValueChange={(v) => set("linked_contact_client_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Person wählen..." /></SelectTrigger>
                      <SelectContent>
                        {(personClientsQuery.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name}{c.email ? ` · ${c.email}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* SEARCH (Buyer/Tenant) */}
            {currentStep === "search" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Vermarktungsart</Label>
                    <Select value={form.preferred_listing || (form.role_choice === "tenant" ? "rent" : "sale")} onValueChange={(v) => set("preferred_listing", v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Kauf</SelectItem>
                        <SelectItem value="rent">Miete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Wunschorte (Komma-getrennt)</Label>
                    <Input value={form.preferred_cities} onChange={(e) => set("preferred_cities", e.target.value)} placeholder="Zürich, Zug, Luzern" />
                  </div>
                </div>
                <div>
                  <Label>Objektarten</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {PROP_TYPES.map((t) => {
                      const active = form.preferred_types.includes(t);
                      return (
                        <button type="button" key={t}
                          onClick={() => set("preferred_types", active ? form.preferred_types.filter((x) => x !== t) : [...form.preferred_types, t])}
                          className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"}`}>
                          {propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label>Budget min</Label><Input type="number" value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} /></div>
                  <div><Label>Budget max</Label><Input type="number" value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} /></div>
                  <div><Label>Zimmer min</Label><Input type="number" value={form.rooms_min} onChange={(e) => set("rooms_min", e.target.value)} /></div>
                  <div><Label>Fläche min (m²)</Label><Input type="number" value={form.area_min} onChange={(e) => set("area_min", e.target.value)} /></div>
                </div>
              </div>
            )}

            {/* INVESTMENT */}
            {currentStep === "investment" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Wunschorte (Komma-getrennt)</Label>
                    <Input value={form.preferred_cities} onChange={(e) => set("preferred_cities", e.target.value)} />
                  </div>
                  <div>
                    <Label>Zielrendite (% optional)</Label>
                    <Input type="number" step="0.1" value={form.yield_target} onChange={(e) => set("yield_target", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Objektarten</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {PROP_TYPES.map((t) => {
                      const active = form.preferred_types.includes(t);
                      return (
                        <button type="button" key={t}
                          onClick={() => set("preferred_types", active ? form.preferred_types.filter((x) => x !== t) : [...form.preferred_types, t])}
                          className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"}`}>
                          {propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>Nutzungen</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      { v: "residential", l: "Wohnen" },
                      { v: "commercial",  l: "Gewerbe" },
                      { v: "yield",       l: "Renditeobjekt" },
                    ].map(({ v, l }) => {
                      const active = form.usage_types.includes(v);
                      return (
                        <button type="button" key={v}
                          onClick={() => set("usage_types", active ? form.usage_types.filter((x) => x !== v) : [...form.usage_types, v])}
                          className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-muted"}`}>
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Budget min</Label><Input type="number" value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} /></div>
                  <div><Label>Budget max</Label><Input type="number" value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} /></div>
                </div>
              </div>
            )}

            {/* FINANCING */}
            {currentStep === "financing" && (
              <div className="space-y-4">
                {form.role_choice === "financing_applicant" && (
                  <div>
                    <Label>Finanzierungsziel</Label>
                    <Select value={form.financing_goal} onValueChange={(v) => set("financing_goal", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FINANCING_GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label>Eigenmittel (CHF)</Label><Input type="number" value={form.equity} onChange={(e) => set("equity", e.target.value)} /></div>
                  <div>
                    <Label>Finanzierungsstatus</Label>
                    <Select value={form.financing_status} onValueChange={(v) => set("financing_status", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        {["unklar", "in Prüfung", "Vorabbestätigung", "bestätigt", "abgelehnt"].map((f) =>
                          <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quick Check kann später aus der Finanzierungsansicht gestartet werden.
                </p>
              </div>
            )}

            {/* PROPERTY (Verkäufer/Vermieter/Finanzierung) */}
            {currentStep === "property" && (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Immobilie</p>
                  <p className="text-sm text-muted-foreground">
                    {form.role_choice === "financing_applicant"
                      ? "Optional: Welche Immobilie soll finanziert werden?"
                      : "Welche Immobilie soll verknüpft werden?"}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {([
                    { v: "existing", l: "Bestehende wählen" },
                    { v: "new",      l: "Neue erfassen" },
                    { v: "none",     l: "Keine / später" },
                  ] as const).map(({ v, l }) => (
                    <button type="button" key={v}
                      onClick={() => set("property_mode", v)}
                      className={`rounded-xl border p-3 text-sm transition ${form.property_mode === v ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted"}`}>
                      {l}
                    </button>
                  ))}
                </div>

                {form.property_mode === "existing" && (
                  <div>
                    <Label>Immobilie</Label>
                    <Select value={form.selected_property_id} onValueChange={(v) => set("selected_property_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                      <SelectContent>
                        {(propertiesQuery.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}{p.city ? ` · ${p.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {form.property_mode === "new" && (
                  <div className="space-y-3">
                    <div><Label>Titel *</Label><Input value={form.new_property_title} onChange={(e) => set("new_property_title", e.target.value)} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2"><Label>Adresse</Label><Input value={form.new_property_address} onChange={(e) => set("new_property_address", e.target.value)} /></div>
                      <div><Label>PLZ</Label><Input value={form.new_property_postal_code} onChange={(e) => set("new_property_postal_code", e.target.value)} /></div>
                      <div><Label>Ort</Label><Input value={form.new_property_city} onChange={(e) => set("new_property_city", e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Objektart</Label>
                        <Select value={form.new_property_type} onValueChange={(v) => set("new_property_type", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROP_TYPES.map((t) => <SelectItem key={t} value={t}>{propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Geschätzter Preis (CHF)</Label><Input type="number" value={form.new_property_price} onChange={(e) => set("new_property_price", e.target.value)} /></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OWNERSHIP */}
            {currentStep === "ownership" && (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Eigentümerbeziehung</p>
                  <p className="text-sm text-muted-foreground">Eigentumsdaten zur Immobilie.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label>Eigentümer seit</Label><Input type="date" value={form.ownership_start_date} onChange={(e) => set("ownership_start_date", e.target.value)} /></div>
                  <div><Label>Anteil (%)</Label><Input type="number" step="0.01" value={form.ownership_share} onChange={(e) => set("ownership_share", e.target.value)} placeholder="100" /></div>
                </div>
                <div><Label>Notizen</Label><Textarea value={form.ownership_notes} onChange={(e) => set("ownership_notes", e.target.value)} /></div>
                <p className="text-xs text-muted-foreground">
                  Maklermandat kann später aus der Immobiliendetailseite erstellt werden.
                </p>
              </div>
            )}

            {/* TAGS */}
            {currentStep === "tags" && (
              <div className="space-y-4">
                <div><Label>Notizen</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
                <div><Label>Tags (Komma-getrennt)</Label><Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="VIP, Empfehlung" /></div>
              </div>
            )}

            {/* REVIEW */}
            {currentStep === "review" && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{form.entity_type === "company" ? "Firma" : "Privatperson"}</Badge>
                    <Badge>{ROLE_OPTIONS.find((r) => r.value === form.role_choice)?.label}</Badge>
                  </div>
                  <p className="text-lg font-semibold">{fullName || "—"}</p>
                  {(form.email || form.phone) && (
                    <p className="text-sm text-muted-foreground">
                      {[form.email, form.phone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {(form.street || form.city) && (
                    <p className="text-sm text-muted-foreground">
                      {[form.street, form.postal_code, form.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {form.entity_type === "company" && form.contact_mode === "existing" && form.linked_contact_client_id && (
                    <p className="text-sm">
                      Kontaktperson: {(personClientsQuery.data ?? []).find((c) => c.id === form.linked_contact_client_id)?.full_name}
                    </p>
                  )}
                  {form.entity_type === "company" && form.contact_mode === "manual" && (form.contact_first_name || form.contact_last_name) && (
                    <p className="text-sm">Kontaktperson: {`${form.contact_first_name} ${form.contact_last_name}`.trim()}</p>
                  )}
                </div>

                {(form.role_choice === "buyer" || form.role_choice === "tenant" || form.role_choice === "investor") && (
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-semibold mb-1">Suchprofil</p>
                    <p className="text-sm text-muted-foreground">
                      {form.preferred_cities || "—"} · Budget {form.budget_min || "—"}–{form.budget_max || "—"} CHF
                      {form.role_choice === "investor" && form.yield_target ? ` · Ziel ${form.yield_target}%` : ""}
                    </p>
                  </div>
                )}

                {(form.role_choice === "seller_owner" || form.role_choice === "landlord") && (
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-semibold mb-1">Eigentum</p>
                    <p className="text-sm text-muted-foreground">
                      {form.property_mode === "existing"
                        ? (propertiesQuery.data ?? []).find((p) => p.id === form.selected_property_id)?.title || "Bestehende Immobilie"
                        : form.property_mode === "new"
                          ? form.new_property_title || "Neue Immobilie"
                          : "Keine Immobilie verknüpft"}
                    </p>
                  </div>
                )}

                {form.role_choice === "financing_applicant" && (
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-semibold mb-1">Finanzierung</p>
                    <p className="text-sm text-muted-foreground">
                      Ziel: {FINANCING_GOALS.find((g) => g.value === form.financing_goal)?.label}
                      {form.equity ? ` · Eigenmittel ${form.equity} CHF` : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" disabled={stepIdx === 0 || create.isPending}
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
            </Button>
            {!isLast ? (
              <Button type="button" disabled={!canProceed}
                onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}>
                Weiter <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" disabled={!canSave || create.isPending}
                onClick={() => create.mutate()}>
                {create.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-1 h-4 w-4" />}
                Kunden anlegen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
