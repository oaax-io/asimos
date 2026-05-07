import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  Home, Hammer, ArrowUpCircle, Repeat2, TrendingUp,
  CheckCircle2, ArrowLeft, ArrowRight, ChevronsUpDown, Check, ChevronDown, Settings2,
  UserPlus, AlertTriangle, ExternalLink, Users,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  FINANCING_TYPE_LABELS, calcQuickCheck, type FinancingType,
} from "@/lib/financing";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const num = (v: string) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: string) => {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// Nur die fünf neuen, gewünschten Module (kein new_build)
type WizardModule = "purchase" | "renovation" | "increase" | "refinance" | "mortgage_increase";

const MODULE_OPTIONS: { key: WizardModule; label: string; description: string; icon: any }[] = [
  { key: "purchase", label: "Kauf", description: "Finanzierung für den Kauf einer Immobilie.", icon: Home },
  { key: "renovation", label: "Renovation", description: "Finanzierung von Umbau- oder Renovationsarbeiten.", icon: Hammer },
  { key: "increase", label: "Erhöhung bestehende Hypothek", description: "Aufstockung einer bestehenden Hypothek (z. B. für Investitionen).", icon: ArrowUpCircle },
  { key: "refinance", label: "Refinanzierung", description: "Wechsel der Bank oder Ablösung der bestehenden Hypothek.", icon: Repeat2 },
  { key: "mortgage_increase", label: "Hypothekaraufstockung", description: "Erhöhung der Hypothek bei der bestehenden Bank.", icon: TrendingUp },
];

type PropertySource = "crm" | "manual" | "later";
type ClientSource = "crm" | "manual";

type CoApplicantRole = "ehepartner" | "mitantragsteller";

export type WizardForm = {
  modules: WizardModule[];

  // Property
  property_source: PropertySource;
  property_id: string;
  property_title: string;
  property_address: string;
  property_purchase_price: string;

  // Client
  client_source: ClientSource;
  client_id: string;
  gross_income_yearly: string;
  own_funds_total: string;
  own_funds_pension_fund: string;

  // Mitantragsteller (optional)
  co_applicant_enabled: boolean;
  co_applicant_role: CoApplicantRole | "";
  co_applicant_client_id: string;
  co_applicant_einkommen: string;
  co_applicant_eigenkapital: string;
  co_applicant_pk_anteil: string;

  // Reserved für spätere Schritte (4–6)
  renovation_costs: string;
  existing_mortgage: string;
  requested_mortgage: string;
  calc_rate: string;
  ancillary_pct: string;
  amortisation_years: string;
};

const emptyForm = (defaults?: Partial<WizardForm>): WizardForm => ({
  modules: [],
  property_source: "crm",
  property_id: "",
  property_title: "",
  property_address: "",
  property_purchase_price: "",
  client_source: "crm",
  client_id: "",
  gross_income_yearly: "",
  own_funds_total: "",
  own_funds_pension_fund: "",
  co_applicant_enabled: false,
  co_applicant_role: "",
  co_applicant_client_id: "",
  co_applicant_einkommen: "",
  co_applicant_eigenkapital: "",
  co_applicant_pk_anteil: "",
  renovation_costs: "",
  existing_mortgage: "",
  requested_mortgage: "",
  calc_rate: "5",
  ancillary_pct: "1",
  amortisation_years: "15",
  ...defaults,
});

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (dossierId: string) => void;
  defaultClientId?: string;
  defaultPropertyId?: string;
};

const TOTAL_STEPS = 6;

