import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Home, Hammer, ArrowUpCircle, Repeat2, Building, TrendingUp,
  CheckCircle2, AlertTriangle, XCircle, Info, ArrowLeft, ArrowRight,
  Database, PencilLine,
} from "lucide-react";
import {
  FINANCING_TYPE_LABELS, FINANCING_TYPE_DESCRIPTIONS,
  calcQuickCheck, type FinancingType, type QuickCheckStatus,
} from "@/lib/financing";
import {
  fieldsForModules, computeFinancingMulti, toNumOrNull,
  type DynamicForm, type FieldKey,
} from "@/lib/financing-fields";
import { formatCurrency } from "@/lib/format";

const TYPE_ICONS: Record<FinancingType, any> = {
  purchase: Home,
  renovation: Hammer,
  increase: ArrowUpCircle,
  refinance: Repeat2,
  new_build: Building,
  mortgage_increase: TrendingUp,
};

type DataSource = "existing_property" | "quick_entry";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (dossierId: string) => void;
  defaultClientId?: string;
  defaultPropertyId?: string;
};

export function FinancingQuickCheckWizard({
  open, onOpenChange, onCreated, defaultClientId, defaultPropertyId,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [modules, setModules] = useState<FinancingType[]>(["purchase"]);
  const [dataSource, setDataSource] = useState<DataSource>(
    defaultPropertyId ? "existing_property" : "existing_property"
  );
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId ?? "");
  const [snapshot, setSnapshot] = useState({ title: "", address: "", city: "", postal_code: "" });
  const [form, setForm] = useState<DynamicForm>({});
  const [calcRate, setCalcRate] = useState("5");
  const [ancillary, setAncillary] = useState("");
  const [amortisation, setAmortisation] = useState("");

  const TOTAL_STEPS = 7;
  const fields = useMemo(() => fieldsForModules(modules), [modules]);
  const primaryType: FinancingType = modules[0] ?? "purchase";

  const toggleModule = (m: FinancingType) => {
    setModules((prev) => {
      if (prev.includes(m)) {
        const next = prev.filter((x) => x !== m);
        return next.length ? next : prev; // mind. 1 erforderlich
      }
      return [...prev, m];
    });
  };

  useEffect(() => {
    if (!open) {
      setStep(1);
      setModules(["purchase"]);
      setDataSource(defaultPropertyId ? "existing_property" : "existing_property");
      setClientId(defaultClientId ?? "");
      setPropertyId(defaultPropertyId ?? "");
      setSnapshot({ title: "", address: "", city: "", postal_code: "" });
      setForm({});
      setCalcRate("5");
      setAncillary("");
      setAmortisation("");
    }
  }, [open, defaultClientId, defaultPropertyId]);

  // Felder zurücksetzen bei Modulwechsel (nicht relevante leeren)
  useEffect(() => {
    setForm((prev) => {
      const allowed = new Set<FieldKey>(fields.map((f) => f.key));
      const next: DynamicForm = {};
      allowed.forEach((k) => { next[k] = prev[k] ?? ""; });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules.join("|")]);

  const clientsQuery = useQuery({
    queryKey: ["financing_wizard_clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const propertiesQuery = useQuery({
    queryKey: ["financing_wizard_properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, address, city, postal_code, price, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && dataSource === "existing_property",
  });

  const selectedClient = clientsQuery.data?.find((c: any) => c.id === clientId);
  const selectedProperty = propertiesQuery.data?.find((p: any) => p.id === propertyId);

  // Auto-Übernahme aus Immobilie
  useEffect(() => {
    if (!selectedProperty) return;
    setForm((f) => {
      const next = { ...f };
      const set = new Set(modules);
      if (selectedProperty.price) {
        if (set.has("purchase") && !next.purchase_price) {
          next.purchase_price = String(selectedProperty.price);
        }
        if (!set.has("purchase") && !set.has("new_build") && !next.property_value) {
          next.property_value = String(selectedProperty.price);
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, modules.join("|")]);

  // Auto-Übernahme aus Selbstauskunft
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const { data } = await supabase
        .from("client_self_disclosures")
        .select("annual_net_salary, salary_net_monthly")
        .eq("client_id", clientId)
        .maybeSingle();
      if (data && !form.gross_income_yearly) {
        const yearly = data.annual_net_salary
          ?? (data.salary_net_monthly ? Number(data.salary_net_monthly) * 12 : null);
        if (yearly) setForm((f) => ({ ...f, gross_income_yearly: String(yearly) }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const computed = useMemo(() => computeFinancingMulti(modules, form), [modules, form]);

  const result = useMemo(() => calcQuickCheck({
    purchase_price: computed.reference_value,
    renovation_costs: 0,
    requested_mortgage: computed.effective_mortgage,
    own_funds_total: toNumOrNull(form.own_funds_total) ?? Math.max(0, computed.reference_value - computed.effective_mortgage),
    own_funds_pension_fund: toNumOrNull(form.own_funds_pension_fund),
    own_funds_vested_benefits: toNumOrNull(form.own_funds_vested_benefits),
    gross_income_yearly: toNumOrNull(form.gross_income_yearly),
    calculated_interest_rate: parseFloat(calcRate) || 5,
    ancillary_costs_yearly: toNumOrNull(ancillary),
    amortisation_yearly: toNumOrNull(amortisation),
  }), [computed, form, calcRate, ancillary, amortisation]);

  const moduleLabel = (m: FinancingType) => FINANCING_TYPE_LABELS[m];
  const modulesLabel = modules.map(moduleLabel).join(" + ");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Bitte Kunden auswählen");

      // Nur Felder befüllen, die zur Modul-Kombination gehören
      const allowed = new Set<FieldKey>(fields.map((f) => f.key));
      const fieldVal = (k: FieldKey) => (allowed.has(k) ? toNumOrNull(form[k]) : null);
      const txtVal = (k: FieldKey) => (allowed.has(k) ? (form[k] || null) : null);

      const payload: any = {
        client_id: clientId,
        property_id: dataSource === "existing_property" ? (propertyId || null) : null,
        financing_type: primaryType,
        financing_modules: modules,
        data_source: dataSource,
        property_snapshot: dataSource === "quick_entry" ? snapshot : {},
        title: `${modulesLabel}${selectedClient ? " – " + selectedClient.full_name : ""}`,

        // Modul-spezifische Felder
        purchase_price: fieldVal("purchase_price"),
        purchase_additional_costs: fieldVal("purchase_additional_costs"),
        renovation_costs: fieldVal("renovation_costs"),
        renovation_description: txtVal("renovation_description"),
        renovation_value_increase: fieldVal("renovation_value_increase"),
        property_value: fieldVal("property_value"),
        existing_mortgage: fieldVal("existing_mortgage"),
        requested_mortgage: fieldVal("requested_mortgage"),
        requested_increase: fieldVal("requested_increase"),
        new_total_mortgage: computed.new_total_mortgage || null,
        land_price: fieldVal("land_price"),
        construction_costs: fieldVal("construction_costs"),
        construction_additional_costs: fieldVal("construction_additional_costs"),
        current_bank: txtVal("current_bank"),
        interest_rate_expiry: allowed.has("interest_rate_expiry") ? (form.interest_rate_expiry || null) : null,

        // Eigenmittel & Einkommen
        own_funds_total: fieldVal("own_funds_total"),
        own_funds_pension_fund: fieldVal("own_funds_pension_fund"),
        own_funds_vested_benefits: fieldVal("own_funds_vested_benefits"),
        gross_income_yearly: fieldVal("gross_income_yearly"),

        // Berechnete Werte
        total_investment: computed.total_investment || null,
        loan_to_value_ratio: result.loan_to_value_ratio || null,
        affordability_ratio: result.affordability_ratio || null,
        calculated_interest_rate: parseFloat(calcRate) || 5,
        ancillary_costs_yearly: toNumOrNull(ancillary),
        amortisation_yearly: toNumOrNull(amortisation),
        quick_check_status: result.status,
        quick_check_reasons: result.reasons,
        dossier_status: "quick_check" as const,
      };


      const { data, error } = await supabase
        .from("financing_dossiers")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["financing_dossiers"] });
      toast.success("Dossier erstellt");
      onCreated?.(data.id);
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  const requiredFilled = useMemo(() => {
    return fields.filter((f) => f.required).every((f) => (form[f.key] ?? "").toString().trim() !== "");
  }, [fields, form]);

  const canNext = () => {
    if (step === 1) return modules.length > 0;
    if (step === 2) return !!dataSource;
    if (step === 3) return !!clientId;
    if (step === 4) {
      if (dataSource === "quick_entry") return !!snapshot.title;
      return true;
    }
    if (step === 5) return requiredFilled;
    if (step === 6) return (toNumOrNull(form.gross_income_yearly) ?? 0) > 0;
    return true;
  };

  const updateField = (k: FieldKey, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Check Finanzierung – Schritt {step} / {TOTAL_STEPS}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 my-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded ${i < step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {/* 1. Finanzierungsart */}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(FINANCING_TYPE_LABELS) as FinancingType[]).map((t) => {
              const Icon = TYPE_ICONS[t];
              const active = financingType === t;
              return (
                <Card
                  key={t}
                  onClick={() => setFinancingType(t)}
                  className={`cursor-pointer p-4 transition ${active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${active ? "bg-primary/15" : "bg-muted"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{FINANCING_TYPE_LABELS[t]}</p>
                      <p className="text-xs text-muted-foreground">{FINANCING_TYPE_DESCRIPTIONS[t]}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* 2. Datenbasis */}
        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card
              onClick={() => setDataSource("existing_property")}
              className={`cursor-pointer p-4 transition ${dataSource === "existing_property" ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${dataSource === "existing_property" ? "bg-primary/15" : "bg-muted"}`}>
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Bestehende Immobilie verwenden</p>
                  <p className="text-xs text-muted-foreground">Immobilie aus dem System auswählen, Daten werden übernommen.</p>
                </div>
              </div>
            </Card>
            <Card
              onClick={() => setDataSource("quick_entry")}
              className={`cursor-pointer p-4 transition ${dataSource === "quick_entry" ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-lg p-2 ${dataSource === "quick_entry" ? "bg-primary/15" : "bg-muted"}`}>
                  <PencilLine className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Schnellprüfung</p>
                  <p className="text-xs text-muted-foreground">Werte manuell erfassen, ohne Immobilie im System.</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 3. Kunde */}
        {step === 3 && (
          <div className="space-y-3">
            <Label>Kunde wählen</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Kunde auswählen" /></SelectTrigger>
              <SelectContent>
                {(clientsQuery.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}{c.email ? ` (${c.email})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Daten aus Selbstauskunft werden automatisch vorausgefüllt.</p>
          </div>
        )}

        {/* 4. Immobilie / Snapshot */}
        {step === 4 && dataSource === "existing_property" && (
          <div className="space-y-3">
            <Label>Immobilie wählen (optional)</Label>
            <Select value={propertyId || "__none__"} onValueChange={(v) => setPropertyId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Keine Immobilie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Keine Immobilie —</SelectItem>
                {(propertiesQuery.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}{p.city ? ` · ${p.city}` : ""}{p.price ? ` · ${formatCurrency(Number(p.price))}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProperty && (
              <p className="text-xs text-muted-foreground">Objektwert und Adresse werden im nächsten Schritt übernommen.</p>
            )}
          </div>
        )}

        {step === 4 && dataSource === "quick_entry" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Bezeichnung der Immobilie</Label>
              <Input value={snapshot.title} onChange={(e) => setSnapshot({ ...snapshot, title: e.target.value })} placeholder="z. B. Wohnung Bahnhofstrasse 12" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adresse</Label>
              <Input value={snapshot.address} onChange={(e) => setSnapshot({ ...snapshot, address: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">PLZ</Label>
              <Input value={snapshot.postal_code} onChange={(e) => setSnapshot({ ...snapshot, postal_code: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Ort</Label>
              <Input value={snapshot.city} onChange={(e) => setSnapshot({ ...snapshot, city: e.target.value })} />
            </div>
          </div>
        )}

        {/* 5. Dynamische Felder */}
        {step === 5 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Felder für: <span className="font-medium text-foreground">{FINANCING_TYPE_LABELS[financingType]}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields
                .filter((f) => f.key !== "gross_income_yearly")
                .map((f) => (
                  <DynField
                    key={f.key}
                    field={f}
                    value={form[f.key] ?? ""}
                    onChange={(v) => updateField(f.key, v)}
                  />
                ))}
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Gesamtinvestition / Objektwert:</span><span className="font-semibold">{formatCurrency(computed.total_investment)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Massgebliche Hypothek:</span><span className="font-semibold">{formatCurrency(computed.effective_mortgage)}</span></div>
            </div>
          </div>
        )}

        {/* 6. Einkommen / Tragbarkeit */}
        {step === 6 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <DynField
              field={{ key: "gross_income_yearly", label: "Bruttoeinkommen jährlich (CHF)", type: "number", required: true }}
              value={form.gross_income_yearly ?? ""}
              onChange={(v) => updateField("gross_income_yearly", v)}
            />
            <div className="space-y-1">
              <Label className="text-xs">Kalkulatorischer Zinssatz (%)</Label>
              <Input type="number" inputMode="decimal" value={calcRate} onChange={(e) => setCalcRate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nebenkosten jährlich (Vorschlag: {formatCurrency(computed.reference_value * 0.01)})</Label>
              <Input type="number" inputMode="decimal" value={ancillary} onChange={(e) => setAncillary(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amortisation jährlich (CHF)</Label>
              <Input type="number" inputMode="decimal" value={amortisation} onChange={(e) => setAmortisation(e.target.value)} />
            </div>
          </div>
        )}

        {/* 7. Zusammenfassung */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SumRow label="Finanzierungsart" value={FINANCING_TYPE_LABELS[financingType]} />
              <SumRow label="Datenbasis" value={dataSource === "existing_property" ? "Bestehende Immobilie" : "Schnellprüfung"} />
              <SumRow label="Kunde" value={selectedClient?.full_name ?? "—"} />
              <SumRow label="Immobilie" value={dataSource === "existing_property" ? (selectedProperty?.title ?? "Keine") : (snapshot.title || "—")} />
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={result.status} />
                <p className="font-semibold">Ergebnis Quick Check</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <Stat label="Gesamtinvestition" value={formatCurrency(computed.total_investment)} />
                <Stat label="Hypothek" value={formatCurrency(computed.effective_mortgage)} />
                <Stat label="Belehnung" value={`${result.loan_to_value_ratio.toFixed(1)}%`} />
                <Stat label="Tragbarkeit" value={`${result.affordability_ratio.toFixed(1)}%`} />
              </div>
              <ul className="mt-4 space-y-1.5">
                {result.reasons.map((r) => (
                  <li key={r.key} className="flex items-center gap-2 text-sm">
                    {r.tone === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {r.tone === "warn" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {r.tone === "bad" && <XCircle className="h-4 w-4 text-red-600" />}
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5" />
              <p>Mit "Dossier weiterbearbeiten" wird das Dossier gespeichert und geöffnet.</p>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex-row justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-1 h-4 w-4" />Zurück
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < TOTAL_STEPS && (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Weiter <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === TOTAL_STEPS && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Nicht weiterverfolgen</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Speichern…" : "Dossier weiterbearbeiten"}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DynField({
  field, value, onChange,
}: { field: { key: FieldKey; label: string; type?: string; required?: boolean }; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {field.label}{field.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        type={field.type === "date" ? "date" : field.type === "text" ? "text" : "number"}
        inputMode={field.type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: QuickCheckStatus }) {
  if (status === "realistic") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Realistisch</Badge>;
  if (status === "critical") return <Badge className="bg-amber-500 hover:bg-amber-500">Kritisch</Badge>;
  if (status === "not_financeable") return <Badge className="bg-red-600 hover:bg-red-600">Nicht finanzierbar</Badge>;
  return <Badge variant="secondary">Unvollständig</Badge>;
}
