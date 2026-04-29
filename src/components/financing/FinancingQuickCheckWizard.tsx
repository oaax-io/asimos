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
} from "lucide-react";
import {
  FINANCING_TYPE_LABELS, FINANCING_TYPE_DESCRIPTIONS,
  calcQuickCheck, type FinancingType, type QuickCheckStatus,
} from "@/lib/financing";
import { formatCurrency } from "@/lib/format";

const TYPE_ICONS: Record<FinancingType, any> = {
  purchase: Home,
  renovation: Hammer,
  increase: ArrowUpCircle,
  refinance: Repeat2,
  new_build: Building,
  mortgage_increase: TrendingUp,
};

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
  const [financingType, setFinancingType] = useState<FinancingType>("purchase");
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId ?? "");
  const [form, setForm] = useState({
    purchase_price: "",
    renovation_costs: "",
    requested_mortgage: "",
    own_funds_total: "",
    own_funds_liquid: "",
    own_funds_pillar_3a: "",
    own_funds_pension_fund: "",
    own_funds_vested_benefits: "",
    own_funds_gift: "",
    own_funds_inheritance: "",
    own_funds_private_loan: "",
    gross_income_yearly: "",
    calculated_interest_rate: "5",
    ancillary_costs_yearly: "",
    amortisation_yearly: "",
  });

  useEffect(() => {
    if (!open) {
      setStep(1);
      setFinancingType("purchase");
      setClientId(defaultClientId ?? "");
      setPropertyId(defaultPropertyId ?? "");
    }
  }, [open, defaultClientId, defaultPropertyId]);

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
        .select("id, title, city, price, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const selectedClient = clientsQuery.data?.find((c: any) => c.id === clientId);
  const selectedProperty = propertiesQuery.data?.find((p: any) => p.id === propertyId);

  // Auto-Übernahme aus Immobilie
  useEffect(() => {
    if (selectedProperty?.price && !form.purchase_price) {
      setForm((f) => ({ ...f, purchase_price: String(selectedProperty.price) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

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

  const numericInput = useMemo(() => ({
    purchase_price: toNum(form.purchase_price),
    renovation_costs: toNum(form.renovation_costs),
    requested_mortgage: toNum(form.requested_mortgage),
    own_funds_total: toNum(form.own_funds_total),
    own_funds_pension_fund: toNum(form.own_funds_pension_fund),
    own_funds_vested_benefits: toNum(form.own_funds_vested_benefits),
    gross_income_yearly: toNum(form.gross_income_yearly),
    calculated_interest_rate: toNum(form.calculated_interest_rate, 5),
    ancillary_costs_yearly: toNum(form.ancillary_costs_yearly),
    amortisation_yearly: toNum(form.amortisation_yearly),
  }), [form]);

  const result = useMemo(() => calcQuickCheck(numericInput), [numericInput]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Bitte Kunden auswählen");
      const payload = {
        client_id: clientId,
        property_id: propertyId || null,
        financing_type: financingType,
        title: `${FINANCING_TYPE_LABELS[financingType]}${selectedClient ? " – " + selectedClient.full_name : ""}`,
        purchase_price: toNumOrNull(form.purchase_price),
        renovation_costs: toNumOrNull(form.renovation_costs),
        total_investment: result.total_investment || null,
        requested_mortgage: toNumOrNull(form.requested_mortgage),
        own_funds_total: toNumOrNull(form.own_funds_total),
        own_funds_liquid: toNumOrNull(form.own_funds_liquid),
        own_funds_pillar_3a: toNumOrNull(form.own_funds_pillar_3a),
        own_funds_pension_fund: toNumOrNull(form.own_funds_pension_fund),
        own_funds_vested_benefits: toNumOrNull(form.own_funds_vested_benefits),
        own_funds_gift: toNumOrNull(form.own_funds_gift),
        own_funds_inheritance: toNumOrNull(form.own_funds_inheritance),
        own_funds_private_loan: toNumOrNull(form.own_funds_private_loan),
        loan_to_value_ratio: result.loan_to_value_ratio || null,
        gross_income_yearly: toNumOrNull(form.gross_income_yearly),
        calculated_interest_rate: toNumOrNull(form.calculated_interest_rate) ?? 5,
        ancillary_costs_yearly: toNumOrNull(form.ancillary_costs_yearly),
        amortisation_yearly: toNumOrNull(form.amortisation_yearly),
        affordability_ratio: result.affordability_ratio || null,
        quick_check_status: result.status,
        quick_check_reasons: result.reasons,
        dossier_status: "quick_check" as const,
      };
      const { data, error } = await supabase
        .from("financing_dossiers")
        .insert(payload as any)
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

  const canNext = () => {
    if (step === 1) return !!financingType;
    if (step === 2) return !!clientId;
    if (step === 3) return true; // Immobilie optional
    if (step === 4) return numericInput.purchase_price > 0 && numericInput.requested_mortgage > 0;
    if (step === 5) return numericInput.gross_income_yearly > 0;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Check Finanzierung – Schritt {step} / 6</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 my-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className={`h-1 flex-1 rounded ${n <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

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

        {step === 2 && (
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

        {step === 3 && (
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
              <p className="text-xs text-muted-foreground">Kaufpreis und Objektangaben werden übernommen.</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kaufpreis (CHF)" value={form.purchase_price} onChange={(v) => setForm({ ...form, purchase_price: v })} />
            <Field label="Renovationskosten (CHF)" value={form.renovation_costs} onChange={(v) => setForm({ ...form, renovation_costs: v })} />
            <div className="sm:col-span-2 rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Gesamtinvestition:</span>{" "}
              <span className="font-semibold">{formatCurrency(result.total_investment)}</span>
            </div>
            <Field label="Gewünschte Hypothek (CHF)" value={form.requested_mortgage} onChange={(v) => setForm({ ...form, requested_mortgage: v })} />
            <Field label="Eigenmittel total (CHF)" value={form.own_funds_total} onChange={(v) => setForm({ ...form, own_funds_total: v })} />
            <Field label="davon liquide" value={form.own_funds_liquid} onChange={(v) => setForm({ ...form, own_funds_liquid: v })} />
            <Field label="davon Säule 3a" value={form.own_funds_pillar_3a} onChange={(v) => setForm({ ...form, own_funds_pillar_3a: v })} />
            <Field label="davon Pensionskasse" value={form.own_funds_pension_fund} onChange={(v) => setForm({ ...form, own_funds_pension_fund: v })} />
            <Field label="davon Freizügigkeit" value={form.own_funds_vested_benefits} onChange={(v) => setForm({ ...form, own_funds_vested_benefits: v })} />
            <Field label="davon Schenkung" value={form.own_funds_gift} onChange={(v) => setForm({ ...form, own_funds_gift: v })} />
            <Field label="davon Erbschaft" value={form.own_funds_inheritance} onChange={(v) => setForm({ ...form, own_funds_inheritance: v })} />
            <Field label="davon privates Darlehen" value={form.own_funds_private_loan} onChange={(v) => setForm({ ...form, own_funds_private_loan: v })} />
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bruttoeinkommen jährlich (CHF)" value={form.gross_income_yearly} onChange={(v) => setForm({ ...form, gross_income_yearly: v })} />
            <Field label="Kalkulatorischer Zinssatz (%)" value={form.calculated_interest_rate} onChange={(v) => setForm({ ...form, calculated_interest_rate: v })} />
            <Field
              label={`Nebenkosten jährlich (Vorschlag: ${formatCurrency(numericInput.purchase_price * 0.01 + numericInput.renovation_costs * 0.01)})`}
              value={form.ancillary_costs_yearly}
              onChange={(v) => setForm({ ...form, ancillary_costs_yearly: v })}
            />
            <Field label="Amortisation jährlich (CHF)" value={form.amortisation_yearly} onChange={(v) => setForm({ ...form, amortisation_yearly: v })} />
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={result.status} />
                <div>
                  <p className="font-semibold">Ergebnis Quick Check</p>
                  <p className="text-xs text-muted-foreground">{FINANCING_TYPE_LABELS[financingType]}{selectedClient ? ` für ${selectedClient.full_name}` : ""}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <Stat label="Gesamtinvestition" value={formatCurrency(result.total_investment)} />
                <Stat label="Belehnung" value={`${result.loan_to_value_ratio.toFixed(1)}%`} />
                <Stat label="Tragbarkeit" value={`${result.affordability_ratio.toFixed(1)}%`} />
                <Stat label="Jährliche Kosten" value={formatCurrency(result.yearly_costs)} />
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
              <p>Mit "Dossier weiterbearbeiten" wird das Dossier gespeichert und geöffnet. Mit "Nicht weiterverfolgen" wird abgebrochen.</p>
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
            {step < 6 && (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Weiter <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === 6 && (
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
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

function StatusBadge({ status }: { status: QuickCheckStatus }) {
  if (status === "realistic") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Realistisch</Badge>;
  if (status === "critical") return <Badge className="bg-amber-500 hover:bg-amber-500">Kritisch</Badge>;
  if (status === "not_financeable") return <Badge className="bg-red-600 hover:bg-red-600">Nicht finanzierbar</Badge>;
  return <Badge variant="secondary">Unvollständig</Badge>;
}

function toNum(v: string, fallback = 0): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
function toNumOrNull(v: string): number | null {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