export function FinancingQuickCheckWizard({
  open, onOpenChange, onCreated, defaultClientId, defaultPropertyId,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(() => emptyForm({
    client_id: defaultClientId ?? "",
    property_id: defaultPropertyId ?? "",
    client_source: defaultClientId ? "crm" : "crm",
    property_source: defaultPropertyId ? "crm" : "crm",
  }));

  const update = <K extends keyof WizardForm>(k: K, v: WizardForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) {
      setStep(1);
      setForm(emptyForm({
        client_id: defaultClientId ?? "",
        property_id: defaultPropertyId ?? "",
      }));
    }
  }, [open, defaultClientId, defaultPropertyId]);

  const toggleModule = (m: WizardModule) => {
    setForm((f) => {
      const has = f.modules.includes(m);
      return { ...f, modules: has ? f.modules.filter((x) => x !== m) : [...f.modules, m] };
    });
  };

  // ---- Daten: Properties & Clients ----
  const propertiesQuery = useQuery({
    queryKey: ["wizard_properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, address, city, postal_code, price")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const clientsQuery = useQuery({
    queryKey: ["wizard_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, equity")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // ---- Auto-Fill: Property ----
  useEffect(() => {
    if (form.property_source !== "crm" || !form.property_id) return;
    const p: any = propertiesQuery.data?.find((x: any) => x.id === form.property_id);
    if (!p) return;
    setForm((f) => ({
      ...f,
      property_title: f.property_title || p.title || "",
      property_address: f.property_address || [p.address, p.postal_code, p.city].filter(Boolean).join(", "),
      property_purchase_price: f.property_purchase_price || (p.price != null ? String(p.price) : ""),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.property_id, form.property_source, propertiesQuery.data]);

  // ---- Auto-Fill: Client (aus clients + Selbstauskunft) ----
  useEffect(() => {
    if (form.client_source !== "crm" || !form.client_id) return;
    const c: any = clientsQuery.data?.find((x: any) => x.id === form.client_id);
    if (c?.equity != null) {
      setForm((f) => ({
        ...f,
        own_funds_total: f.own_funds_total || String(c.equity),
      }));
    }
    (async () => {
      const { data } = await supabase
        .from("client_self_disclosures")
        .select("annual_net_salary, salary_net_monthly")
        .eq("client_id", form.client_id)
        .maybeSingle();
      if (!data) return;
      const yearly = data.annual_net_salary
        ?? (data.salary_net_monthly ? Number(data.salary_net_monthly) * 12 : null);
      if (yearly) {
        setForm((f) => ({
          ...f,
          gross_income_yearly: f.gross_income_yearly || String(yearly),
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.client_id, form.client_source, clientsQuery.data]);

  // ---- Live-KPIs (Schritt 4 + 5 + 6) ----
  const liveResult = useMemo(() => {
    return calcQuickCheck({
      purchase_price: numOrNull(form.property_purchase_price) ?? 0,
      renovation_costs: numOrNull(form.renovation_costs) ?? 0,
      requested_mortgage: numOrNull(form.requested_mortgage) ?? 0,
      own_funds_total: numOrNull(form.own_funds_total) ?? 0,
      own_funds_pension_fund: numOrNull(form.own_funds_pension_fund),
      own_funds_vested_benefits: null,
      gross_income_yearly: numOrNull(form.gross_income_yearly) ?? 0,
      calculated_interest_rate: numOrNull(form.calc_rate) ?? 5,
      ancillary_costs_yearly: null, // berechnet aus % unten
      amortisation_yearly: null,
    });
  }, [form]);

  // Tatsächliche Live-Kennzahlen mit Nebenkosten-% und Amortisation aus Schritt 5
  const liveKpis = useMemo(() => {
    const purchase = num(form.property_purchase_price);
    const reno = num(form.renovation_costs);
    const total = purchase + reno;
    const mortgage = num(form.requested_mortgage);
    const equity = num(form.own_funds_total);
    const income = num(form.gross_income_yearly);
    const rate = num(form.calc_rate) || 5;
    const ancPct = num(form.ancillary_pct) || 1;
    const years = num(form.amortisation_years) || 15;

    const ltv = total > 0 ? (mortgage / total) * 100 : 0;
    const equityRatio = total > 0 ? (equity / total) * 100 : 0;
    const ancillary = total * (ancPct / 100);
    // Amortisation: nur 2. Hypothek (über 66.67% LTV) auf "years" Jahre
    const firstMortgageMax = total * 0.6667;
    const secondMortgage = Math.max(0, mortgage - firstMortgageMax);
    const amort = years > 0 ? secondMortgage / years : 0;
    const yearly = mortgage * (rate / 100) + ancillary + amort;
    const affordability = income > 0 ? (yearly / income) * 100 : 0;
    return { ltv, equityRatio, affordability, total, ancillary, amort, yearly };
  }, [form]);

  // ---- Validierung ----
  const canNext = useMemo(() => {
    if (step === 1) return form.modules.length > 0;
    if (step === 2) {
      if (form.property_source === "crm") return !!form.property_id;
      if (form.property_source === "manual") return !!form.property_title.trim();
      return true; // later
    }
    if (step === 3) {
      if (form.client_source === "crm") return !!form.client_id;
      return true;
    }
    if (step === 4) {
      // Genau die vier Pflichtfelder — keine weiteren Checks
      const purchase = num(form.property_purchase_price);
      const equity = num(form.own_funds_total);
      const income = num(form.gross_income_yearly);
      const mortgage = num(form.requested_mortgage);
      return purchase > 0 && equity >= 0 && income > 0 && mortgage > 0;
    }
    if (step === 5) return true;
    return true;
  }, [step, form]);

  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: async () => {
      const purchase = numOrNull(form.property_purchase_price);
      const reno = numOrNull(form.renovation_costs);
      const mortgage = numOrNull(form.requested_mortgage);
      const equity = numOrNull(form.own_funds_total);
      const pension = numOrNull(form.own_funds_pension_fund);
      const income = numOrNull(form.gross_income_yearly);
      const rate = numOrNull(form.calc_rate) ?? 5;
      const ancillary = liveKpis.ancillary || null;
      const amort = liveKpis.amort || null;

      const result = calcQuickCheck({
        purchase_price: purchase,
        renovation_costs: reno,
        requested_mortgage: mortgage,
        own_funds_total: equity,
        own_funds_pension_fund: pension,
        own_funds_vested_benefits: null,
        gross_income_yearly: income,
        calculated_interest_rate: rate,
        ancillary_costs_yearly: ancillary,
        amortisation_yearly: amort,
      });

      const primaryType: FinancingType = (form.modules[0] as FinancingType) ?? "purchase";

      const payload: any = {
        client_id: form.client_source === "crm" && form.client_id ? form.client_id : null,
        property_id: form.property_source === "crm" && form.property_id ? form.property_id : null,
        property_snapshot: form.property_source !== "crm" ? {
          title: form.property_title || null,
          address: form.property_address || null,
          price: purchase,
        } : {},
        data_source: form.property_source === "crm" ? "existing_property" : "quick_entry",
        financing_type: primaryType,
        financing_modules: form.modules,
        title: form.property_title || form.modules.map((m) => MODULE_OPTIONS.find((o) => o.key === m)?.label).filter(Boolean).join(" + "),
        purchase_price: purchase,
        renovation_costs: reno,
        existing_mortgage: numOrNull(form.existing_mortgage),
        requested_mortgage: mortgage,
        own_funds_total: equity,
        own_funds_pension_fund: pension,
        gross_income_yearly: income,
        calculated_interest_rate: rate,
        ancillary_costs_yearly: ancillary,
        amortisation_yearly: amort,
        total_investment: result.total_investment || null,
        loan_to_value_ratio: result.loan_to_value_ratio || null,
        affordability_ratio: result.affordability_ratio || null,
        quick_check_status: result.status,
        quick_check_reasons: result.reasons,
        status: "draft" as const,
        dossier_status: "quick_check" as const,
      };

      const { data, error } = await supabase
        .from("financing_dossiers")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["financing_dossiers"] });
      toast.success("Quick Check erstellt");
      onOpenChange(false);
      onCreated?.(id);
      navigate({ to: "/financing/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Speichern"),
  });

  const headerTitle = `Quick Check Finanzierung – Schritt ${step} / ${TOTAL_STEPS}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{headerTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 my-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded ${i < step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && <Step1Modules form={form} toggleModule={toggleModule} />}
        {step === 2 && (
          <Step2Property
            form={form}
            update={update}
            properties={propertiesQuery.data ?? []}
            loading={propertiesQuery.isLoading}
          />
        )}
        {step === 3 && (
          <Step3Client
            form={form}
            update={update}
            clients={clientsQuery.data ?? []}
            loading={clientsQuery.isLoading}
          />
        )}
        {step === 4 && <Step4Metrics form={form} update={update} kpis={liveKpis} />}
        {step === 5 && <Step5Advanced form={form} update={update} kpis={liveKpis} />}
        {step === 6 && (
          <Step6Summary
            form={form}
            kpis={liveKpis}
            status={liveResult.status}
            clients={clientsQuery.data ?? []}
            properties={propertiesQuery.data ?? []}
          />
        )}

        <DialogFooter className="mt-4 flex-row justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={createMutation.isPending}>
                <ArrowLeft className="mr-1 h-4 w-4" />Zurück
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < TOTAL_STEPS && (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
                Weiter <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === TOTAL_STEPS && (
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Speichern…" : "Quick Check starten"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== Schritt 1 ==================== */
function Step1Modules({
  form, toggleModule,
}: { form: WizardForm; toggleModule: (m: WizardModule) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Mehrere Bausteine kombinierbar. Mindestens eine Auswahl ist erforderlich.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODULE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = form.modules.includes(opt.key);
          return (
            <Card
              key={opt.key}
              onClick={() => toggleModule(opt.key)}
              className={cn(
                "cursor-pointer p-4 transition",
                active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-lg p-2", active ? "bg-primary/15" : "bg-muted")}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                {active && <CheckCircle2 className="h-4 w-4 text-primary mt-1" />}
              </div>
            </Card>
          );
        })}
      </div>
      {form.modules.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {form.modules.map((m) => {
            const opt = MODULE_OPTIONS.find((o) => o.key === m);
            return <Badge key={m} variant="secondary">{opt?.label ?? FINANCING_TYPE_LABELS[m as FinancingType]}</Badge>;
          })}
        </div>
      )}
    </div>
  );
}

/* ==================== Schritt 2 ==================== */
function Step2Property({
  form, update, properties, loading,
}: {
  form: WizardForm;
  update: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  properties: any[];
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <RadioGroup
        value={form.property_source}
        onValueChange={(v) => update("property_source", v as PropertySource)}
        className="grid gap-2"
      >
        <SourceRow value="crm" label="Immobilie aus CRM wählen" description="Bestehendes Objekt auswählen, Daten werden übernommen." />
        <SourceRow value="manual" label="Manuell erfassen" description="Adresse, Bezeichnung und Kaufpreis selbst eingeben." />
        <SourceRow value="later" label="Später erfassen" description="Schritt überspringen — Felder bleiben leer." />
      </RadioGroup>

      {form.property_source === "crm" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Immobilie</Label>
            <SearchableSelect
              placeholder={loading ? "Lade…" : "Immobilie suchen…"}
              emptyText="Keine Immobilie gefunden."
              value={form.property_id}
              onChange={(v) => update("property_id", v)}
              items={properties.map((p) => ({
                value: p.id,
                label: p.title || "(ohne Titel)",
                hint: [p.city, p.price ? formatCurrency(Number(p.price)) : null].filter(Boolean).join(" · "),
              }))}
            />
          </div>
          {form.property_id && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Objektbezeichnung" value={form.property_title} onChange={(v) => update("property_title", v)} />
              <Field label="Kaufpreis (CHF)" type="number" value={form.property_purchase_price} onChange={(v) => update("property_purchase_price", v)} />
              <div className="sm:col-span-2">
                <Field label="Adresse" value={form.property_address} onChange={(v) => update("property_address", v)} />
              </div>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Werte aus CRM vorausgefüllt. Anpassungen gelten nur für diesen Quick Check.
              </p>
            </div>
          )}
        </div>
      )}

      {form.property_source === "manual" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Objektbezeichnung *" value={form.property_title} onChange={(v) => update("property_title", v)} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Adresse" value={form.property_address} onChange={(v) => update("property_address", v)} />
          </div>
          <Field label="Kaufpreis (CHF)" type="number" value={form.property_purchase_price} onChange={(v) => update("property_purchase_price", v)} />
        </div>
      )}

      {form.property_source === "later" && (
        <p className="text-xs text-muted-foreground">
          Sie können die Immobiliendaten später im Dossier ergänzen.
        </p>
      )}
    </div>
  );
}

/* ==================== Schritt 3 ==================== */
function Step3Client({
  form, update, clients, loading,
}: {
  form: WizardForm;
  update: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  clients: any[];
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <RadioGroup
        value={form.client_source}
        onValueChange={(v) => update("client_source", v as ClientSource)}
        className="grid gap-2"
      >
        <SourceRow value="crm" label="Kunde aus CRM wählen" description="Selbstauskunft & Eigenkapital werden vorausgefüllt." />
        <SourceRow value="manual" label="Ohne Kunde / manuell" description="Quick Check ohne Verknüpfung zu einem Kunden." />
      </RadioGroup>

      {form.client_source === "crm" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Kunde</Label>
            <SearchableSelect
              placeholder={loading ? "Lade…" : "Kunde suchen…"}
              emptyText="Keinen Kunden gefunden."
              value={form.client_id}
              onChange={(v) => update("client_id", v)}
              items={clients.map((c) => ({
                value: c.id,
                label: c.full_name,
                hint: c.email ?? undefined,
              }))}
            />
          </div>
          {form.client_id && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brutto-Jahreseinkommen (CHF)" type="number" value={form.gross_income_yearly} onChange={(v) => update("gross_income_yearly", v)} />
              <Field label="Eigenmittel total (CHF)" type="number" value={form.own_funds_total} onChange={(v) => update("own_funds_total", v)} />
              <Field label="davon Pensionskasse (CHF)" type="number" value={form.own_funds_pension_fund} onChange={(v) => update("own_funds_pension_fund", v)} />
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Werte aus Kundenprofil und Selbstauskunft vorausgefüllt — editierbar.
              </p>
            </div>
          )}
        </div>
      )}

      {form.client_source === "manual" && (
        <p className="text-xs text-muted-foreground">
          Quick Check wird ohne Kundenverknüpfung erstellt. Die Finanzdaten erfassen Sie in Schritt 4.
        </p>
      )}
    </div>
  );
}

/* ==================== Schritt 4 ==================== */
type Kpis = { ltv: number; equityRatio: number; affordability: number; total: number; ancillary: number; amort: number; yearly: number };

function KpiPreview({ kpis }: { kpis: Kpis }) {
  return (
    <p className="text-xs text-muted-foreground">
      Belehnung: <span className="font-medium text-foreground">{kpis.ltv.toFixed(1)}%</span>
      {" · "}Tragbarkeit: <span className="font-medium text-foreground">{kpis.affordability.toFixed(1)}%</span>
      {" · "}Eigenmittelquote: <span className="font-medium text-foreground">{kpis.equityRatio.toFixed(1)}%</span>
    </p>
  );
}

function Step4Metrics({
  form, update, kpis,
}: {
  form: WizardForm;
  update: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  kpis: Kpis;
}) {
  const showRenovation = form.modules.includes("renovation");
  const showExisting = form.modules.includes("increase") || form.modules.includes("refinance") || form.modules.includes("mortgage_increase");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kaufpreis (CHF) *" type="number" value={form.property_purchase_price} onChange={(v) => update("property_purchase_price", v)} />
        <Field label="Gewünschte Hypothek (CHF) *" type="number" value={form.requested_mortgage} onChange={(v) => update("requested_mortgage", v)} />
        <Field label="Eigenmittel total (CHF) *" type="number" value={form.own_funds_total} onChange={(v) => update("own_funds_total", v)} />
        <Field label="davon PK / Freizügigkeit (CHF)" type="number" value={form.own_funds_pension_fund} onChange={(v) => update("own_funds_pension_fund", v)} />
        <Field label="Brutto-Jahreseinkommen (CHF) *" type="number" value={form.gross_income_yearly} onChange={(v) => update("gross_income_yearly", v)} />
        {showRenovation && (
          <Field label="Renovationskosten (CHF)" type="number" value={form.renovation_costs} onChange={(v) => update("renovation_costs", v)} />
        )}
        {showExisting && (
          <Field label="Bestehende Hypothek (CHF)" type="number" value={form.existing_mortgage} onChange={(v) => update("existing_mortgage", v)} />
        )}
      </div>
      <div className="rounded-lg bg-muted/50 p-3">
        <KpiPreview kpis={kpis} />
      </div>
    </div>
  );
}

/* ==================== Schritt 5 ==================== */
function Step5Advanced({
  form, update, kpis,
}: {
  form: WizardForm;
  update: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  kpis: Kpis;
}) {
  const [open, setOpen] = useState(false);
  const rate = num(form.calc_rate) || 5;
  const anc = num(form.ancillary_pct) || 1;
  return (
    <div className="space-y-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Erweiterte Einstellungen anpassen</span>
            <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-5 pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>Kalkulatorischer Zinssatz</Label>
              <span className="font-medium">{rate.toFixed(1)} %</span>
            </div>
            <Slider
              value={[rate]} min={1} max={8} step={0.1}
              onValueChange={(v) => update("calc_rate", String(v[0]))}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <Label>Nebenkosten (% der Gesamtinvestition)</Label>
              <span className="font-medium">{anc.toFixed(1)} %</span>
            </div>
            <Slider
              value={[anc]} min={0.5} max={3} step={0.1}
              onValueChange={(v) => update("ancillary_pct", String(v[0]))}
            />
          </div>
          <div className="space-y-2">
            <Label>Amortisationsdauer</Label>
            <Select value={form.amortisation_years} onValueChange={(v) => update("amortisation_years", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 Jahre</SelectItem>
                <SelectItem value="12">12 Jahre</SelectItem>
                <SelectItem value="15">15 Jahre</SelectItem>
                <SelectItem value="20">20 Jahre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <KpiPreview kpis={kpis} />
        <p className="text-xs text-muted-foreground">
          Jährliche Belastung: {formatCurrency(kpis.yearly)} (Zins + Nebenkosten + Amortisation)
        </p>
      </div>
    </div>
  );
}

/* ==================== Schritt 6 ==================== */
function Step6Summary({
  form, kpis, status, clients, properties,
}: {
  form: WizardForm;
  kpis: Kpis;
  status: string;
  clients: any[];
  properties: any[];
}) {
  const client = clients.find((c) => c.id === form.client_id);
  const property = properties.find((p) => p.id === form.property_id);
  const moduleLabels = form.modules.map((m) => MODULE_OPTIONS.find((o) => o.key === m)?.label).filter(Boolean).join(" + ");
  const propertyLabel = form.property_source === "crm"
    ? (property?.title ?? "—")
    : form.property_source === "manual"
      ? (form.property_title || "—")
      : "Später erfassen";
  const clientLabel = form.client_source === "crm"
    ? (client?.full_name ?? "—")
    : "Ohne Kunde";

  return (
    <div className="space-y-4">
      <SummaryGroup title="Finanzierungsart">
        <SumRow label="Module" value={moduleLabels || "—"} />
      </SummaryGroup>

      <SummaryGroup title="Immobilie">
        <SumRow label="Bezeichnung" value={propertyLabel} />
        {form.property_address && <SumRow label="Adresse" value={form.property_address} />}
        {form.property_purchase_price && <SumRow label="Kaufpreis" value={formatCurrency(num(form.property_purchase_price))} />}
      </SummaryGroup>

      <SummaryGroup title="Kunde">
        <SumRow label="Kunde" value={clientLabel} />
        {form.gross_income_yearly && <SumRow label="Brutto-Jahreseinkommen" value={formatCurrency(num(form.gross_income_yearly))} />}
        {form.own_funds_total && <SumRow label="Eigenmittel total" value={formatCurrency(num(form.own_funds_total))} />}
        {form.own_funds_pension_fund && <SumRow label="davon PK / Freizügigkeit" value={formatCurrency(num(form.own_funds_pension_fund))} />}
      </SummaryGroup>

      <SummaryGroup title="Kennzahlen">
        <SumRow label="Gewünschte Hypothek" value={formatCurrency(num(form.requested_mortgage))} />
        {form.renovation_costs && <SumRow label="Renovationskosten" value={formatCurrency(num(form.renovation_costs))} />}
        {form.existing_mortgage && <SumRow label="Bestehende Hypothek" value={formatCurrency(num(form.existing_mortgage))} />}
        <SumRow label="Kalk. Zinssatz" value={`${num(form.calc_rate).toFixed(1)} %`} />
        <SumRow label="Nebenkosten" value={`${num(form.ancillary_pct).toFixed(1)} %`} />
        <SumRow label="Amortisationsdauer" value={`${form.amortisation_years} Jahre`} />
      </SummaryGroup>

      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold">Live-Vorschau</p>
          <StatusBadge status={status} />
        </div>
        <KpiPreview kpis={kpis} />
      </div>
    </div>
  );
}

function SummaryGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-1 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "realistic") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Realistisch</Badge>;
  if (status === "critical") return <Badge className="bg-amber-500 hover:bg-amber-500">Kritisch</Badge>;
  if (status === "not_financeable") return <Badge className="bg-red-600 hover:bg-red-600">Nicht finanzierbar</Badge>;
  return <Badge variant="secondary">Unvollständig</Badge>;
}

/* ==================== Helpers ==================== */

function SourceRow({ value, label, description }: { value: string; label: string; description: string }) {
  return (
    <Label
      htmlFor={`src-${value}`}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:border-primary/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:ring-2 [&:has([data-state=checked])]:ring-primary/20"
    >
      <RadioGroupItem id={`src-${value}`} value={value} className="mt-1" />
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Label>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  const isNumber = type === "number";
  const display = isNumber ? formatChNumber(value) : value;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={isNumber ? "text" : type}
        inputMode={isNumber ? "decimal" : undefined}
        value={display}
        onChange={(e) => {
          if (isNumber) {
            const raw = e.target.value.replace(/[^\d.,-]/g, "").replace(/,/g, ".");
            onChange(raw);
          } else {
            onChange(e.target.value);
          }
        }}
      />
    </div>
  );
}

function formatChNumber(v: string): string {
  if (!v) return "";
  // Keep trailing decimal separator while typing
  const trailingDot = /[.,]$/.test(v);
  const parts = v.split(/[.,]/);
  const intPart = parts[0].replace(/[^\d-]/g, "");
  const decPart = parts[1]?.replace(/\D/g, "");
  if (intPart === "" && !decPart) return v;
  const n = Number(intPart);
  if (!Number.isFinite(n)) return v;
  const intFmt = n.toLocaleString("de-CH").replace(/\u202f|\u00a0/g, "'");
  if (decPart !== undefined) return `${intFmt}.${decPart}`;
  if (trailingDot) return `${intFmt}.`;
  return intFmt;
}

function SearchableSelect({
  value, onChange, items, placeholder, emptyText,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; hint?: string }[];
  placeholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected
              ? `${selected.label}${selected.hint ? ` · ${selected.hint}` : ""}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Suchen…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem
                  key={i.value}
                  value={`${i.label} ${i.hint ?? ""}`}
                  onSelect={() => { onChange(i.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === i.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1">
                    <div className="text-sm">{i.label}</div>
                    {i.hint && <div className="text-xs text-muted-foreground">{i.hint}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
