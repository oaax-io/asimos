import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Save,
  Upload,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  calculateBenchmark,
  employmentStatusOptions,
  expenseFields,
  expenseLabels,
  incomeFields,
  incomeLabels,
  maritalStatusOptions,
  salutationOptions,
  type ExpenseField,
  type IncomeField,
} from "@/lib/self-disclosure";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";
import { cn } from "@/lib/utils";

type DisclosureRow = Record<string, unknown> & { id?: string };

interface Props {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: DisclosureRow | null;
}

const STEPS = [
  { id: 1, title: "Personendaten", description: "Wer ist die antragstellende Person?" },
  { id: 2, title: "Beruf", description: "Beschäftigung und Jahresgehalt" },
  { id: 3, title: "Einnahmen", description: "Monatliche Einnahmen" },
  { id: 4, title: "Ausgaben", description: "Monatliche Ausgaben" },
  { id: 5, title: "Abschluss", description: "Berater, Datum, Notizen" },
] as const;

const DATE_FIELDS = new Set([
  "birth_date",
  "employed_since",
  "resident_since",
  "disclosure_date",
]);

const NUMERIC_FIELDS = new Set([
  "salary_net_monthly",
  "additional_income",
  "income_job_two",
  "income_rental",
  "annual_net_salary",
  "total_income_monthly",
  "mortgage_expense",
  "rent_expense",
  "leasing_expense",
  "credit_expense",
  "life_insurance_expense",
  "alimony_expense",
  "health_insurance_expense",
  "property_insurance_expense",
  "utilities_expense",
  "telecom_expense",
  "living_costs_expense",
  "taxes_expense",
  "miscellaneous_expense",
  "total_expenses_monthly",
  "reserve_total",
  "reserve_ratio",
]);

