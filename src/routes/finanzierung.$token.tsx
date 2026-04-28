import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileSignature, AlertTriangle, CheckCircle2, Loader2, Save, Send, Info } from "lucide-react";
import { toast } from "sonner";
import {
  PUBLIC_SECTIONS, computeCompletion, calcFinancing, calcAffordability,
  type SectionDef, type FieldDef, type SectionKey,
} from "@/lib/financing-sections";

export const Route = createFileRoute("/finanzierung/$token")({ component: PublicFinancingForm });

const fmtCHF = (n: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n || 0);

function PublicFinancingForm() {
  const { token } = Route.useParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["financing_link", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("financing_link_resolve", { _token: token });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  if (isLoading) return <Shell><p className="text-sm text-muted-foreground">Lädt…</p></Shell>;

  if (error || !data || data.status === "invalid" || data.status === "expired") {
    return (
      <Shell>
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-orange-500" />
          <h1 className="mt-4 font-display text-2xl font-bold">Link nicht verfügbar</h1>
          <p className="mt-2 text-muted-foreground">Dieser Link ist ungültig oder abgelaufen.</p>
        </div>
      </Shell>
    );
  }

  if (data.status === "submitted") {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 font-display text-2xl font-bold">Vielen Dank!</h1>
          <p className="mt-2 text-muted-foreground">
            Ihre Angaben wurden übermittelt. Ihr Berater meldet sich in Kürze.
          </p>
        </div>
      </Shell>
    );
  }

  return <FormBody token={token} initial={data} onSubmitted={() => refetch()} />;
}

