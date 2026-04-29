import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import {
  expenseFields,
  expenseLabels,
  incomeFields,
  incomeLabels,
  employmentStatusOptions,
  maritalStatusOptions,
  salutationOptions,
  calculateBenchmark,
  formatCHF,
} from "@/lib/self-disclosure";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";

type Row = Record<string, any>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  onSaved?: () => void;
}

export function FinancingEditorDialog({ open, onOpenChange, clientId, onSaved }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    enabled: open,
    queryKey: ["financing_editor", clientId],
    queryFn: async () => {
      const [disc, fin, docs] = await Promise.all([
        supabase.from("client_self_disclosures").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("financing_profiles").select("*").eq("client_id", clientId).maybeSingle(),
        supabase
          .from("documents")
          .select("*")
          .eq("related_type", "client")
          .eq("related_id", clientId)
          .order("created_at", { ascending: false }),
      ]);
      return {
        disclosure: (disc.data ?? {}) as Row,
        financing: (fin.data ?? {}) as Row,
        documents: docs.data ?? [],
      };
    },
  });

  const [disc, setDisc] = useState<Row>({});
  const [fin, setFin] = useState<Row>({});

  useEffect(() => {
    if (data) {
      setDisc(data.disclosure ?? {});
      setFin(data.financing ?? {});
    }
  }, [data]);

  const setD = (k: string, v: any) => setDisc((p) => ({ ...p, [k]: v }));
  const setF = (k: string, v: any) => setFin((p) => ({ ...p, [k]: v }));

  const benchmark = calculateBenchmark(disc as any);

  const save = useMutation({
    mutationFn: async () => {
      const discPayload = {
        ...disc,
        client_id: clientId,
        total_income_monthly: benchmark.totalIncome,
        total_expenses_monthly: benchmark.totalExpenses,
        reserve_total: benchmark.reserveTotal,
        reserve_ratio: Number(benchmark.reserveRatio.toFixed(2)),
        benchmark_status: benchmark.status,
      };
      const { error: e1 } = await supabase
        .from("client_self_disclosures")
        .upsert(discPayload, { onConflict: "client_id" });
      if (e1) throw e1;

      const finPayload: Row = { ...fin, client_id: clientId };
      // numeric coercion
      ["income", "equity", "budget"].forEach((k) => {
        if (finPayload[k] === "" || finPayload[k] === undefined) finPayload[k] = null;
        else if (finPayload[k] !== null) finPayload[k] = Number(finPayload[k]);
      });

      if (fin?.id) {
        const { error } = await supabase
          .from("financing_profiles")
          .update(finPayload)
          .eq("id", fin.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financing_profiles").insert(finPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["financing_editor", clientId] });
      qc.invalidateQueries({ queryKey: ["client_self_disclosure", clientId] });
      qc.invalidateQueries({ queryKey: ["financing_dossier", clientId] });
      qc.invalidateQueries({ queryKey: ["client_status_flags", clientId] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Speichern fehlgeschlagen"),
  });

  const num = (v: any) => (v === null || v === undefined ? "" : String(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b p-6">
          <DialogTitle>Finanzierung &amp; Selbstauskunft bearbeiten</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto p-6">
            <Tabs defaultValue="personal">
              <TabsList className="mb-6 flex flex-wrap">
                <TabsTrigger value="personal">Persönlich</TabsTrigger>
                <TabsTrigger value="address">Adresse</TabsTrigger>
                <TabsTrigger value="income">Einkommen</TabsTrigger>
                <TabsTrigger value="expenses">Ausgaben</TabsTrigger>
                <TabsTrigger value="financing">Finanzierung</TabsTrigger>
                <TabsTrigger value="documents">Dokumente</TabsTrigger>
              </TabsList>

              {/* Persönlich */}
              <TabsContent value="personal" className="space-y-4">
                <Grid>
                  <Field label="Anrede">
                    <Select value={disc.salutation ?? ""} onValueChange={(v) => setD("salutation", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {salutationOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Titel"><Input value={disc.title ?? ""} onChange={(e) => setD("title", e.target.value)} /></Field>
                  <Field label="Vorname"><Input value={disc.first_name ?? ""} onChange={(e) => setD("first_name", e.target.value)} /></Field>
                  <Field label="Name"><Input value={disc.last_name ?? ""} onChange={(e) => setD("last_name", e.target.value)} /></Field>
                  <Field label="Geburtsdatum"><Input type="date" value={disc.birth_date ?? ""} onChange={(e) => setD("birth_date", e.target.value)} /></Field>
                  <Field label="Nationalität"><Input value={disc.nationality ?? ""} onChange={(e) => setD("nationality", e.target.value)} /></Field>
                  <Field label="Familienstand">
                    <Select value={disc.marital_status ?? ""} onValueChange={(v) => setD("marital_status", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {maritalStatusOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="E-Mail"><Input type="email" value={disc.email ?? ""} onChange={(e) => setD("email", e.target.value)} /></Field>
                  <Field label="Telefon"><Input value={disc.phone ?? ""} onChange={(e) => setD("phone", e.target.value)} /></Field>
                  <Field label="Mobil"><Input value={disc.mobile ?? ""} onChange={(e) => setD("mobile", e.target.value)} /></Field>
                  <Field label="Beschäftigungsstatus">
                    <Select value={disc.employment_status ?? ""} onValueChange={(v) => setD("employment_status", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {employmentStatusOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Arbeitgeber"><Input value={disc.employer_name ?? ""} onChange={(e) => setD("employer_name", e.target.value)} /></Field>
                  <Field label="Beschäftigt als"><Input value={disc.employed_as ?? ""} onChange={(e) => setD("employed_as", e.target.value)} /></Field>
                  <Field label="Beschäftigt seit"><Input type="date" value={disc.employed_since ?? ""} onChange={(e) => setD("employed_since", e.target.value)} /></Field>
                </Grid>
              </TabsContent>

              {/* Adresse */}
              <TabsContent value="address" className="space-y-4">
                <Grid>
                  <Field label="Strasse"><Input value={disc.street ?? ""} onChange={(e) => setD("street", e.target.value)} /></Field>
                  <Field label="Nr."><Input value={disc.street_number ?? ""} onChange={(e) => setD("street_number", e.target.value)} /></Field>
                  <Field label="PLZ"><Input value={disc.postal_code ?? ""} onChange={(e) => setD("postal_code", e.target.value)} /></Field>
                  <Field label="Ort"><Input value={disc.city ?? ""} onChange={(e) => setD("city", e.target.value)} /></Field>
                  <Field label="Land"><Input value={disc.country ?? "CH"} onChange={(e) => setD("country", e.target.value)} /></Field>
                  <Field label="Wohnhaft seit"><Input type="date" value={disc.resident_since ?? ""} onChange={(e) => setD("resident_since", e.target.value)} /></Field>
                </Grid>
              </TabsContent>

              {/* Einkommen */}
              <TabsContent value="income" className="space-y-4">
                <BenchmarkCard benchmark={benchmark} />
                <div className="text-sm text-muted-foreground">
                  Total Einnahmen: <strong className="text-foreground">{formatCHF(benchmark.totalIncome)}</strong>
                </div>
                <Grid>
                  {incomeFields.map((f) => (
                    <Field key={f} label={incomeLabels[f]}>
                      <Input
                        type="number"
                        value={num(disc[f])}
                        onChange={(e) => setD(f, e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </Field>
                  ))}
                  <Field label="Jahresgehalt netto">
                    <Input
                      type="number"
                      value={num(disc.annual_net_salary)}
                      onChange={(e) => setD("annual_net_salary", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </Field>
                </Grid>
              </TabsContent>

              {/* Ausgaben */}
              <TabsContent value="expenses" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Total Ausgaben: <strong className="text-foreground">{formatCHF(benchmark.totalExpenses)}</strong>
                </div>
                <Grid>
                  {expenseFields.map((f) => (
                    <Field key={f} label={expenseLabels[f]}>
                      <Input
                        type="number"
                        value={num(disc[f])}
                        onChange={(e) => setD(f, e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </Field>
                  ))}
                </Grid>
              </TabsContent>

              {/* Finanzierung */}
              <TabsContent value="financing" className="space-y-4">
                <Grid>
                  <Field label="Budget (CHF)">
                    <Input type="number" value={num(fin.budget)} onChange={(e) => setF("budget", e.target.value)} />
                  </Field>
                  <Field label="Eigenkapital (CHF)">
                    <Input type="number" value={num(fin.equity)} onChange={(e) => setF("equity", e.target.value)} />
                  </Field>
                  <Field label="Einkommen (CHF/Jahr)">
                    <Input type="number" value={num(fin.income)} onChange={(e) => setF("income", e.target.value)} />
                  </Field>
                  <Field label="Profil-Status">
                    <Select value={fin.profile_status ?? "incomplete"} onValueChange={(v) => setF("profile_status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="incomplete">Unvollständig</SelectItem>
                        <SelectItem value="in_review">In Prüfung</SelectItem>
                        <SelectItem value="complete">Vollständig</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Freigabe-Status">
                    <Select value={fin.approval_status ?? ""} onValueChange={(v) => setF("approval_status", v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Offen</SelectItem>
                        <SelectItem value="in_review">In Prüfung</SelectItem>
                        <SelectItem value="approved">Bestätigt</SelectItem>
                        <SelectItem value="rejected">Abgelehnt</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Bank">
                    <Input value={fin.bank_name ?? ""} onChange={(e) => setF("bank_name", e.target.value)} />
                  </Field>
                  <Field label="Bank-Ansprechpartner">
                    <Input value={fin.bank_contact ?? ""} onChange={(e) => setF("bank_contact", e.target.value)} />
                  </Field>
                  <Field label="Bank E-Mail">
                    <Input type="email" value={fin.bank_email ?? ""} onChange={(e) => setF("bank_email", e.target.value)} />
                  </Field>
                  <Field label="Bank Telefon">
                    <Input value={fin.bank_phone ?? ""} onChange={(e) => setF("bank_phone", e.target.value)} />
                  </Field>
                </Grid>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Interne Notizen</Label>
                  <Textarea
                    rows={3}
                    value={fin.internal_notes ?? ""}
                    onChange={(e) => setF("internal_notes", e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Dokumente */}
              <TabsContent value="documents" className="space-y-3">
                {(data?.documents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Dokumente hinterlegt. Lade Dokumente im Tab «Dokumente» auf der Kundenseite hoch.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {(data?.documents ?? []).map((d: any) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{d.file_name ?? "Dokument"}</p>
                            <p className="text-xs text-muted-foreground">{d.document_type ?? "—"}</p>
                          </div>
                        </div>
                        {d.file_url && (
                          <Button asChild size="sm" variant="outline">
                            <a href={d.file_url} target="_blank" rel="noreferrer">
                              <Download className="mr-1.5 h-4 w-4" />Öffnen
                            </a>
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
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
