import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import {
  areaLabels,
  categoryOptions,
  periodicityLabels,
  personScopeLabels,
  type FinanceArea,
  type FinanceItem,
  type PersonScope,
  type Periodicity,
} from "@/lib/client-finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  area: FinanceArea;
  item?: FinanceItem | null;
  people?: { id: string; name: string }[];
}

type FormState = {
  category: string;
  label: string;
  amount: string;
  periodicity: Periodicity;
  person_scope: PersonScope;
  person_client_id: string;
  available_as_equity: string;
  notes: string;
  // details
  provider: string;
  policy_number: string;
  start_date: string;
  end_date: string;
  coverage: string;
  surrender_value: string;
  original_amount: string;
  remaining_debt: string;
  interest_rate: string;
  term: string;
};

const empty = (area: FinanceArea): FormState => ({
  category: categoryOptions[area][0],
  label: "",
  amount: "",
  periodicity: area === "asset" ? "once" : "monthly",
  person_scope: "main",
  person_client_id: "",
  available_as_equity: "",
  notes: "",
  provider: "",
  policy_number: "",
  start_date: "",
  end_date: "",
  coverage: "",
  surrender_value: "",
  original_amount: "",
  remaining_debt: "",
  interest_rate: "",
  term: "",
});

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function FinanceItemDialog({
  open,
  onOpenChange,
  clientId,
  area,
  item,
  people = [],
}: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty(area));

  useEffect(() => {
    if (!open) return;
    if (item) {
      const d = item.details ?? {};
      setForm({
        category: item.category || categoryOptions[area][0],
        label: str(item.label),
        amount: str(item.amount),
        periodicity: item.periodicity,
        person_scope: item.person_scope,
        person_client_id: item.person_client_id ?? "",
        available_as_equity: str(item.available_as_equity),
        notes: str(item.notes),
        provider: str(d.provider),
        policy_number: str(d.policy_number),
        start_date: str(d.start_date),
        end_date: str(d.end_date),
        coverage: str(d.coverage),
        surrender_value: str(d.surrender_value),
        original_amount: str(d.original_amount),
        remaining_debt: str(d.remaining_debt),
        interest_rate: str(d.interest_rate),
        term: str(d.term),
      });
    } else {
      setForm(empty(area));
    }
  }, [open, item, area]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const details: Record<string, any> = {};
      if (area === "insurance") {
        Object.assign(details, {
          provider: form.provider || null,
          policy_number: form.policy_number || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          coverage: numOrNull(form.coverage),
          surrender_value: numOrNull(form.surrender_value),
        });
      }
      if (area === "liability") {
        Object.assign(details, {
          provider: form.provider || null,
          original_amount: numOrNull(form.original_amount),
          remaining_debt: numOrNull(form.remaining_debt),
          interest_rate: numOrNull(form.interest_rate),
          term: form.term || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });
      }
      if (area === "income") {
        Object.assign(details, { provider: form.provider || null });
      }

      const payload = {
        client_id: clientId,
        area,
        category: form.category,
        label: form.label || null,
        amount: Number(form.amount || 0),
        periodicity: form.periodicity,
        person_scope: form.person_scope,
        person_client_id: form.person_client_id || null,
        available_as_equity:
          area === "asset" ? numOrNull(form.available_as_equity) : null,
        details,
        notes: form.notes || null,
      };

      if (item?.id) {
        const { error } = await supabase
          .from("client_financial_items")
          .update(payload)
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_financial_items")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_financial_items", clientId] });
      toast.success(item ? "Position aktualisiert" : "Position hinzugefügt");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? "Position bearbeiten" : "Position hinzufügen"} –{" "}
            {areaLabels[area]}
          </DialogTitle>
          <DialogDescription>
            Erfasse die Angaben. Nur die Felder ausfüllen, die relevant sind.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategorie">
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions[area].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Bezeichnung (optional)">
            <Input
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="z. B. Sparkonto ZKB"
            />
          </Field>

          <Field label="Betrag (CHF)">
            <Input
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </Field>

          <Field label="Periodizität">
            <Select
              value={form.periodicity}
              onValueChange={(v) => set("periodicity", v as Periodicity)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(periodicityLabels) as Periodicity[]
                ).map((p) => (
                  <SelectItem key={p} value={p}>
                    {periodicityLabels[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Person">
            <Select
              value={form.person_scope}
              onValueChange={(v) => set("person_scope", v as PersonScope)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(personScopeLabels) as PersonScope[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {personScopeLabels[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {people.length > 0 && (
            <Field label="Familienmitglied (optional)">
              <Select
                value={form.person_client_id || "none"}
                onValueChange={(v) =>
                  set("person_client_id", v === "none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {area === "asset" && (
            <Field label="Davon als Eigenmittel verfügbar (CHF)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.available_as_equity}
                onChange={(e) => set("available_as_equity", e.target.value)}
              />
            </Field>
          )}

          {(area === "insurance" || area === "liability" || area === "income") && (
            <Field
              label={
                area === "income"
                  ? "Arbeitgeber / Quelle"
                  : area === "insurance"
                    ? "Versicherer"
                    : "Gläubiger / Institut"
              }
            >
              <Input
                value={form.provider}
                onChange={(e) => set("provider", e.target.value)}
              />
            </Field>
          )}

          {area === "insurance" && (
            <>
              <Field label="Policennummer">
                <Input
                  value={form.policy_number}
                  onChange={(e) => set("policy_number", e.target.value)}
                />
              </Field>
              <Field label="Versicherungsbeginn">
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </Field>
              <Field label="Versicherungsende">
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                />
              </Field>
              <Field label="Deckungssumme (CHF)">
                <Input
                  type="number"
                  value={form.coverage}
                  onChange={(e) => set("coverage", e.target.value)}
                />
              </Field>
              <Field label="Rückkaufswert (CHF)">
                <Input
                  type="number"
                  value={form.surrender_value}
                  onChange={(e) => set("surrender_value", e.target.value)}
                />
              </Field>
            </>
          )}

          {area === "liability" && (
            <>
              <Field label="Ursprünglicher Betrag (CHF)">
                <Input
                  type="number"
                  value={form.original_amount}
                  onChange={(e) => set("original_amount", e.target.value)}
                />
              </Field>
              <Field label="Aktuelle Restschuld (CHF)">
                <Input
                  type="number"
                  value={form.remaining_debt}
                  onChange={(e) => set("remaining_debt", e.target.value)}
                />
              </Field>
              <Field label="Zinssatz (%)">
                <Input
                  type="number"
                  step="0.01"
                  value={form.interest_rate}
                  onChange={(e) => set("interest_rate", e.target.value)}
                />
              </Field>
              <Field label="Laufzeit">
                <Input
                  value={form.term}
                  onChange={(e) => set("term", e.target.value)}
                  placeholder="z. B. 48 Monate"
                />
              </Field>
              <Field label="Startdatum">
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </Field>
              <Field label="Enddatum">
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                />
              </Field>
            </>
          )}

          <div className="sm:col-span-2">
            <Field label="Bemerkung">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
