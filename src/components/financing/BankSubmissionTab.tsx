import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Banknote } from "lucide-react";
import { DOSSIER_STATUS_LABELS, type DossierStatus } from "@/lib/financing";

const BANK_TYPES = [
  { value: "ubs", label: "UBS" },
  { value: "other", label: "Andere Bank" },
];

const SUBMISSION_STATUSES: DossierStatus[] = [
  "ready_for_bank", "submitted_to_bank", "documents_missing", "approved", "rejected",
];

export function BankSubmissionTab({ dossierId }: { dossierId: string }) {
  const qc = useQueryClient();

  const { data: dossier, isLoading } = useQuery({
    queryKey: ["financing_dossier_bank", dossierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers")
        .select("bank_type, bank_name, bank_contact, bank_email, bank_phone, bank_notes, dossier_status, submitted_to_bank_at, bank_decision_at")
        .eq("id", dossierId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>({});
  const merged = { ...(dossier ?? {}), ...form };

  const saveMutation = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase.from("financing_dossiers").update(patch).eq("id", dossierId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing_dossier", dossierId] });
      qc.invalidateQueries({ queryKey: ["financing_dossier_bank", dossierId] });
      qc.invalidateQueries({ queryKey: ["financing_dossiers"] });
      toast.success("Gespeichert");
      setForm({});
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Laden…</p>;

  const submittedDate = merged.submitted_to_bank_at
    ? new Date(merged.submitted_to_bank_at).toISOString().slice(0, 10)
    : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Banknote className="h-4 w-4" />Bankangaben</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Banktyp</Label>
              <Select value={merged.bank_type ?? ""} onValueChange={(v) => setForm({ ...form, bank_type: v })}>
                <SelectTrigger><SelectValue placeholder="Banktyp" /></SelectTrigger>
                <SelectContent>
                  {BANK_TYPES.map((b) => (<SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Bankname" value={merged.bank_name ?? ""} onChange={(v) => setForm({ ...form, bank_name: v })} />
            <Field label="Kontaktperson" value={merged.bank_contact ?? ""} onChange={(v) => setForm({ ...form, bank_contact: v })} />
            <Field label="E-Mail" value={merged.bank_email ?? ""} onChange={(v) => setForm({ ...form, bank_email: v })} />
            <Field label="Telefon" value={merged.bank_phone ?? ""} onChange={(v) => setForm({ ...form, bank_phone: v })} />
            <div>
              <Label className="text-xs">Einreichungsdatum</Label>
              <Input
                type="date"
                value={submittedDate}
                onChange={(e) => setForm({
                  ...form,
                  submitted_to_bank_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold">Status & Notizen</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge>{DOSSIER_STATUS_LABELS[merged.dossier_status as DossierStatus] ?? "Entwurf"}</Badge>
          </div>
          <div>
            <Label className="text-xs">Status setzen</Label>
            <Select value={merged.dossier_status ?? "draft"} onValueChange={(v) => setForm({ ...form, dossier_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBMISSION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{DOSSIER_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notizen zur Einreichung</Label>
            <Textarea
              rows={4}
              value={merged.bank_notes ?? ""}
              onChange={(e) => setForm({ ...form, bank_notes: e.target.value })}
              placeholder="Nachforderungen, Kommunikation, Auflagen…"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={Object.keys(form).length === 0 || saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />Speichern
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
