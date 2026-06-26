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
  Users, Plus, Trash2, ChevronLeft, ChevronRight,
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
  relationshipTypeLabels,
  relationshipTypes,
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

type CoApplicant = Row & { relationship_type: string };

const STEPS = [
  { id: "personal", label: "Persönlich" },
  { id: "job", label: "Beruf" },
  { id: "income", label: "Einnahmen" },
  { id: "expenses", label: "Ausgaben" },
  { id: "coapplicants", label: "Mitantragsteller" },
  { id: "review", label: "Übermitteln" },
] as const;

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
  const [step, setStep] = useState(0);
  const [coApplicants, setCoApplicants] = useState<CoApplicant[]>([]);

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
      const cleanedCoApplicants = coApplicants
        .map((c) => {
          const o: Row = { relationship_type: c.relationship_type || "co_applicant" };
          Object.entries(c).forEach(([k, v]) => {
            if (k === "relationship_type") return;
            if (v === "" || v === undefined || v === null) return;
            o[k] = v;
          });
          return o;
        })
        .filter((c) => (c.first_name || "").toString().trim() || (c.last_name || "").toString().trim());

      const { error: e2 } = await supabase.rpc("self_disclosure_link_submit_full", {
        _token: token,
        _coapplicants: cleanedCoApplicants,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Übermittelt");
      onSubmitted();
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Übermitteln"),
  });

  const addCoApplicant = (relationship_type: string) =>
    setCoApplicants((arr) => [
      ...arr,
      { relationship_type, country: "CH" },
    ]);

  const updateCoApplicant = (idx: number, k: string, v: any) =>
    setCoApplicants((arr) =>
      arr.map((c, i) => (i === idx ? { ...c, [k]: v } : c)),
    );

  const removeCoApplicant = (idx: number) =>
    setCoApplicants((arr) => arr.filter((_, i) => i !== idx));

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

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

      {/* Stepper */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {currentStep.id === "personal" && (
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
        )}

        {currentStep.id === "job" && (
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
        )}

        {currentStep.id === "income" && (
          <>
            <BenchmarkCard benchmark={benchmark} />
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
          </>
        )}

        {currentStep.id === "expenses" && (
          <>
            <BenchmarkCard benchmark={benchmark} />
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
          </>
        )}

        {currentStep.id === "coapplicants" && (
          <Section
            title="Mitantragsteller / Ehepartner (optional)"
            right={
              <span className="text-xs text-muted-foreground">
                <Users className="inline h-3 w-3 mr-1" />
                {coApplicants.length}
              </span>
            }
          >
            <p className="mb-4 text-sm text-muted-foreground">
              Möchten Sie Ihre Ehepartnerin / Ihren Ehepartner oder weitere
              Mitantragsteller mit angeben? Diese werden bei Ihrem Berater als
              eigene Person mit Ihnen verknüpft erfasst.
            </p>

            <div className="mb-4 flex flex-wrap gap-2">
              {relationshipTypes.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCoApplicant(t)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {relationshipTypeLabels[t]}
                </Button>
              ))}
            </div>

            <div className="space-y-6">
              {coApplicants.map((c, idx) => (
                <Card key={idx} className="border-dashed">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">
                          Person {idx + 1} —{" "}
                          {relationshipTypeLabels[
                            (c.relationship_type as keyof typeof relationshipTypeLabels) ?? "co_applicant"
                          ]}
                        </h4>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCoApplicant(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <Grid>
                      <FieldRow label="Beziehung">
                        <Select
                          value={c.relationship_type}
                          onValueChange={(v) => updateCoApplicant(idx, "relationship_type", v)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {relationshipTypes.map((t) => (
                              <SelectItem key={t} value={t}>{relationshipTypeLabels[t]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldRow>
                      <FieldRow label="Anrede">
                        <Select
                          value={(c.salutation as string) ?? ""}
                          onValueChange={(v) => updateCoApplicant(idx, "salutation", v)}
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
                          value={(c.marital_status as string) ?? ""}
                          onValueChange={(v) => updateCoApplicant(idx, "marital_status", v)}
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
                            value={(c[f.key] as string) ?? ""}
                            onChange={(e) => updateCoApplicant(idx, f.key, e.target.value)}
                          />
                        </FieldRow>
                      ))}
                      <FieldRow label="Status">
                        <Select
                          value={(c.employment_status as string) ?? ""}
                          onValueChange={(v) => updateCoApplicant(idx, "employment_status", v)}
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
                            value={(c[f.key] as string) ?? ""}
                            onChange={(e) => updateCoApplicant(idx, f.key, e.target.value)}
                          />
                        </FieldRow>
                      ))}
                      <FieldRow label="Lohn netto monatlich">
                        <Money
                          value={c.salary_net_monthly}
                          onChange={(n) => updateCoApplicant(idx, "salary_net_monthly", n)}
                        />
                      </FieldRow>
                    </Grid>

                    <div>
                      <h5 className="mb-2 text-sm font-semibold">Weitere Einnahmen / Monat</h5>
                      <Grid>
                        {incomeFields
                          .filter((f) => f !== "salary_net_monthly")
                          .map((f) => (
                            <FieldRow key={f} label={incomeLabels[f]}>
                              <Money
                                value={c[f]}
                                onChange={(n) => updateCoApplicant(idx, f, n)}
                              />
                            </FieldRow>
                          ))}
                      </Grid>
                    </div>

                    <div>
                      <h5 className="mb-2 text-sm font-semibold">Ausgaben / Monat</h5>
                      <Grid>
                        {expenseFields.map((f) => (
                          <FieldRow key={f} label={expenseLabels[f]}>
                            <Money
                              value={c[f]}
                              onChange={(n) => updateCoApplicant(idx, f, n)}
                            />
                          </FieldRow>
                        ))}
                      </Grid>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {coApplicants.length === 0 && (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Keine zusätzliche Person erfasst. Sie können diesen Schritt auch
                  überspringen.
                </p>
              )}
            </div>
          </Section>
        )}

        {currentStep.id === "review" && (
          <>
            <BenchmarkCard benchmark={benchmark} />
            <Section title="Zusammenfassung">
              <div className="space-y-2 text-sm">
                <Summary label="Name" value={`${form.first_name ?? ""} ${form.last_name ?? ""}`.trim()} />
                <Summary label="E-Mail" value={form.email} />
                <Summary label="Arbeitgeber" value={form.employer_name} />
                <Summary label="Lohn netto / Monat" value={formatCHF(form.salary_net_monthly)} />
                <Summary label="Einnahmen Total" value={formatCHF(benchmark.totalIncome)} />
                <Summary label="Ausgaben Total" value={formatCHF(benchmark.totalExpenses)} />
                <Summary label="Reserve" value={formatCHF(benchmark.reserveTotal)} />
                <Summary
                  label="Mitantragsteller"
                  value={
                    coApplicants.length
                      ? coApplicants
                          .map(
                            (c) =>
                              `${c.first_name ?? ""} ${c.last_name ?? ""} (${
                                relationshipTypeLabels[
                                  (c.relationship_type as keyof typeof relationshipTypeLabels) ?? "co_applicant"
                                ]
                              })`,
                          )
                          .join(", ")
                      : "Keine"
                  }
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Mit dem Klick auf „Übermitteln" senden Sie die Selbstauskunft sowie
                alle erfassten zusätzlichen Personen an Ihren Berater.
              </p>
            </Section>
          </>
        )}

        {/* Navigation */}
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/80 p-3 backdrop-blur">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Zwischenspeichern
            </Button>

            {isLast ? (
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
            ) : (
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                Weiter
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
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

function Summary({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dashed py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">
        {value && String(value).trim() !== "" ? value : "—"}
      </span>
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
