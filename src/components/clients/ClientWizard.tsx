import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ChevronLeft, ChevronRight, Check, Loader2, User, Mail, Briefcase, Wallet, Target, ClipboardCheck, Building2, UserCircle, Tag } from "lucide-react";
import { toast } from "sonner";
import { clientTypeLabels, propertyTypeLabels } from "@/lib/format";
import {
  calculateBenchmark, expenseFields, expenseLabels, formatCHF,
  incomeFields, incomeLabels, maritalStatusOptions, employmentStatusOptions,
  salutationOptions, benchmarkLabels, benchmarkColors,
} from "@/lib/self-disclosure";

const TYPES = ["buyer", "seller", "owner", "tenant", "landlord", "investor", "other"] as const;
const PROP_TYPES = ["apartment", "house", "commercial", "land", "other"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (clientId: string) => void;
}

const STEPS = [
  { key: "entity",   label: "Art",          icon: UserCircle },
  { key: "role",     label: "Rolle",        icon: Tag },
  { key: "person",   label: "Stammdaten",   icon: User },
  { key: "contact",  label: "Kontakt",      icon: Mail },
  { key: "job",      label: "Beruf & Einkommen", icon: Briefcase },
  { key: "expense",  label: "Ausgaben",     icon: Wallet },
  { key: "search",   label: "Suchprofil",   icon: Target },
  { key: "review",   label: "Übersicht",    icon: ClipboardCheck },
] as const;

type EntityType = "person" | "company";
type RoleChoice = "buyer" | "seller_owner" | "tenant" | "landlord" | "financing_applicant" | "general_contact";

const ROLE_OPTIONS: { value: RoleChoice; label: string; description: string; icon: typeof Tag }[] = [
  { value: "buyer",               label: "Käufer",                 description: "Sucht eine Immobilie zum Kauf", icon: Target },
  { value: "seller_owner",        label: "Verkäufer / Eigentümer", description: "Bietet eine Immobilie an oder besitzt eine", icon: Building2 },
  { value: "tenant",              label: "Mieter",                 description: "Sucht eine Mietwohnung", icon: User },
  { value: "landlord",            label: "Vermieter",              description: "Vermietet eine Immobilie", icon: Building2 },
  { value: "financing_applicant", label: "Finanzierungskunde",     description: "Benötigt Finanzierungsberatung", icon: Wallet },
  { value: "general_contact",     label: "Allgemeiner Kontakt",    description: "Sonstiger Kontakt ohne klare Rolle", icon: Mail },
];

const ROLE_TO_CLIENT_TYPE: Record<RoleChoice, typeof TYPES[number]> = {
  buyer: "buyer",
  seller_owner: "seller",
  tenant: "tenant",
  landlord: "landlord",
  financing_applicant: "other",
  general_contact: "other",
};

const ROLE_TO_DB_ROLE: Record<RoleChoice, string> = {
  buyer: "buyer",
  seller_owner: "seller",
  tenant: "tenant",
  landlord: "landlord",
  financing_applicant: "financing_applicant",
  general_contact: "general_contact",
};

type FormState = {
  // Entität & Rolle
  entity_type: EntityType;
  role_choice: RoleChoice | "";
  company_name: string;
  // Stamm
  salutation: string;
  first_name: string;
  last_name: string;
  birth_name: string;
  birth_date: string;
  nationality: string;
  marital_status: string;
  // Kontakt
  email: string;
  phone: string;
  mobile: string;
  street: string;
  street_number: string;
  postal_code: string;
  city: string;
  country: string;
  // Beruf & Einkommen
  employment_status: string;
  employer_name: string;
  employed_as: string;
  employed_since: string;
  salary_net_monthly: string;
  additional_income: string;
  income_job_two: string;
  income_rental: string;
  // Ausgaben
  mortgage_expense: string;
  rent_expense: string;
  leasing_expense: string;
  credit_expense: string;
  life_insurance_expense: string;
  alimony_expense: string;
  health_insurance_expense: string;
  property_insurance_expense: string;
  utilities_expense: string;
  telecom_expense: string;
  living_costs_expense: string;
  taxes_expense: string;
  miscellaneous_expense: string;
  // Suchprofil
  client_type: typeof TYPES[number];
  preferred_listing: "sale" | "rent";
  preferred_cities: string;
  preferred_types: string[];
  budget_min: string;
  budget_max: string;
  rooms_min: string;
  area_min: string;
  assigned_to: string;
  financing_status: string;
  notes: string;
};

