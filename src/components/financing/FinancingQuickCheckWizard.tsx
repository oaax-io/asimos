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
} from "lucide-react";
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
        status: "quick_check" as const,
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

/* ==================== Helpers ==================== */
function PlaceholderStep({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

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
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
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