function FormBody({ token, initial, onSubmitted }: { token: string; initial: any; onSubmitted: () => void }) {
  // State pro Sektion
  const [sections, setSections] = useState<Record<SectionKey, any>>(() => ({
    section_customer: initial.section_customer || {},
    section_financing: initial.section_financing || {},
    section_property_docs: initial.section_property_docs || {},
    section_income: initial.section_income || {},
    section_tax: initial.section_tax || {},
    section_self_employed: initial.section_self_employed || {},
    section_affordability: initial.section_affordability || {},
    section_additional: initial.section_additional || {},
  }));

  const completion = useMemo(() => computeCompletion(sections), [sections]);

  const setField = (sec: SectionKey, key: string, value: any) =>
    setSections(prev => ({ ...prev, [sec]: { ...prev[sec], [key]: value } }));

  // ─── Autosave ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirtyRef = useRef(false);
  const lastPayloadRef = useRef<string>("");

  const save = useMutation({
    mutationFn: async () => {
      const payload = sections;
      const serialized = JSON.stringify(payload);
      if (serialized === lastPayloadRef.current) return;
      setSaving(true);
      const { error } = await supabase.rpc("financing_link_save", {
        _token: token,
        _payload: payload as any,
        _completion: completion.percent,
      });
      if (error) throw error;
      lastPayloadRef.current = serialized;
      setSavedAt(new Date());
      dirtyRef.current = false;
    },
    onError: (e: any) => toast.error(`Speichern fehlgeschlagen: ${e.message}`),
    onSettled: () => setSaving(false),
  });

  // Markiere "dirty" bei jeder Änderung
  useEffect(() => { dirtyRef.current = true; }, [sections]);

  // Debounced Autosave (1.5s nach letzter Änderung)
  useEffect(() => {
    const t = setTimeout(() => {
      if (dirtyRef.current) save.mutate();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // Periodischer Autosave alle 30s
  useEffect(() => {
    const i = setInterval(() => { if (dirtyRef.current) save.mutate(); }, 30000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vor Verlassen warnen wenn ungespeichert
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const submit = useMutation({
    mutationFn: async () => {
      // Letzten Stand speichern
      await supabase.rpc("financing_link_save", {
        _token: token, _payload: sections as any, _completion: completion.percent,
      });
      const { error } = await supabase.rpc("financing_link_submit", { _token: token });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Eingereicht"); onSubmitted(); },
    onError: (e: any) => toast.error(`Einreichen fehlgeschlagen: ${e.message}`),
  });

  return (
    <Shell>
      <div className="mb-6 text-center">
        <FileSignature className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 font-display text-3xl font-bold">Finanzierungsangaben</h1>
        {initial.client_name && (
          <p className="mt-1 text-sm text-muted-foreground">für {initial.client_name}</p>
        )}
      </div>

      {/* Fortschritt + Save-Status */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            {Object.values(completion.perSection).filter(Boolean).length} von {PUBLIC_SECTIONS.length} Sektionen vollständig
          </span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Speichert…</>
            ) : savedAt ? (
              <><Save className="h-3 w-3" />Gespeichert {savedAt.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}</>
            ) : null}
          </span>
        </div>
        <Progress value={completion.percent} />
      </div>

      <Accordion type="multiple" defaultValue={["section_customer"]} className="space-y-3">
        {PUBLIC_SECTIONS.map(sec => (
          <SectionBlock
            key={sec.key}
            section={sec}
            data={sections[sec.key]}
            allSections={sections}
            complete={completion.perSection[sec.key]}
            onChange={(k, v) => setField(sec.key, k, v)}
          />
        ))}
      </Accordion>

      <Card className="mt-8">
        <CardContent className="p-6 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Mit dem Einreichen werden Ihre Angaben an Ihren Berater übermittelt. Spätere Änderungen sind dann nicht mehr möglich.
          </p>
          <Button
            size="lg"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || completion.percent < 50}
          >
            {submit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sende…</> : <><Send className="mr-2 h-4 w-4" />Angaben einreichen</>}
          </Button>
          {completion.percent < 50 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Bitte füllen Sie mindestens die Hälfte der Sektionen aus.
            </p>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}

// ─── Sektions-Block ─────────────────────────────────────────────────────────
function SectionBlock({
  section, data, allSections, complete, onChange,
}: {
  section: SectionDef; data: any; allSections: Record<SectionKey, any>;
  complete: boolean; onChange: (k: string, v: any) => void;
}) {
  return (
    <AccordionItem value={section.key} className="overflow-hidden rounded-2xl border bg-card">
      <AccordionTrigger className="px-5 py-4 hover:no-underline">
        <div className="flex flex-1 items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {section.number}
          </span>
          <span className="text-left font-medium">{section.title}</span>
          <span className="ml-auto mr-2">
            {complete
              ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Vollständig</Badge>
              : <Badge variant="outline">Offen</Badge>}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5">
        <div className="space-y-4">
          {section.custom === "financing" && <FinancingSection data={data} onChange={onChange} />}
          {section.custom === "affordability" && (
            <AffordabilitySection data={data} financing={allSections.section_financing} onChange={onChange} />
          )}

          {section.fields && (
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map(f => <FieldInput key={f.key} field={f} value={data?.[f.key]} onChange={(v) => onChange(f.key, v)} />)}
            </div>
          )}

          {section.checklist && (
            <div className="space-y-2">
              {section.checklist.map(item => (
                <div key={item.key} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`${section.key}-${item.key}`}
                      checked={data?.[item.key] === true}
                      onCheckedChange={(v) => onChange(item.key, v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`${section.key}-${item.key}`} className="flex-1 cursor-pointer text-sm font-normal">
                      {item.label}
                    </Label>
                  </div>
                  <Input
                    placeholder="Bemerkung (optional)"
                    className="mt-2 h-8 text-xs"
                    value={data?.[`${item.key}_note`] || ""}
                    onChange={(e) => onChange(`${item.key}_note`, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {section.hint && (
            <div className="flex gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{section.hint}</p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Standard-Feld ──────────────────────────────────────────────────────────
function FieldInput({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  const id = `f-${field.key}`;
  return (
    <div className={field.type === "textarea" ? "sm:col-span-2" : ""}>
      <Label htmlFor={id} className="text-xs">
        {field.label} {field.required && <span className="text-destructive">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea id={id} rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
          <SelectContent>
            {field.options!.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.type === "toggle" ? (
        <div className="mt-2 flex items-center gap-3">
          <Switch id={id} checked={value === true} onCheckedChange={onChange} />
          <span className="text-sm text-muted-foreground">{value === true ? "Ja" : "Nein"}</span>
        </div>
      ) : (
        <Input
          id={id}
          type={field.type === "tel" ? "tel" : field.type}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        />
      )}
    </div>
  );
}

// ─── Sektion 2: Finanzierungsstruktur (mit Berechnungen) ────────────────────
function FinancingSection({ data, onChange }: { data: any; onChange: (k: string, v: any) => void }) {
  const c = calcFinancing(data || {});

  const moneyField = (key: string, label: string, required?: boolean) => (
    <div>
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      <Input
        type="number"
        value={data?.[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value === "" ? "" : Number(e.target.value))}
      />
    </div>
  );

  const calcField = (label: string, value: string) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium">
        {value}
      </div>
    </div>
  );

  const equityRows: { key: string; label: string }[] = [
    { key: "equityLiquid", label: "Liquide Mittel (Bankguthaben)" },
    { key: "equityPillar3a", label: "Säule 3a" },
    { key: "equityPensionFund", label: "Pensionskasse (Bezug / Verpfändung)" },
    { key: "equityVestedAccount", label: "Freizügigkeitskonto" },
    { key: "equityGift", label: "Schenkung / Erbvorbezug (inkl. Vertrag)" },
    { key: "equityPrivateLoan", label: "Privatdarlehen (inkl. Vertrag)" },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {moneyField("purchasePrice", "Kaufpreis CHF", true)}
        {moneyField("renovationCosts", "Renovationskosten CHF")}
        {calcField("Gesamtinvestition CHF", fmtCHF(c.totalInvestment))}
        {moneyField("desiredMortgage", "Gewünschte Hypothek CHF", true)}
        {calcField("Belehnungsgrad %", `${c.ltv.toFixed(1)} %`)}
        {calcField("Eigenmittel min. 20% CHF", fmtCHF(c.minEquity))}
      </div>

      <div>
        <p className="mb-2 mt-4 text-sm font-semibold">Eigenmittel — Herkunft</p>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Position</th>
                <th className="p-2 text-right">CHF</th>
                <th className="w-20 p-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {equityRows.map(r => (
                <tr key={r.key} className="border-t">
                  <td className="p-2">{r.label}</td>
                  <td className="p-2">
                    <Input
                      type="number"
                      className="h-8 text-right"
                      value={data?.[r.key] ?? ""}
                      onChange={(e) => onChange(r.key, e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </td>
                  <td className="p-2 text-right text-xs text-muted-foreground">
                    {c.pct((c.equity as any)[r.key.replace("equity", "").charAt(0).toLowerCase() + r.key.replace("equity", "").slice(1)] ?? 0).toFixed(0)}%
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/20 font-semibold">
                <td className="p-2">Total Eigenmittel</td>
                <td className="p-2 text-right">{fmtCHF(c.equityTotal)}</td>
                <td className="p-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {c.pkWarning && (
        <div className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Pensionskasse-Anteil über 90% — UBS verlangt mindestens 10% aus anderen Quellen.</p>
        </div>
      )}
    </>
  );
}

// ─── Sektion 7: Tragbarkeitsprüfung ─────────────────────────────────────────
function AffordabilitySection({
  data, financing, onChange,
}: { data: any; financing: any; onChange: (k: string, v: any) => void }) {
  const a = calcAffordability(financing, data);

  const trafficClass =
    a.traffic === "green" ? "bg-emerald-600" :
    a.traffic === "orange" ? "bg-orange-500" : "bg-destructive";
  const trafficLabel =
    a.traffic === "green" ? "Tragbar (≤ 33%)" :
    a.traffic === "orange" ? "Knapp (33–38%)" : "Überschritten (> 38%)";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Bruttoeinkommen jährlich CHF <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            value={data?.grossIncomeYearly ?? ""}
            onChange={(e) => onChange("grossIncomeYearly", e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
        <CalcCell label="Zinskosten 5% / Jahr" value={fmtCHF(a.interestCost)} />
        <CalcCell label="Nebenkosten ca. 1% / Jahr" value={fmtCHF(a.sideCosts)} />
        <CalcCell label="Amortisation 1% / Jahr" value={fmtCHF(a.amortization)} />
        <CalcCell label="Total Kosten / Jahr" value={fmtCHF(a.totalCosts)} />
        <CalcCell label="Tragbarkeit %" value={`${a.ratio.toFixed(1)} %`} />
      </div>

      <div className={`flex items-center justify-between rounded-2xl px-5 py-4 text-white ${trafficClass}`}>
        <div>
          <p className="text-xs uppercase opacity-80">Tragbarkeit</p>
          <p className="font-display text-2xl font-bold">{a.ratio.toFixed(1)}%</p>
        </div>
        <Badge className="bg-white/20 text-white hover:bg-white/20">{trafficLabel}</Badge>
      </div>
    </>
  );
}

function CalcCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium">{value}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-soft py-10">
      <div className="mx-auto max-w-3xl px-4">{children}</div>
    </div>
  );
}
