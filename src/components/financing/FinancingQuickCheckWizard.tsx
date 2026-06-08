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
import { formatCurrency, propertyTypeLabels } from "@/lib/format";
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

// Map property_type (CRM) → object_type (Wizard-Refi)
function mapPropertyTypeToObject(t: string | null | undefined): "" | "house" | "apartment" | "commercial" | "mixed_use" | "other" {
  switch (t) {
    case "house": return "house";
    case "apartment": return "apartment";
    case "commercial": return "commercial";
    case "mixed_use": return "mixed_use";
    case "land":
    case "parking":
    case "other":
      return "other";
    default: return "";
  }
}

// Max. Belehnung in % nach Nutzung
function maxLtvForUsage(usage: string): number {
  if (usage === "rental") return 75;
  return 80; // owner_occupied oder unbekannt → konservativ Standard
}

const OBJECT_TYPE_LABELS: Record<string, string> = {
  house: "Einfamilienhaus",
  apartment: "Eigentumswohnung",
  mixed_use: "Mehrfamilien-/Geschäftshaus",
  commercial: "Gewerbe",
  other: "Andere",
};

const REFI_PURPOSE_LABELS: Record<string, string> = {
  rate_optimisation: "Zinsoptimierung",
  bank_change: "Bankwechsel",
  consolidation: "Konsolidierung",
  cash_out: "Kapital-Auszahlung",
  other: "Andere",
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
  renovation_own_work: string;
  existing_mortgage: string;
  requested_mortgage: string;
  requested_increase: string;
  calc_rate: string;
  ancillary_pct: string;
  amortisation_years: string;

  // Refinanzierung – zusätzliche Felder (nur aktiv wenn isRefiOnly)
  usage_type: "" | "owner_occupied" | "rental";
  object_type: "" | "house" | "apartment" | "commercial" | "mixed_use" | "other";
  current_bank: string;
  interest_rate_current: string;
  interest_rate_expiry: string;
  refi_purpose: "" | "rate_optimisation" | "bank_change" | "consolidation" | "cash_out" | "other";
  monthly_obligations: string;
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
  renovation_own_work: "",
  existing_mortgage: "",
  requested_mortgage: "",
  requested_increase: "",
  calc_rate: "5",
  ancillary_pct: "1",
  amortisation_years: "15",
  usage_type: "",
  object_type: "",
  current_bank: "",
  interest_rate_current: "",
  interest_rate_expiry: "",
  refi_purpose: "",
  monthly_obligations: "",
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
        .select("id, title, address, city, postal_code, price, property_type, is_unit, unit_number, unit_type, unit_floor, parent_property_id")
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
      object_type: f.object_type || mapPropertyTypeToObject(p.property_type),
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

  // ---- Auto-Fill: Mitantragsteller (aus clients + Selbstauskunft) ----
  useEffect(() => {
    if (!form.co_applicant_enabled || !form.co_applicant_client_id) return;
    const c = clientsQuery.data?.find((x: { id: string }) => x.id === form.co_applicant_client_id) as
      | { id: string; full_name: string; email: string | null; equity: number | null }
      | undefined;
    if (c?.equity != null) {
      setForm((f) => ({
        ...f,
        co_applicant_eigenkapital: f.co_applicant_eigenkapital || String(c.equity),
      }));
    }
    (async () => {
      const { data } = await supabase
        .from("client_self_disclosures")
        .select("annual_net_salary, salary_net_monthly")
        .eq("client_id", form.co_applicant_client_id)
        .maybeSingle();
      if (!data) return;
      const yearly = data.annual_net_salary
        ?? (data.salary_net_monthly ? Number(data.salary_net_monthly) * 12 : null);
      if (yearly) {
        setForm((f) => ({
          ...f,
          co_applicant_einkommen: f.co_applicant_einkommen || String(yearly),
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.co_applicant_client_id, form.co_applicant_enabled, clientsQuery.data]);

  // ---- Kombinierte Werte (Haupt + Mitantragsteller) ----
  const combined = useMemo(() => {
    const mainIncome = num(form.gross_income_yearly);
    const mainEquity = num(form.own_funds_total);
    const mainPk = num(form.own_funds_pension_fund);
    const coActive = form.co_applicant_enabled && !!form.co_applicant_client_id;
    const coIncome = coActive ? num(form.co_applicant_einkommen) : 0;
    const coEquity = coActive ? num(form.co_applicant_eigenkapital) : 0;
    const coPk = coActive ? num(form.co_applicant_pk_anteil) : 0;
    // Einkommen nur kombinieren, wenn Co-Einkommen > 0
    const incomeCombined = coIncome > 0 ? mainIncome + coIncome : mainIncome;
    const equityCombined = mainEquity + coEquity;
    const pkCombined = mainPk + coPk;
    return {
      coActive,
      coIncomeMissing: coActive && coIncome <= 0,
      mainIncome, mainEquity, mainPk,
      coIncome, coEquity, coPk,
      incomeCombined, equityCombined, pkCombined,
    };
  }, [form]);

  // ---- Refinanzierungs-Modus (kein Kauf/Neubau, nur Bestand) ----
  const isRefiOnly = useMemo(() => {
    const m = form.modules;
    if (m.length === 0) return false;
    if (m.includes("purchase")) return false;
    return m.includes("refinance") || m.includes("increase") || m.includes("mortgage_increase");
  }, [form.modules]);

  // Effektive Hypothek: bei Refi = aktuelle Hypothek + Aufstockung
  const effectiveMortgage = useMemo(() => {
    if (isRefiOnly) return num(form.existing_mortgage) + num(form.requested_increase);
    return num(form.requested_mortgage);
  }, [isRefiOnly, form.existing_mortgage, form.requested_increase, form.requested_mortgage]);

  // ---- Live-KPIs (Schritt 4 + 5 + 6) ----
  const liveResult = useMemo(() => {
    return calcQuickCheck({
      purchase_price: numOrNull(form.property_purchase_price) ?? 0,
      renovation_costs: numOrNull(form.renovation_costs) ?? 0,
      requested_mortgage: effectiveMortgage,
      own_funds_total: combined.equityCombined,
      own_funds_pension_fund: combined.pkCombined || null,
      own_funds_vested_benefits: null,
      gross_income_yearly: combined.incomeCombined,
      calculated_interest_rate: numOrNull(form.calc_rate) ?? 5,
      ancillary_costs_yearly: null,
      amortisation_yearly: null,
    });
  }, [form, combined, effectiveMortgage]);

  // Tatsächliche Live-Kennzahlen mit Nebenkosten-% und Amortisation aus Schritt 5
  const liveKpis = useMemo(() => {
    const purchase = num(form.property_purchase_price);
    const reno = num(form.renovation_costs);
    const total = purchase + reno;
    const mortgage = effectiveMortgage;
    const equity = combined.equityCombined;
    const income = combined.incomeCombined;
    const rate = num(form.calc_rate) || 5;
    const ancPct = num(form.ancillary_pct) || 1;
    const years = num(form.amortisation_years) || 15;
    // Refi: Verpflichtungen (CHF/Monat) → jährlich in Tragbarkeit
    const obligationsYearly = isRefiOnly ? num(form.monthly_obligations) * 12 : 0;
    // Max. Belehnung nach Nutzung (nur Refi; sonst Standard 80%)
    const maxLtv = isRefiOnly && form.usage_type ? maxLtvForUsage(form.usage_type) : 80;

    const ltv = total > 0 ? (mortgage / total) * 100 : 0;
    const equityRatio = total > 0 ? (equity / total) * 100 : 0;
    const ancillary = total * (ancPct / 100);
    const firstMortgageMax = total * 0.6667;
    const secondMortgage = Math.max(0, mortgage - firstMortgageMax);
    const amort = years > 0 ? secondMortgage / years : 0;
    const yearly = mortgage * (rate / 100) + ancillary + amort + obligationsYearly;
    const affordability = income > 0 ? (yearly / income) * 100 : 0;
    // Aufstockungs-Plausibilität (Refi)
    const maxMortgageAllowed = total * (maxLtv / 100);
    const ltvExceeded = isRefiOnly && total > 0 && mortgage > maxMortgageAllowed;
    return { ltv, equityRatio, affordability, total, ancillary, amort, yearly, obligationsYearly, maxLtv, maxMortgageAllowed, ltvExceeded };
  }, [form, combined, effectiveMortgage, isRefiOnly]);

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
      const income = num(form.gross_income_yearly);
      if (isRefiOnly) {
        const existing = num(form.existing_mortgage);
        const mortgage = effectiveMortgage;
        const propertyVal = num(form.property_purchase_price); // dient als Objektwert
        return propertyVal > 0
          && existing > 0
          && mortgage > 0
          && income > 0
          && !!form.usage_type
          && !!form.object_type;
      }
      const equity = num(form.own_funds_total);
      const purchase = num(form.property_purchase_price);
      const mortgage = num(form.requested_mortgage);
      return purchase > 0 && equity >= 0 && income > 0 && mortgage > 0;
    }
    if (step === 5) return true;
    return true;
  }, [step, form, isRefiOnly, effectiveMortgage]);

  const navigate = useNavigate();

  const createMutation = useMutation({
    mutationFn: async () => {
      const purchase = numOrNull(form.property_purchase_price);
      const reno = numOrNull(form.renovation_costs);
      const mortgage = isRefiOnly ? effectiveMortgage : (numOrNull(form.requested_mortgage) ?? 0);
      const rate = numOrNull(form.calc_rate) ?? 5;
      const ancillary = liveKpis.ancillary || null;
      const amort = liveKpis.amort || null;

      // Kombinierte Werte für die Berechnung verwenden
      const equityCombined = combined.equityCombined;
      const pkCombined = combined.pkCombined;
      const incomeCombined = combined.incomeCombined;

      const result = calcQuickCheck({
        purchase_price: purchase,
        renovation_costs: reno,
        requested_mortgage: mortgage,
        own_funds_total: equityCombined,
        own_funds_pension_fund: pkCombined,
        own_funds_vested_benefits: null,
        gross_income_yearly: incomeCombined,
        calculated_interest_rate: rate,
        ancillary_costs_yearly: ancillary,
        amortisation_yearly: amort,
      });

      const primaryType: FinancingType = (form.modules[0] as FinancingType) ?? "purchase";

      const coActive = form.co_applicant_enabled && !!form.co_applicant_client_id;

      const payload: Record<string, unknown> = {
        client_id: form.client_source === "crm" && form.client_id ? form.client_id : null,
        property_id: form.property_source === "crm" && form.property_id ? form.property_id : null,
        property_snapshot: {
          ...(form.property_source !== "crm" ? {
            title: form.property_title || null,
            address: form.property_address || null,
            price: purchase,
          } : {}),
          ...(isRefiOnly && form.object_type ? { object_type: form.object_type } : {}),
        },
        data_source: form.property_source === "crm" ? "existing_property" : "quick_entry",
        financing_type: primaryType,
        financing_modules: form.modules,
        title: form.property_title || form.modules.map((m) => MODULE_OPTIONS.find((o) => o.key === m)?.label).filter(Boolean).join(" + "),
        purchase_price: purchase,
        property_value: isRefiOnly ? purchase : null,
        renovation_costs: reno,
        renovation_own_work: numOrNull(form.renovation_own_work),
        existing_mortgage: numOrNull(form.existing_mortgage),
        requested_increase: numOrNull(form.requested_increase),
        requested_mortgage: mortgage,
        new_total_mortgage: isRefiOnly ? effectiveMortgage : null,
        // Refinanzierungs-Details
        usage_type: isRefiOnly && form.usage_type ? form.usage_type : null,
        refi_purpose: isRefiOnly && form.refi_purpose ? form.refi_purpose : null,
        monthly_obligations: isRefiOnly ? (numOrNull(form.monthly_obligations) ?? null) : null,
        current_bank: isRefiOnly && form.current_bank ? form.current_bank : null,
        interest_rate_current: isRefiOnly ? (numOrNull(form.interest_rate_current) ?? null) : null,
        interest_rate_expiry: isRefiOnly && form.interest_rate_expiry ? form.interest_rate_expiry : null,
        // Hauptantragsteller-Einzelwerte (unverändert)
        own_funds_total: combined.mainEquity || null,
        own_funds_pension_fund: combined.mainPk || null,
        gross_income_yearly: combined.mainIncome || null,
        // Mitantragsteller
        co_applicant_client_id: coActive ? form.co_applicant_client_id : null,
        co_applicant_role: coActive ? form.co_applicant_role || null : null,
        co_applicant_einkommen: coActive ? combined.coIncome : null,
        co_applicant_eigenkapital: coActive ? combined.coEquity : null,
        co_applicant_pk_anteil: coActive ? combined.coPk : null,
        // Kombiniert
        einkommen_kombiniert: incomeCombined || null,
        eigenkapital_kombiniert: equityCombined || null,
        pk_anteil_kombiniert: pkCombined || null,
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
        .insert(payload as never)
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
        {step === 4 && <Step4Metrics form={form} update={update} kpis={liveKpis} isRefiOnly={isRefiOnly} effectiveMortgage={effectiveMortgage} />}
        {step === 5 && <Step5Advanced form={form} update={update} kpis={liveKpis} />}
        {step === 6 && (
          <Step6Summary
            form={form}
            kpis={liveKpis}
            status={liveResult.status}
            clients={clientsQuery.data ?? []}
            properties={propertiesQuery.data ?? []}
            isRefiOnly={isRefiOnly}
            effectiveMortgage={effectiveMortgage}
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

      {form.property_source === "crm" && (() => {
        const selected: any = properties.find((p: any) => p.id === form.property_id);
        // The "object" reference: if a unit is selected, its parent; else the selected itself
        const objectId: string | null = selected
          ? (selected.is_unit ? (selected.parent_property_id ?? null) : selected.id)
          : null;
        // Top-level objects to choose from = non-units (parents and standalone properties)
        const topLevel = properties.filter((p: any) => !p.is_unit);
        // Units belonging to the currently chosen object
        const units = objectId
          ? properties.filter((p: any) => p.is_unit && p.parent_property_id === objectId)
          : [];
        const unitSelectValue = selected?.is_unit ? selected.id : "__whole__";
        return (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Objekt</Label>
              <SearchableSelect
                placeholder={loading ? "Lade…" : "Objekt suchen…"}
                emptyText="Kein Objekt gefunden."
                value={objectId ?? ""}
                onChange={(v) => update("property_id", v)}
                items={topLevel.map((p: any) => {
                  const typeLabel =
                    propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels] || "—";
                  const unitCount = properties.filter(
                    (x: any) => x.is_unit && x.parent_property_id === p.id
                  ).length;
                  return {
                    value: p.id,
                    label: [p.city || "—", typeLabel].filter(Boolean).join(" · "),
                    hint: [
                      unitCount > 0
                        ? `${unitCount} Einheit${unitCount === 1 ? "" : "en"}`
                        : "Keine Einheiten",
                      p.address || p.title || null,
                      p.price ? formatCurrency(Number(p.price)) : null,
                    ].filter(Boolean).join(" · ") || undefined,
                  };
                })}
              />
            </div>

            {objectId && units.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Gesamtobjekt oder Einheit</Label>
                <SearchableSelect
                  placeholder="Gesamtes Objekt oder Einheit wählen…"
                  emptyText="Keine Einheit gefunden."
                  value={unitSelectValue}
                  onChange={(v) => update("property_id", v === "__whole__" ? objectId : v)}
                  items={[
                    {
                      value: "__whole__",
                      label: "Gesamtes Objekt",
                      hint: `Alle ${units.length} Einheit${units.length === 1 ? "" : "en"} inkl.`,
                    },
                    ...units.map((u: any) => {
                      const typeLabel =
                        propertyTypeLabels[u.property_type as keyof typeof propertyTypeLabels] || "—";
                      const bits = [
                        u.unit_number ? `Nr. ${u.unit_number}` : null,
                        u.unit_floor ? `${u.unit_floor}. OG` : null,
                        u.unit_type || typeLabel,
                      ].filter(Boolean);
                      return {
                        value: u.id,
                        label: `Einheit · ${bits.join(" · ")}`,
                        hint: u.price ? formatCurrency(Number(u.price)) : undefined,
                      };
                    }),
                  ]}
                />
              </div>
            )}

            {form.property_id && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kaufpreis (CHF)" type="number" value={form.property_purchase_price} onChange={(v) => update("property_purchase_price", v)} />
                <div className="sm:col-span-2 sm:col-start-1">
                  <Field label="Adresse" value={form.property_address} onChange={(v) => update("property_address", v)} />
                </div>
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Werte aus CRM vorausgefüllt. Anpassungen gelten nur für diesen Quick Check.
                </p>
              </div>
            )}
          </div>
        );
      })()}

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
type ClientLite = { id: string; full_name: string; email: string | null; equity: number | null };

function Step3Client({
  form, update, clients, loading,
}: {
  form: WizardForm;
  update: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  clients: ClientLite[];
  loading: boolean;
}) {
  // Verknüpfte Personen des Hauptkunden (Ehepartner, Mitantragsteller, …)
  const relatedQuery = useQuery({
    queryKey: ["wizard_client_relationships", form.client_id],
    enabled: !!form.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_relationships")
        .select("related_client_id, relationship_type")
        .eq("client_id", form.client_id);
      if (error) throw error;
      return (data ?? []) as { related_client_id: string; relationship_type: string }[];
    },
  });
  const relatedMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of relatedQuery.data ?? []) m.set(r.related_client_id, r.relationship_type);
    return m;
  }, [relatedQuery.data]);

  // Auto-Aktivierung: genau ein Ehepartner verknüpft → vorschlagen
  useEffect(() => {
    if (!form.client_id || form.co_applicant_enabled) return;
    const list = relatedQuery.data ?? [];
    const spouses = list.filter((r) => r.relationship_type === "spouse");
    const candidates = spouses.length > 0 ? spouses : list.filter((r) => r.relationship_type === "co_applicant");
    if (candidates.length === 1) {
      update("co_applicant_enabled", true);
      update("co_applicant_client_id", candidates[0].related_client_id);
      update("co_applicant_role", spouses.length === 1 ? "ehepartner" : "mitantragsteller");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatedQuery.data, form.client_id]);

  const toggleCoApplicant = (enabled: boolean) => {
    if (enabled) {
      update("co_applicant_enabled", true);
    } else {
      // Alle Co-Applicant-Felder leeren
      update("co_applicant_enabled", false);
      update("co_applicant_role", "");
      update("co_applicant_client_id", "");
      update("co_applicant_einkommen", "");
      update("co_applicant_eigenkapital", "");
      update("co_applicant_pk_anteil", "");
    }
  };

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

      {/* === Mitantragsteller (optional) === */}
      {form.client_source === "crm" && (
        <CoApplicantSection
          form={form}
          update={update}
          clients={clients}
          loading={loading}
          toggle={toggleCoApplicant}
          relatedMap={relatedMap}
        />
      )}
    </div>
  );
}

function CoApplicantSection({
  form, update, clients, loading, toggle, relatedMap,
}: {
  form: WizardForm;
  update: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  clients: ClientLite[];
  loading: boolean;
  toggle: (enabled: boolean) => void;
  relatedMap: Map<string, string>;
}) {
  const relLabel: Record<string, string> = {
    spouse: "Ehepartner", co_applicant: "Mitantragsteller",
    co_investor: "Mitinvestor", other: "Verbunden",
  };
  const selected = clients.find((c) => c.id === form.co_applicant_client_id);
  const filtered = clients.filter((c) => c.id !== form.client_id);
  const hasRelated = relatedMap.size > 0;
  const sorted = [...filtered].sort((a, b) => {
    const ar = relatedMap.has(a.id) ? 0 : 1;
    const br = relatedMap.has(b.id) ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.full_name.localeCompare(b.full_name);
  });
  const items = sorted.map((c) => {
    const rel = relatedMap.get(c.id);
    const hint = rel
      ? `${relLabel[rel] ?? "Verbunden"}${c.email ? ` · ${c.email}` : ""}`
      : (c.email ?? undefined);
    return { value: c.id, label: c.full_name, hint };
  });

  const incomeNum = num(form.co_applicant_einkommen);
  const equityNum = num(form.co_applicant_eigenkapital);
  const pkNum = num(form.co_applicant_pk_anteil);

  const hasIncome = incomeNum > 0;
  const hasEquity = equityNum > 0;
  const hasPk = pkNum > 0;
  const anyMissing = selected && (!hasIncome || !hasEquity || !hasPk);

  // Kombinierte Anzeige
  const mainIncome = num(form.gross_income_yearly);
  const mainEquity = num(form.own_funds_total);
  const mainPk = num(form.own_funds_pension_fund);
  const incomeCombined = hasIncome ? mainIncome + incomeNum : mainIncome;
  const equityCombined = mainEquity + equityNum;
  const pkCombined = mainPk + pkNum;

  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label htmlFor="co-applicant-toggle" className="text-sm font-medium cursor-pointer">
              Mitantragsteller / Ehepartner hinzufügen
            </Label>
            <p className="text-xs text-muted-foreground">
              {hasRelated
                ? "Verknüpfte Personen aus dem Kundenprofil werden zuerst angezeigt."
                : "Optional — kombiniert Einkommen und Eigenmittel für die Berechnung."}
            </p>
          </div>
        </div>
        <Switch
          id="co-applicant-toggle"
          checked={form.co_applicant_enabled}
          onCheckedChange={toggle}
        />
      </div>

      {form.co_applicant_enabled && (
        <div className="space-y-4 border-t pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Rolle *</Label>
              <Select
                value={form.co_applicant_role || ""}
                onValueChange={(v) => update("co_applicant_role", v as CoApplicantRole)}
              >
                <SelectTrigger><SelectValue placeholder="Rolle wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ehepartner">Ehepartner/in</SelectItem>
                  <SelectItem value="mitantragsteller">Mitantragsteller/in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kunde aus CRM</Label>
              <SearchableSelect
                placeholder={loading ? "Lade…" : "Kunde suchen…"}
                emptyText="Keinen Kunden gefunden."
                value={form.co_applicant_client_id}
                onChange={(v) => update("co_applicant_client_id", v)}
                items={items}
              />
            </div>
          </div>

          {selected && (
            <>
              <DataQualityChecklist
                hasIncome={hasIncome}
                hasEquity={hasEquity}
                hasPk={hasPk}
                income={incomeNum}
                equity={equityNum}
                pk={pkNum}
              />

              {anyMissing && (
                <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-2">
                  <p className="text-amber-800 dark:text-amber-200">
                    Einige Daten von <span className="font-medium">{selected.full_name}</span> sind
                    noch nicht erfasst. Ergänze die fehlenden Angaben im Kundenprofil für eine
                    vollständige Berechnung.
                  </p>
                  <a
                    href={`/clients/${selected.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-amber-900 dark:text-amber-100 hover:underline"
                  >
                    Zum Kundenprofil <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {!hasIncome && (
                <div className="rounded-md border border-red-300/60 bg-red-50 dark:bg-red-950/30 p-3 text-xs flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-red-800 dark:text-red-200">
                    Das Einkommen ist für die Tragbarkeitsberechnung zwingend erforderlich.
                    Ohne diesen Wert wird der Mitantragsteller in der Berechnung nicht berücksichtigt.
                  </p>
                </div>
              )}

              {/* Manuelle Korrektur der übernommenen Werte */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Einkommen (CHF/J)" type="number" value={form.co_applicant_einkommen} onChange={(v) => update("co_applicant_einkommen", v)} />
                <Field label="Eigenkapital (CHF)" type="number" value={form.co_applicant_eigenkapital} onChange={(v) => update("co_applicant_eigenkapital", v)} />
                <Field label="PK-Anteil (CHF)" type="number" value={form.co_applicant_pk_anteil} onChange={(v) => update("co_applicant_pk_anteil", v)} />
              </div>

              <div className="rounded-md bg-background border p-3 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> Kombinierte Werte
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex justify-between"><span>Kombiniertes Einkommen:</span><span className="tabular-nums font-medium text-foreground">{formatCurrency(incomeCombined)} / Jahr</span></div>
                  <div className="flex justify-between"><span>Kombinierte Eigenmittel:</span><span className="tabular-nums font-medium text-foreground">{formatCurrency(equityCombined)}</span></div>
                  <div className="flex justify-between"><span>Kombinierter PK-Anteil:</span><span className="tabular-nums font-medium text-foreground">{formatCurrency(pkCombined)}</span></div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DataQualityChecklist({
  hasIncome, hasEquity, income, equity, pk,
}: {
  hasIncome: boolean; hasEquity: boolean; hasPk: boolean;
  income: number; equity: number; pk: number;
}) {
  const Row = ({ ok, label, value, fallback }: {
    ok: boolean; label: string; value: string; fallback: string;
  }) => (
    <li className={cn(
      "flex items-start justify-between gap-3 text-xs py-1.5",
      ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
    )}>
      <span className="flex items-center gap-2 shrink-0">
        {ok
          ? <Check className="h-3.5 w-3.5" />
          : <span className="text-base leading-none">✗</span>}
        {label}
      </span>
      <span className="text-right tabular-nums">{ok ? value : fallback}</span>
    </li>
  );
  return (
    <ul className="rounded-md border bg-background p-3 divide-y divide-border/50">
      <Row
        ok={hasIncome}
        label="Brutto-Jahreseinkommen"
        value={`${formatCurrency(income)} / Jahr (aus Selbstauskunft)`}
        fallback="nicht erfasst"
      />
      <Row
        ok={hasEquity}
        label="Eigenkapital"
        value={formatCurrency(equity)}
        fallback="nicht erfasst"
      />
      {/* PK nicht aus dem CRM — optional, aber grün sobald manuell erfasst */}
      <Row
        ok={pk > 0}
        label="PK / Freizügigkeit"
        value={`${formatCurrency(pk)} (manuell)`}
        fallback="optional — nicht im CRM (Standard: CHF 0)"
      />
    </ul>
  );
}

/* ==================== Schritt 4 ==================== */
type Kpis = {
  ltv: number; equityRatio: number; affordability: number;
  total: number; ancillary: number; amort: number; yearly: number;
  obligationsYearly: number; maxLtv: number; maxMortgageAllowed: number; ltvExceeded: boolean;
};

function KpiPreview({ kpis, hideEquity }: { kpis: Kpis; hideEquity?: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      Belehnung: <span className="font-medium text-foreground">{kpis.ltv.toFixed(1)}%</span>
      {" · "}Tragbarkeit: <span className="font-medium text-foreground">{kpis.affordability.toFixed(1)}%</span>
      {!hideEquity && <>{" · "}Eigenmittelquote: <span className="font-medium text-foreground">{kpis.equityRatio.toFixed(1)}%</span></>}
    </p>
  );
}

function Step4Metrics({
  form, update, kpis, isRefiOnly, effectiveMortgage,
}: {
  form: WizardForm;
  update: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void;
  kpis: Kpis;
  isRefiOnly: boolean;
  effectiveMortgage: number;
}) {
  const showRenovation = form.modules.includes("renovation");
  const objectValueFromCrm = isRefiOnly && form.property_source === "crm" && !!form.property_purchase_price;
  return (
    <div className="space-y-4">
      {isRefiOnly ? (
        <>
          {/* Objekt-Block */}
          <div className="grid gap-3 sm:grid-cols-2">
            {objectValueFromCrm ? (
              <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 text-sm flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block">Aktueller Objektwert (aus CRM)</span>
                  <span className="font-semibold text-base">{formatCurrency(num(form.property_purchase_price))}</span>
                </div>
                <span className="text-xs text-muted-foreground">Anpassen in Schritt 2</span>
              </div>
            ) : (
              <Field
                label="Aktueller Objektwert / Verkehrswert (CHF) *"
                type="number"
                value={form.property_purchase_price}
                onChange={(v) => update("property_purchase_price", v)}
              />
            )}
            <div className="space-y-1">
              <Label className="text-xs">Nutzung *</Label>
              <Select value={form.usage_type} onValueChange={(v) => update("usage_type", v as WizardForm["usage_type"])}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner_occupied">Eigennutzung (selbst bewohnt)</SelectItem>
                  <SelectItem value="rental">Renditeobjekt (vermietet)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Objektart *</Label>
              <Select value={form.object_type} onValueChange={(v) => update("object_type", v as WizardForm["object_type"])}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="house">Einfamilienhaus</SelectItem>
                  <SelectItem value="apartment">Eigentumswohnung</SelectItem>
                  <SelectItem value="mixed_use">Mehrfamilien-/Geschäftshaus</SelectItem>
                  <SelectItem value="commercial">Gewerbe</SelectItem>
                  <SelectItem value="other">Andere</SelectItem>
                </SelectContent>
              </Select>
              {form.property_source === "crm" && form.object_type && (
                <p className="text-[10px] text-muted-foreground">Vorausgefüllt aus CRM-Objekt</p>
              )}
            </div>
          </div>

          {/* Hypothek-Block */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Aktuelle Hypothek (CHF) *" type="number" value={form.existing_mortgage} onChange={(v) => update("existing_mortgage", v)} />
            <Field label="Aufstockungsbetrag (CHF)" type="number" value={form.requested_increase} onChange={(v) => update("requested_increase", v)} />
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex flex-col justify-center sm:col-span-2">
              <span className="text-xs text-muted-foreground">Neue Gesamthypothek</span>
              <span className="font-semibold text-base">{formatCurrency(effectiveMortgage)}</span>
              <span className="text-xs text-muted-foreground mt-1">= Aktuelle Hypothek + Aufstockungsbetrag</span>
            </div>
            {kpis.ltvExceeded && (
              <div className="sm:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                ⚠ Die neue Gesamthypothek übersteigt die max. Belehnung ({kpis.maxLtv}% des Objektwerts ={" "}
                {formatCurrency(kpis.maxMortgageAllowed)}). Aufstockung ggf. reduzieren oder Eigenmittel einbringen.
              </div>
            )}
          </div>

          {/* Bestehende Finanzierung */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Aktuelle Bank" value={form.current_bank} onChange={(v) => update("current_bank", v)} />
            <Field label="Aktueller Zinssatz (%)" type="number" value={form.interest_rate_current} onChange={(v) => update("interest_rate_current", v)} />
            <Field label="Ablauf Zinsbindung" type="date" value={form.interest_rate_expiry} onChange={(v) => update("interest_rate_expiry", v)} />
          </div>

          {/* Zweck + Verpflichtungen + Einkommen */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Refinanzierungs-Zweck</Label>
              <Select value={form.refi_purpose} onValueChange={(v) => update("refi_purpose", v as WizardForm["refi_purpose"])}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rate_optimisation">Zinsoptimierung</SelectItem>
                  <SelectItem value="bank_change">Bankwechsel</SelectItem>
                  <SelectItem value="consolidation">Konsolidierung</SelectItem>
                  <SelectItem value="cash_out">Kapital-Auszahlung</SelectItem>
                  <SelectItem value="other">Andere</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field label="Brutto-Jahreseinkommen (CHF) *" type="number" value={form.gross_income_yearly} onChange={(v) => update("gross_income_yearly", v)} />
            <Field
              label="Monatliche Verpflichtungen (CHF) — Leasing, Kredite, Alimente"
              type="number"
              value={form.monthly_obligations}
              onChange={(v) => update("monthly_obligations", v)}
            />
            {showRenovation && (
              <Field label="Renovationskosten (CHF)" type="number" value={form.renovation_costs} onChange={(v) => update("renovation_costs", v)} />
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Hinweis: Bei reiner Refinanzierung sind Eigenmittel/PK nicht erforderlich. Die Belehnungsgrenze richtet sich nach der Nutzung
            ({form.usage_type === "rental" ? "Renditeobjekt → max. 75 %" : "Eigennutzung → max. 80 %"}).
          </p>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kaufpreis (CHF) *" type="number" value={form.property_purchase_price} onChange={(v) => update("property_purchase_price", v)} />
          <Field label="Gewünschte Hypothek (CHF) *" type="number" value={form.requested_mortgage} onChange={(v) => update("requested_mortgage", v)} />
          <Field label="Eigenmittel total (CHF) *" type="number" value={form.own_funds_total} onChange={(v) => update("own_funds_total", v)} />
          <Field label="davon PK / Freizügigkeit (CHF)" type="number" value={form.own_funds_pension_fund} onChange={(v) => update("own_funds_pension_fund", v)} />
          <Field label="Brutto-Jahreseinkommen (CHF) *" type="number" value={form.gross_income_yearly} onChange={(v) => update("gross_income_yearly", v)} />
          {showRenovation && (
            <>
              <Field label="Renovationskosten (CHF)" type="number" value={form.renovation_costs} onChange={(v) => update("renovation_costs", v)} />
              <Field label="davon Eigenleistung (CHF)" type="number" value={form.renovation_own_work} onChange={(v) => update("renovation_own_work", v)} />
            </>
          )}
        </div>
      )}
      <div className="rounded-lg bg-muted/50 p-3">
        <KpiPreview kpis={kpis} hideEquity={isRefiOnly} />
        {isRefiOnly && kpis.obligationsYearly > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Inkl. Verpflichtungen {formatCurrency(kpis.obligationsYearly)}/Jahr in der Tragbarkeit.
          </p>
        )}
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
  form, kpis, status, clients, properties, isRefiOnly, effectiveMortgage,
}: {
  form: WizardForm;
  kpis: Kpis;
  status: string;
  clients: any[];
  properties: any[];
  isRefiOnly: boolean;
  effectiveMortgage: number;
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
  const propertyValueLabel = isRefiOnly ? "Objektwert / Verkehrswert" : "Kaufpreis";

  return (
    <div className="space-y-4">
      <SummaryGroup title="Finanzierungsart">
        <SumRow label="Module" value={moduleLabels || "—"} />
      </SummaryGroup>

      <SummaryGroup title="Immobilie">
        <SumRow label="Bezeichnung" value={propertyLabel} />
        {form.property_address && <SumRow label="Adresse" value={form.property_address} />}
        {form.property_purchase_price && <SumRow label={propertyValueLabel} value={formatCurrency(num(form.property_purchase_price))} />}
        {isRefiOnly && form.object_type && <SumRow label="Objektart" value={OBJECT_TYPE_LABELS[form.object_type]} />}
        {isRefiOnly && form.usage_type && <SumRow label="Nutzung" value={form.usage_type === "rental" ? "Renditeobjekt" : "Eigennutzung"} />}
      </SummaryGroup>

      <SummaryGroup title="Kunde">
        <SumRow label="Kunde" value={clientLabel} />
        {form.gross_income_yearly && <SumRow label="Brutto-Jahreseinkommen" value={formatCurrency(num(form.gross_income_yearly))} />}
        {!isRefiOnly && form.own_funds_total && <SumRow label="Eigenmittel total" value={formatCurrency(num(form.own_funds_total))} />}
        {!isRefiOnly && form.own_funds_pension_fund && <SumRow label="davon PK / Freizügigkeit" value={formatCurrency(num(form.own_funds_pension_fund))} />}
        {isRefiOnly && form.monthly_obligations && <SumRow label="Monatl. Verpflichtungen" value={formatCurrency(num(form.monthly_obligations))} />}
      </SummaryGroup>

      {isRefiOnly && (form.current_bank || form.interest_rate_current || form.interest_rate_expiry || form.refi_purpose) && (
        <SummaryGroup title="Bestehende Finanzierung">
          {form.current_bank && <SumRow label="Aktuelle Bank" value={form.current_bank} />}
          {form.interest_rate_current && <SumRow label="Aktueller Zinssatz" value={`${num(form.interest_rate_current).toFixed(2)} %`} />}
          {form.interest_rate_expiry && <SumRow label="Ablauf Zinsbindung" value={form.interest_rate_expiry} />}
          {form.refi_purpose && <SumRow label="Zweck" value={REFI_PURPOSE_LABELS[form.refi_purpose]} />}
        </SummaryGroup>
      )}

      <SummaryGroup title="Kennzahlen">
        {isRefiOnly ? (
          <>
            <SumRow label="Aktuelle Hypothek" value={formatCurrency(num(form.existing_mortgage))} />
            <SumRow label="Aufstockungsbetrag" value={formatCurrency(num(form.requested_increase))} />
            <SumRow label="Neue Gesamthypothek" value={formatCurrency(effectiveMortgage)} />
          </>
        ) : (
          <>
            <SumRow label="Gewünschte Hypothek" value={formatCurrency(num(form.requested_mortgage))} />
            {form.existing_mortgage && <SumRow label="Bestehende Hypothek" value={formatCurrency(num(form.existing_mortgage))} />}
          </>
        )}
        {form.renovation_costs && <SumRow label="Renovationskosten" value={formatCurrency(num(form.renovation_costs))} />}
        {form.renovation_own_work && <SumRow label="davon Eigenleistung" value={formatCurrency(num(form.renovation_own_work))} />}
        <SumRow label="Kalk. Zinssatz" value={`${num(form.calc_rate).toFixed(1)} %`} />
        <SumRow label="Nebenkosten" value={`${num(form.ancillary_pct).toFixed(1)} %`} />
        <SumRow label="Amortisationsdauer" value={`${form.amortisation_years} Jahre`} />
      </SummaryGroup>

      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold">Live-Vorschau</p>
          <StatusBadge status={status} />
        </div>
        <KpiPreview kpis={kpis} hideEquity={isRefiOnly} />
        {isRefiOnly && kpis.ltvExceeded && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
            ⚠ Neue Gesamthypothek übersteigt max. Belehnung von {kpis.maxLtv}% ({formatCurrency(kpis.maxMortgageAllowed)}).
          </p>
        )}
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
          className="h-auto min-h-10 w-full justify-between py-2 font-normal"
        >
          <span className="min-w-0 text-left">
            {selected ? (
              <span className="block min-w-0">
                <span className="block truncate text-sm">{selected.label}</span>
                {selected.hint && (
                  <span className="block truncate text-xs text-muted-foreground">{selected.hint}</span>
                )}
              </span>
            ) : (
              <span className="block truncate text-sm">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col"
          filter={(value, search) => {
            const item = items.find((i) => i.value === value);
            if (!item) return 0;
            const hay = `${item.label} ${item.hint ?? ""}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Suchen…" />
          <CommandList
            className="max-h-none flex-1 overflow-y-auto overscroll-contain"
            onWheelCapture={(e) => e.stopPropagation()}
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem
                  key={i.value}
                  value={i.value}
                  className="items-start py-2"
                  onSelect={() => { onChange(i.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === i.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{i.label}</div>
                    {i.hint && <div className="text-xs text-muted-foreground truncate">{i.hint}</div>}
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
