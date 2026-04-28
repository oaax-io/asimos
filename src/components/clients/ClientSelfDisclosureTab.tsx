import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  calculateBenchmark,
  employmentStatusOptions,
  expenseFields,
  expenseLabels,
  formatCHF,
  incomeFields,
  incomeLabels,
  maritalStatusOptions,
  salutationOptions,
  type ExpenseField,
  type IncomeField,
} from "@/lib/self-disclosure";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";

type DisclosureRow = Record<string, unknown> & { id?: string };

interface Props {
  clientId: string;
}

const STAMM_FIELDS: { key: string; label: string; type?: string; placeholder?: string }[] = [
  { key: "first_name", label: "Vorname" },
  { key: "last_name", label: "Name" },
  { key: "birth_name", label: "Ledigname" },
  { key: "street", label: "Strasse" },
  { key: "street_number", label: "Nr." },
  { key: "postal_code", label: "PLZ" },
  { key: "city", label: "Ort" },
  { key: "country", label: "Land", placeholder: "CH" },
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

const JOB_TEXT_FIELDS = [
  { key: "employer_name", label: "Arbeitgeber" },
  { key: "employer_address", label: "Adresse Arbeitgeber" },
  { key: "employer_phone", label: "Telefon Arbeitgeber" },
  { key: "employed_as", label: "Beschäftigt als" },
];

export function ClientSelfDisclosureTab({ clientId }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["client_self_disclosure", clientId],
    queryFn: async () => {
      const { data: disc, error } = await supabase
        .from("client_self_disclosures")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;

      // Prefill aus clients, wenn noch keine Selbstauskunft existiert
      if (!disc) {
        const { data: client } = await supabase
          .from("clients")
          .select("full_name, email, phone, address, postal_code, city, country")
          .eq("id", clientId)
          .maybeSingle();
        if (client) {
          const parts = (client.full_name ?? "").trim().split(/\s+/);
          const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");
          const last = parts.length > 1 ? parts[parts.length - 1] : "";
          const addr = (client.address ?? "").trim();
          const m = addr.match(/^(.*?)(\s+\d+\w?)$/);
          const street = m ? m[1].trim() : addr;
          const street_number = m ? m[2].trim() : "";
          return {
            first_name: first,
            last_name: last,
            email: client.email ?? "",
            phone: client.phone ?? "",
            street,
            street_number,
            postal_code: client.postal_code ?? "",
            city: client.city ?? "",
            country: client.country ?? "CH",
          } as DisclosureRow;
        }
      }
      return (disc ?? null) as DisclosureRow | null;
    },
  });

  const [form, setForm] = useState<DisclosureRow>({});

  useEffect(() => {
    setForm(data ?? {});
  }, [data]);

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const benchmark = useMemo(
    () => calculateBenchmark(form as Record<string, number | string | null>),
    [form],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        client_id: clientId,
        total_income_monthly: benchmark.totalIncome,
        total_expenses_monthly: benchmark.totalExpenses,
        reserve_total: benchmark.reserveTotal,
        reserve_ratio: Number(benchmark.reserveRatio.toFixed(2)),
        benchmark_status: benchmark.status,
      };
      // upsert: client_id ist UNIQUE
      const { error } = await supabase
        .from("client_self_disclosures")
        .upsert(payload, { onConflict: "client_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Selbstauskunft gespeichert");
      qc.invalidateQueries({ queryKey: ["client_self_disclosure", clientId] });
      qc.invalidateQueries({ queryKey: ["client_benchmark", clientId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Live-Benchmark immer sichtbar */}
      <BenchmarkCard benchmark={benchmark} />

      {/* Stammdaten */}
      <Section title="Grunddaten">
        <FieldGrid>
          <Field label="Anrede">
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
          </Field>
          <Field label="Titel">
            <Input
              value={(form.title as string) ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Dr., Prof., …"
            />
          </Field>
          <Field label="Familienstand">
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
          </Field>

          {STAMM_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                type={f.type ?? "text"}
                value={(form[f.key] as string) ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          ))}
        </FieldGrid>
      </Section>

      {/* Beruf */}
      <Section title="Beruf">
        <FieldGrid>
          <Field label="Status">
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
          </Field>
          {JOB_TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Field>
          ))}
          <Field label="Beschäftigt seit">
            <Input
              type="date"
              value={(form.employed_since as string) ?? ""}
              onChange={(e) => set("employed_since", e.target.value)}
            />
          </Field>
          <Field label="Gehaltstyp">
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
          </Field>
          <Field label="Jahresgehalt netto (Lohnausweis)">
            <CurrencyInput
              value={form.annual_net_salary as number | string | null}
              onChange={(n) => set("annual_net_salary", n)}
            />
          </Field>
        </FieldGrid>
      </Section>

      {/* Einnahmen */}
      <Section
        title="Einnahmen monatlich"
        right={
          <span className="text-sm text-muted-foreground">
            Total: <strong className="text-foreground">{formatCHF(benchmark.totalIncome)}</strong>
          </span>
        }
      >
        <FieldGrid>
          {incomeFields.map((f: IncomeField) => (
            <Field key={f} label={incomeLabels[f]}>
              <CurrencyInput
                value={form[f] as number | string | null}
                onChange={(n) => set(f, n)}
              />
            </Field>
          ))}
        </FieldGrid>
      </Section>

      {/* Ausgaben */}
      <Section
        title="Ausgaben monatlich"
        right={
          <span className="text-sm text-muted-foreground">
            Total: <strong className="text-foreground">{formatCHF(benchmark.totalExpenses)}</strong>
          </span>
        }
      >
        <FieldGrid>
          {expenseFields.map((f: ExpenseField) => (
            <Field key={f} label={expenseLabels[f]}>
              <CurrencyInput
                value={form[f] as number | string | null}
                onChange={(n) => set(f, n)}
              />
            </Field>
          ))}
        </FieldGrid>
      </Section>

      {/* Abschluss */}
      <Section title="Abschluss">
        <FieldGrid>
          <Field label="Berater">
            <Input
              value={(form.advisor_id as string) ?? ""}
              onChange={(e) => set("advisor_id", e.target.value)}
              placeholder="Name oder ID"
            />
          </Field>
          <Field label="Datum">
            <Input
              type="date"
              value={(form.disclosure_date as string) ?? ""}
              onChange={(e) => set("disclosure_date", e.target.value)}
            />
          </Field>
          <Field label="Ort">
            <Input
              value={(form.disclosure_place as string) ?? ""}
              onChange={(e) => set("disclosure_place", e.target.value)}
            />
          </Field>
        </FieldGrid>
        <div className="mt-4">
          <Label className="mb-1 block text-xs text-muted-foreground">Interne Notizen</Label>
          <Textarea
            rows={3}
            value={(form.internal_notes as string) ?? ""}
            onChange={(e) => set("internal_notes", e.target.value)}
          />
        </div>
      </Section>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg" className="shadow-glow">
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Selbstauskunft speichern
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {right}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CurrencyInput({
  value,
  onChange,
}: {
  value: number | string | null | undefined;
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