function sanitize(src: DisclosureRow): DisclosureRow {
  const out: DisclosureRow = {};
  for (const [k, v] of Object.entries(src)) {
    if (v === "" || v === undefined) {
      out[k] = null;
      continue;
    }
    if (DATE_FIELDS.has(k)) {
      // Accept YYYY or YYYY-MM-DD; pass YYYY through as null if not parseable date
      if (typeof v === "string" && /^\d{4}$/.test(v)) {
        out[k] = `${v}-01-01`;
      } else {
        out[k] = v;
      }
      continue;
    }
    if (NUMERIC_FIELDS.has(k)) {
      const n = Number(v);
      out[k] = Number.isFinite(n) ? n : null;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function ClientSelfDisclosureWizard({
  clientId,
  open,
  onOpenChange,
  initial,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<DisclosureRow>(initial ?? {});
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      // Nur beim Übergang geschlossen -> offen zurücksetzen,
      // damit per PDF erkannte Felder nicht durch React-Query-Refetches
      // überschrieben werden.
      setForm(initial ?? {});
      setStep(1);
    }
    wasOpenRef.current = open;
  }, [open, initial]);

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const benchmark = useMemo(
    () => calculateBenchmark(form as Record<string, number | string | null>),
    [form],
  );

  const handlePdfUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Bitte eine PDF-Datei hochladen");
      return;
    }
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunkSize)),
        );
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke(
        "parse-self-disclosure",
        { body: { pdf_base64: base64, mime_type: file.type } },
      );
      if (error) throw error;
      if (data?.error) {
        toast.error(String(data.error));
        return;
      }
      const fields = (data?.fields ?? {}) as Record<string, unknown>;
      const cleaned: DisclosureRow = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v === null || v === undefined || v === "") continue;
        cleaned[k] = v;
      }
      setForm((prev) => ({ ...prev, ...cleaned }));
      const count = Object.keys(cleaned).length;
      toast.success(
        count > 0
          ? `${count} Felder erkannt – bitte prüfen.`
          : `Keine zuordenbaren Felder erkannt (${data?.form_fields_count ?? 0} Formularfelder gelesen).`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "PDF konnte nicht gelesen werden",
      );
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const cleaned = sanitize(form);
      const payload = {
        ...cleaned,
        client_id: clientId,
        total_income_monthly: benchmark.totalIncome,
        total_expenses_monthly: benchmark.totalExpenses,
        reserve_total: benchmark.reserveTotal,
        reserve_ratio: Number(benchmark.reserveRatio.toFixed(2)),
        benchmark_status: benchmark.status,
      };
      const { error } = await supabase
        .from("client_self_disclosures")
        .upsert(payload, { onConflict: "client_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Selbstauskunft gespeichert");
      qc.invalidateQueries({ queryKey: ["client_self_disclosure", clientId] });
      qc.invalidateQueries({ queryKey: ["client_benchmark", clientId] });
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
  });

  const isLast = step === STEPS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] max-h-[92vh]">
          {/* Main */}
          <div className="flex flex-col overflow-hidden">
            <DialogHeader className="border-b p-6">
              <DialogTitle className="font-display text-2xl">
                Selbstauskunft – Schritt {step} von {STEPS.length}
              </DialogTitle>
              <DialogDescription>{STEPS[step - 1].description}</DialogDescription>
              <Stepper current={step} onJump={setStep} />
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* PDF Upload only on Step 1 */}
              {step === 1 && (
                <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-5">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">
                        Bestehende Selbstauskunft hochladen
                      </h4>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        ASIMO-PDF hochladen – die KI erkennt Felder und befüllt
                        das Formular automatisch. Checkliste wird ignoriert.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePdfUpload(f);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={parsing}
                        >
                          {parsing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          PDF auswählen
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          oder Felder unten manuell ausfüllen
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && <PersonStep form={form} set={set} />}
              {step === 2 && <JobStep form={form} set={set} />}
              {step === 3 && <IncomeStep form={form} set={set} />}
              {step === 4 && <ExpenseStep form={form} set={set} />}
              {step === 5 && <ClosingStep form={form} set={set} />}
            </div>

            <div className="flex items-center justify-between border-t p-4 bg-muted/30">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Zurück
              </Button>
              {!isLast ? (
                <Button onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}>
                  Weiter
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Selbstauskunft speichern
                </Button>
              )}
            </div>
          </div>

          {/* Live Benchmark Sidebar */}
          <div className="hidden lg:flex flex-col border-l bg-muted/20 p-5 overflow-y-auto">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Live Finanz-Benchmark
            </div>
            <BenchmarkCard benchmark={benchmark} />
            <p className="mt-4 text-xs text-muted-foreground">
              Aktualisiert sich live, sobald Einnahmen oder Ausgaben geändert
              werden. Wird beim Speichern dauerhaft hinterlegt.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({
  current,
  onJump,
}: {
  current: number;
  onJump: (n: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {STEPS.map((s) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onJump(s.id)}
            className={cn(
              "group flex flex-1 flex-col items-start gap-1 rounded-md px-2 py-1.5 text-left transition",
              "hover:bg-muted",
            )}
          >
            <div className="flex w-full items-center gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : s.id}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1 rounded",
                  done ? "bg-primary" : "bg-muted",
                )}
              />
            </div>
            <span
              className={cn(
                "text-[11px] font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Steps ---------- */

function PersonStep({
  form,
  set,
}: {
  form: DisclosureRow;
  set: (k: string, v: unknown) => void;
}) {
  const fields: { key: string; label: string; type?: string }[] = [
    { key: "first_name", label: "Vorname" },
    { key: "last_name", label: "Name" },
    { key: "birth_name", label: "Ledigname" },
    { key: "street", label: "Strasse" },
    { key: "street_number", label: "Nr." },
    { key: "postal_code", label: "PLZ" },
    { key: "city", label: "Ort" },
    { key: "country", label: "Land" },
    { key: "resident_since", label: "Wohnhaft seit", type: "date" },
    { key: "phone", label: "Telefon" },
    { key: "mobile", label: "Mobil" },
    { key: "email", label: "E-Mail", type: "email" },
    { key: "birth_date", label: "Geburtsdatum", type: "date" },
    { key: "nationality", label: "Staatsbürgerschaft" },
    { key: "birth_place", label: "Geburtsort" },
    { key: "birth_country", label: "Geburtsland" },
    { key: "tax_id_ch", label: "Steuer-ID-Nr. CH" },
  ];
  return (
    <Grid>
      <FieldBox label="Anrede">
        <Select
          value={(form.salutation as string) ?? ""}
          onValueChange={(v) => set("salutation", v)}
        >
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {salutationOptions.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldBox>
      <FieldBox label="Titel">
        <Input
          value={(form.title as string) ?? ""}
          onChange={(e) => set("title", e.target.value)}
        />
      </FieldBox>
      <FieldBox label="Familienstand">
        <Select
          value={(form.marital_status as string) ?? ""}
          onValueChange={(v) => set("marital_status", v)}
        >
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {maritalStatusOptions.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldBox>
      {fields.map((f) => (
        <FieldBox key={f.key} label={f.label}>
          <Input
            type={f.type ?? "text"}
            value={(form[f.key] as string) ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </FieldBox>
      ))}
    </Grid>
  );
}

function JobStep({
  form,
  set,
}: {
  form: DisclosureRow;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <Grid>
      <FieldBox label="Status">
        <Select
          value={(form.employment_status as string) ?? ""}
          onValueChange={(v) => set("employment_status", v)}
        >
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {employmentStatusOptions.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldBox>
      <FieldBox label="Arbeitgeber">
        <Input value={(form.employer_name as string) ?? ""} onChange={(e) => set("employer_name", e.target.value)} />
      </FieldBox>
      <FieldBox label="Adresse Arbeitgeber">
        <Input value={(form.employer_address as string) ?? ""} onChange={(e) => set("employer_address", e.target.value)} />
      </FieldBox>
      <FieldBox label="Telefon Arbeitgeber">
        <Input value={(form.employer_phone as string) ?? ""} onChange={(e) => set("employer_phone", e.target.value)} />
      </FieldBox>
      <FieldBox label="Beschäftigt als">
        <Input value={(form.employed_as as string) ?? ""} onChange={(e) => set("employed_as", e.target.value)} />
      </FieldBox>
      <FieldBox label="Beschäftigt seit">
        <Input
          type="date"
          value={(form.employed_since as string) ?? ""}
          onChange={(e) => set("employed_since", e.target.value)}
        />
      </FieldBox>
      <FieldBox label="Gehaltstyp">
        <Select
          value={(form.salary_type as string) ?? ""}
          onValueChange={(v) => set("salary_type", v)}
        >
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Fixum">Fixum</SelectItem>
            <SelectItem value="Provision">Provision</SelectItem>
            <SelectItem value="Fixum + Provision">Fixum + Provision</SelectItem>
          </SelectContent>
        </Select>
      </FieldBox>
      <FieldBox label="Jahresgehalt netto (Lohnausweis)">
        <CHFInput
          value={form.annual_net_salary as number | null}
          onChange={(n) => set("annual_net_salary", n)}
        />
      </FieldBox>
    </Grid>
  );
}

function IncomeStep({
  form,
  set,
}: {
  form: DisclosureRow;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <Grid>
      {incomeFields.map((f: IncomeField) => (
        <FieldBox key={f} label={incomeLabels[f]}>
          <CHFInput
            value={form[f] as number | null}
            onChange={(n) => set(f, n)}
          />
        </FieldBox>
      ))}
    </Grid>
  );
}

function ExpenseStep({
  form,
  set,
}: {
  form: DisclosureRow;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <Grid>
      {expenseFields.map((f: ExpenseField) => (
        <FieldBox key={f} label={expenseLabels[f]}>
          <CHFInput
            value={form[f] as number | null}
            onChange={(n) => set(f, n)}
          />
        </FieldBox>
      ))}
    </Grid>
  );
}

function ClosingStep({
  form,
  set,
}: {
  form: DisclosureRow;
  set: (k: string, v: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <Grid>
        <FieldBox label="Berater">
          <Input
            value={(form.advisor_id as string) ?? ""}
            onChange={(e) => set("advisor_id", e.target.value)}
          />
        </FieldBox>
        <FieldBox label="Datum">
          <Input
            type="date"
            value={(form.disclosure_date as string) ?? ""}
            onChange={(e) => set("disclosure_date", e.target.value)}
          />
        </FieldBox>
        <FieldBox label="Ort">
          <Input
            value={(form.disclosure_place as string) ?? ""}
            onChange={(e) => set("disclosure_place", e.target.value)}
          />
        </FieldBox>
      </Grid>
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">
          Interne Notizen
        </Label>
        <Textarea
          rows={4}
          value={(form.internal_notes as string) ?? ""}
          onChange={(e) => set("internal_notes", e.target.value)}
        />
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function FieldBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CHFInput({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      placeholder="0"
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange(null);
        else {
          const n = Number(v);
          onChange(Number.isFinite(n) ? n : null);
        }
      }}
    />
  );
}