const FINANCING_OPTIONS = ["unklar", "in Prüfung", "Vorabbestätigung", "bestätigt", "abgelehnt"];
const UNASSIGNED = "__unassigned__";
const NO_FIN = "__none__";

const empty: FormState = {
  entity_type: "person", role_choice: "", company_name: "",
  salutation: "", first_name: "", last_name: "", birth_name: "", birth_date: "",
  nationality: "", marital_status: "",
  email: "", phone: "", mobile: "", street: "", street_number: "",
  postal_code: "", city: "", country: "CH",
  employment_status: "", employer_name: "", employed_as: "", employed_since: "",
  salary_net_monthly: "", additional_income: "", income_job_two: "", income_rental: "",
  mortgage_expense: "", rent_expense: "", leasing_expense: "", credit_expense: "",
  life_insurance_expense: "", alimony_expense: "", health_insurance_expense: "",
  property_insurance_expense: "", utilities_expense: "", telecom_expense: "",
  living_costs_expense: "", taxes_expense: "", miscellaneous_expense: "",
  client_type: "buyer", preferred_listing: "sale",
  preferred_cities: "", preferred_types: [],
  budget_min: "", budget_max: "", rooms_min: "", area_min: "",
  assigned_to: "", financing_status: "", notes: "",
};

const num = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function ClientWizard({ open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, email").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });
  const employees = employeesQuery.data ?? [];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const benchmark = useMemo(() => {
    const finance: Record<string, number> = {};
    [...incomeFields, ...expenseFields].forEach((f) => {
      finance[f] = num(form[f as keyof FormState] as string) ?? 0;
    });
    return calculateBenchmark(finance);
  }, [form]);

  const personName = `${form.first_name} ${form.last_name}`.trim();
  const fullName = form.entity_type === "company"
    ? form.company_name.trim()
    : personName;
  const canSave = fullName.length > 0 && !!form.role_choice;

  const reset = () => { setForm(empty); setStep(0); };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.role_choice) throw new Error("Bitte Rolle wählen");
      if (!fullName) throw new Error(form.entity_type === "company" ? "Firmenname ist erforderlich" : "Vor- und Nachname sind erforderlich");
      const { data: userData } = await supabase.auth.getUser();
      const owner_id = userData.user?.id ?? null;

      const mappedClientType = ROLE_TO_CLIENT_TYPE[form.role_choice as RoleChoice];

      // 1) Insert client
      const clientPayload: any = {
        full_name: fullName,
        entity_type: form.entity_type,
        company_name: form.entity_type === "company" ? (form.company_name || null) : null,
        contact_first_name: form.entity_type === "company" ? (form.first_name || null) : null,
        contact_last_name: form.entity_type === "company" ? (form.last_name || null) : null,
        email: form.email || null,
        phone: form.phone || form.mobile || null,
        client_type: mappedClientType,
        notes: form.notes || null,
        owner_id,
        assigned_to: form.assigned_to || null,
        financing_status: form.financing_status || null,
        address: [form.street, form.street_number].filter(Boolean).join(" ") || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        country: form.country || null,
        budget_min: num(form.budget_min),
        budget_max: num(form.budget_max),
        rooms_min: num(form.rooms_min),
        area_min: num(form.area_min),
        preferred_cities: form.preferred_cities
          ? form.preferred_cities.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        preferred_types: form.preferred_types.length ? form.preferred_types : null,
        preferred_listing: form.preferred_listing,
      };
      const { data: client, error: clientErr } = await supabase
        .from("clients").insert(clientPayload).select("id").single();
      if (clientErr) throw clientErr;

      // 1b) Insert client role
      const { error: roleErr } = await supabase.from("client_roles").insert({
        client_id: client.id,
        role_type: ROLE_TO_DB_ROLE[form.role_choice as RoleChoice] as any,
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
      });
      if (roleErr) console.warn("Rolle konnte nicht gespeichert werden:", roleErr);

      // 2) Insert self-disclosure (non-blocking — log but don't fail)
      const disclosurePayload: any = {
        client_id: client.id,
        salutation: form.salutation || null,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        birth_name: form.birth_name || null,
        birth_date: form.birth_date || null,
        nationality: form.nationality || null,
        marital_status: form.marital_status || null,
        email: form.email || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        street: form.street || null,
        street_number: form.street_number || null,
        postal_code: form.postal_code || null,
        city: form.city || null,
        country: form.country || null,
        employment_status: form.employment_status || null,
        employer_name: form.employer_name || null,
        employed_as: form.employed_as || null,
        employed_since: form.employed_since || null,
        advisor_id: owner_id,
        total_income_monthly: benchmark.totalIncome,
        total_expenses_monthly: benchmark.totalExpenses,
        reserve_total: benchmark.reserveTotal,
        reserve_ratio: benchmark.reserveRatio,
        benchmark_status: benchmark.status,
      };
      [...incomeFields, ...expenseFields].forEach((f) => {
        disclosurePayload[f] = num(form[f as keyof FormState] as string);
      });

      const { error: discErr } = await supabase
        .from("client_self_disclosures")
        .insert(disclosurePayload);
      if (discErr) console.warn("Selbstauskunft konnte nicht gespeichert werden:", discErr);

      return client.id as string;
    },
    onSuccess: (id) => {
      toast.success("Kunde erfolgreich erstellt");
      qc.invalidateQueries({ queryKey: ["clients"] });
      onCreated?.(id);
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler beim Speichern"),
  });

  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[92vh] w-full max-w-4xl overflow-hidden p-0">
        <div className="flex flex-col max-h-[92vh]">
          <DialogHeader className="border-b px-6 pt-6 pb-4">
            <DialogTitle className="text-xl">Neuen Kunden erfassen</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Schritt {step + 1} von {STEPS.length} · {STEPS[step].label}
            </p>
            <div className="mt-3 space-y-3">
              <Progress value={progress} className="h-1.5" />
              <div className="hidden md:flex items-center justify-between gap-1">
                {STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const active = i === step;
                  const done = i < step;
                  return (
                    <button
                      type="button"
                      key={s.key}
                      onClick={() => setStep(i)}
                      className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                        active ? "bg-primary/10 text-primary"
                        : done ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        active ? "border-primary bg-primary text-primary-foreground"
                        : done ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted-foreground/30"
                      }`}>
                        {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Was möchtest du erfassen?</p>
                  <p className="text-sm text-muted-foreground">Wähle die Art des Kunden.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {([
                    { v: "person",  title: "Privatperson",     desc: "Eine natürliche Person", Icon: UserCircle },
                    { v: "company", title: "Unternehmen / Firma", desc: "Eine juristische Person", Icon: Building2 },
                  ] as const).map(({ v, title, desc, Icon }) => {
                    const active = form.entity_type === v;
                    return (
                      <button
                        type="button"
                        key={v}
                        onClick={() => set("entity_type", v)}
                        className={`group flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-primary/60 hover:bg-accent/40 ${
                          active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : ""
                        }`}
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${active ? "border-primary bg-primary text-primary-foreground" : "bg-muted"}`}>
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

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-semibold">Welche Rolle hat dieser Kunde?</p>
                  <p className="text-sm text-muted-foreground">Bestimmt die Beziehung im System.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                    const active = form.role_choice === value;
                    return (
                      <button
                        type="button"
                        key={value}
                        onClick={() => set("role_choice", value)}
                        className={`flex items-start gap-3 rounded-xl border p-4 text-left transition hover:border-primary/60 hover:bg-accent/40 ${
                          active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : ""
                        }`}
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${active ? "border-primary bg-primary text-primary-foreground" : "bg-muted"}`}>
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

            {step === 2 && form.entity_type === "company" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Firmenname *</Label>
                    <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Muster AG" />
                  </div>
                  <div>
                    <Label>Kontaktperson – Vorname</Label>
                    <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Kontaktperson – Nachname</Label>
                    <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Die Kontaktperson ist optional und kann später ergänzt werden.</p>
              </div>
            )}

            {step === 2 && form.entity_type === "person" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <Label>Anrede</Label>
                    <Select value={form.salutation || ""} onValueChange={(v) => set("salutation", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {salutationOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vorname *</Label>
                    <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Nachname *</Label>
                    <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label>Ledigname</Label>
                    <Input value={form.birth_name} onChange={(e) => set("birth_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Geburtsdatum</Label>
                    <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
                  </div>
                  <div>
                    <Label>Nationalität</Label>
                    <Input placeholder="z.B. CH" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
                  </div>
                  <div>
                    <Label>Familienstand</Label>
                    <Select value={form.marital_status || ""} onValueChange={(v) => set("marital_status", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {maritalStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label>E-Mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  <div>
                    <Label>Telefon</Label>
                    <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                  <div>
                    <Label>Mobil</Label>
                    <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="md:col-span-3">
                    <Label>Strasse</Label>
                    <Input value={form.street} onChange={(e) => set("street", e.target.value)} />
                  </div>
                  <div>
                    <Label>Nr.</Label>
                    <Input value={form.street_number} onChange={(e) => set("street_number", e.target.value)} />
                  </div>
                  <div>
                    <Label>PLZ</Label>
                    <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Ort</Label>
                    <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
                  </div>
                  <div>
                    <Label>Land</Label>
                    <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label>Erwerbsstatus</Label>
                    <Select value={form.employment_status || ""} onValueChange={(v) => set("employment_status", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {employmentStatusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Beschäftigt seit</Label>
                    <Input type="date" value={form.employed_since} onChange={(e) => set("employed_since", e.target.value)} />
                  </div>
                  <div>
                    <Label>Arbeitgeber</Label>
                    <Input value={form.employer_name} onChange={(e) => set("employer_name", e.target.value)} />
                  </div>
                  <div>
                    <Label>Funktion / Tätigkeit</Label>
                    <Input value={form.employed_as} onChange={(e) => set("employed_as", e.target.value)} />
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="mb-3 text-sm font-semibold">Monatliche Einnahmen (CHF)</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {incomeFields.map((f) => (
                      <div key={f}>
                        <Label>{incomeLabels[f]}</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={form[f as keyof FormState] as string}
                          onChange={(e) => set(f as keyof FormState, e.target.value as never)}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Total Einnahmen: <span className="font-semibold text-foreground">{formatCHF(benchmark.totalIncome)}</span>
                  </p>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="mb-3 text-sm font-semibold">Monatliche Ausgaben (CHF)</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {expenseFields.map((f) => (
                      <div key={f}>
                        <Label>{expenseLabels[f]}</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={form[f as keyof FormState] as string}
                          onChange={(e) => set(f as keyof FormState, e.target.value as never)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`rounded-xl border p-4 bg-gradient-to-br ${benchmarkColors[benchmark.status].bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Live-Benchmark</p>
                      <p className={`text-2xl font-semibold ${benchmarkColors[benchmark.status].text}`}>
                        {benchmarkLabels[benchmark.status]}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div>Einnahmen: <span className="font-medium">{formatCHF(benchmark.totalIncome)}</span></div>
                      <div>Ausgaben: <span className="font-medium">{formatCHF(benchmark.totalExpenses)}</span></div>
                      <div>Reserve: <span className="font-semibold">{formatCHF(benchmark.reserveTotal)}</span> ({benchmark.reserveRatio.toFixed(1)}%)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label>Kundentyp</Label>
                    <Select value={form.client_type} onValueChange={(v: any) => set("client_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => <SelectItem key={t} value={t}>{clientTypeLabels[t] ?? t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vermarktung</Label>
                    <Select value={form.preferred_listing} onValueChange={(v: any) => set("preferred_listing", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Kauf</SelectItem>
                        <SelectItem value="rent">Miete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Bevorzugte Städte (Komma-getrennt)</Label>
                    <Input placeholder="Zürich, Bern" value={form.preferred_cities} onChange={(e) => set("preferred_cities", e.target.value)} />
                  </div>
                  <div><Label>Budget min (CHF)</Label><Input type="number" value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} /></div>
                  <div><Label>Budget max (CHF)</Label><Input type="number" value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} /></div>
                  <div><Label>Zimmer min</Label><Input type="number" value={form.rooms_min} onChange={(e) => set("rooms_min", e.target.value)} /></div>
                  <div><Label>Fläche min (m²)</Label><Input type="number" value={form.area_min} onChange={(e) => set("area_min", e.target.value)} /></div>
                </div>

                <div>
                  <Label>Bevorzugte Objekttypen</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PROP_TYPES.map((t) => {
                      const sel = form.preferred_types.includes(t);
                      return (
                        <button
                          type="button"
                          key={t}
                          onClick={() =>
                            set("preferred_types",
                              sel ? form.preferred_types.filter((x) => x !== t)
                                  : [...form.preferred_types, t])
                          }
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            sel ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                          }`}
                        >
                          {propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label>Zugewiesen an</Label>
                    <Select value={form.assigned_to || UNASSIGNED} onValueChange={(v) => set("assigned_to", v === UNASSIGNED ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Niemand</SelectItem>
                        {employees.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Finanzierungsstatus</Label>
                    <Select value={form.financing_status || NO_FIN} onValueChange={(v) => set("financing_status", v === NO_FIN ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Keine Angabe" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_FIN}>Keine Angabe</SelectItem>
                        {FINANCING_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Notizen</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {form.entity_type === "company" ? "Unternehmen" : "Person"}
                  </p>
                  <p className="text-base font-semibold">{fullName || "—"}</p>
                  {form.entity_type === "company" && personName && (
                    <p className="text-sm text-muted-foreground">Kontakt: {personName}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {form.role_choice && (
                      <Badge variant="secondary">
                        {ROLE_OPTIONS.find((r) => r.value === form.role_choice)?.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {[form.email, form.phone || form.mobile].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[form.street && `${form.street} ${form.street_number}`, form.postal_code && `${form.postal_code} ${form.city}`, form.country]
                      .filter(Boolean).join(", ") || "Keine Adresse"}
                  </p>
                </div>

                <div className={`rounded-xl border p-4 bg-gradient-to-br ${benchmarkColors[benchmark.status].bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Finanzieller Benchmark</p>
                      <p className={`text-xl font-semibold ${benchmarkColors[benchmark.status].text}`}>
                        {benchmarkLabels[benchmark.status]}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div>Reserve: <span className="font-semibold">{formatCHF(benchmark.reserveTotal)}</span></div>
                      <div className="text-muted-foreground">{benchmark.reserveRatio.toFixed(1)}% Reservequote</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Suchprofil</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline">{clientTypeLabels[form.client_type as keyof typeof clientTypeLabels] ?? form.client_type}</Badge>
                    <Badge variant="outline">{form.preferred_listing === "sale" ? "Kauf" : "Miete"}</Badge>
                    {form.financing_status && <Badge variant="outline">{form.financing_status}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {form.preferred_cities || "Keine Städte"} · Budget {form.budget_min || "—"} – {form.budget_max || "—"}
                  </p>
                </div>

                {!canSave && (
                  <p className="text-sm text-destructive">
                    Bitte Rolle wählen und {form.entity_type === "company" ? "Firmenname" : "Vor- und Nachname"} erfassen.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t bg-muted/20 px-6 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || create.isPending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
                Abbrechen
              </Button>
              {!isLast ? (
                <Button
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  disabled={
                    (step === 1 && !form.role_choice) ||
                    (step === 2 && form.entity_type === "company" && !form.company_name.trim())
                  }
                >
                  Weiter <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={() => create.mutate()} disabled={!canSave || create.isPending}>
                  {create.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Speichern…</>
                    : <><Check className="h-4 w-4 mr-1" /> Kunde speichern</>
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
