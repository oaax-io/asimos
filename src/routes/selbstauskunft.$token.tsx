import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, Loader2, Save, Send, ClipboardList,
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
  formatCHF,
} from "@/lib/self-disclosure";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";

export const Route = createFileRoute("/selbstauskunft/$token")({
  component: PublicSelfDisclosure,
});

type Row = Record<string, any>;

const STAMM = [
  { key: "first_name", label: "Vorname" },
  { key: "last_name", label: "Name" },
  { key: "birth_name", label: "Ledigname" },
  { key: "birth_date", label: "Geburtsdatum", type: "date" },
  { key: "nationality", label: "Staatsbürgerschaft" },
  { key: "street", label: "Strasse" },
  { key: "street_number", label: "Nr." },
  { key: "postal_code", label: "PLZ" },
  { key: "city", label: "Ort" },
  { key: "country", label: "Land" },
  { key: "phone", label: "Telefon" },
  { key: "mobile", label: "Mobil" },
  { key: "email", label: "E-Mail", type: "email" },
];

const JOB = [
  { key: "employer_name", label: "Arbeitgeber" },
  { key: "employed_as", label: "Beschäftigt als" },
  { key: "employed_since", label: "Beschäftigt seit", type: "date" },
];

function PublicSelfDisclosure() {
  const { token } = Route.useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["self_disclosure_link", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("self_disclosure_link_resolve", {
        _token: token,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  if (isLoading)
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Lädt…</p>
      </Shell>
    );

  if (error || !data || data.status === "invalid" || data.status === "expired") {
    return (
      <Shell>
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-orange-500" />
          <h1 className="mt-4 font-display text-2xl font-bold">Link nicht verfügbar</h1>
          <p className="mt-2 text-muted-foreground">
            Dieser Link ist ungültig oder abgelaufen.
          </p>
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
            Ihre Selbstauskunft wurde übermittelt. Ihr Berater meldet sich in Kürze.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <FormBody
      token={token}
      initial={(data.disclosure ?? {}) as Row}
      clientName={data.client_name}
      onSubmitted={() => refetch()}
    />
  );
}

function FormBody({
  token,
  initial,
  clientName,
  onSubmitted,
}: {
  token: string;
  initial: Row;
  clientName: string | null;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState<Row>(initial ?? {});
  useEffect(() => {
    setForm(initial ?? {});
  }, [initial]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const benchmark = useMemo(
    () => calculateBenchmark(form as Record<string, number | string | null>),
    [form],
  );

  const buildPayload = (): Row => {
    const out: Row = {};
    Object.entries(form).forEach(([k, v]) => {
      if (v === "" || v === undefined) return;
      out[k] = v;
    });
    return out;
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("self_disclosure_link_save", {
        _token: token,
        _payload: buildPayload(),
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Zwischenstand gespeichert"),
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Speichern"),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.rpc("self_disclosure_link_save", {
        _token: token,
        _payload: buildPayload(),
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc("self_disclosure_link_submit", {
        _token: token,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Übermittelt");
      onSubmitted();
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Übermitteln"),
  });

  return (
    <Shell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Selbstauskunft</h1>
          {clientName && (
            <p className="text-sm text-muted-foreground">{clientName}</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <BenchmarkCard benchmark={benchmark} />

        <Section title="Persönliche Angaben">
          <Grid>
            <FieldRow label="Anrede">
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
            </FieldRow>
            <FieldRow label="Familienstand">
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
            </FieldRow>
            {STAMM.map((f) => (
              <FieldRow key={f.key} label={f.label}>
                <Input
                  type={f.type ?? "text"}
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </FieldRow>
            ))}
          </Grid>
        </Section>

        <Section title="Beruf">
          <Grid>
            <FieldRow label="Status">
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
            </FieldRow>
            {JOB.map((f) => (
              <FieldRow key={f.key} label={f.label}>
                <Input
                  type={f.type ?? "text"}
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </FieldRow>
            ))}
            <FieldRow label="Lohn netto monatlich">
              <Money value={form.salary_net_monthly} onChange={(n) => set("salary_net_monthly", n)} />
            </FieldRow>
          </Grid>
        </Section>

        <Section
          title="Einnahmen monatlich"
          right={
            <span className="text-sm text-muted-foreground">
              Total:{" "}
              <strong className="text-foreground">{formatCHF(benchmark.totalIncome)}</strong>
            </span>
          }
        >
          <Grid>
            {incomeFields.map((f) => (
              <FieldRow key={f} label={incomeLabels[f]}>
                <Money value={form[f]} onChange={(n) => set(f, n)} />
              </FieldRow>
            ))}
          </Grid>
        </Section>

        <Section
          title="Ausgaben monatlich"
          right={
            <span className="text-sm text-muted-foreground">
              Total:{" "}
              <strong className="text-foreground">{formatCHF(benchmark.totalExpenses)}</strong>
            </span>
          }
        >
          <Grid>
            {expenseFields.map((f) => (
              <FieldRow key={f} label={expenseLabels[f]}>
                <Money value={form[f]} onChange={(n) => set(f, n)} />
              </FieldRow>
            ))}
          </Grid>
        </Section>

        <div className="sticky bottom-4 z-10 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            size="lg"
          >
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Zwischenspeichern
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            size="lg"
            className="shadow-glow"
          >
            {submit.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Übermitteln
          </Button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/20 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">{children}</div>
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

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Money({
  value,
  onChange,
}: {
  value: any;
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
