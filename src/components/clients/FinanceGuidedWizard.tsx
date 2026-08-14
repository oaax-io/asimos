import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  SkipForward,
  Wallet,
  Receipt,
  PiggyBank,
  CreditCard,
  ShieldCheck,
  Landmark,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";

import {
  areaLabels,
  categoryOptions,
  periodicityLabels,
  personScopeLabels,
  type FinanceArea,
  type PersonScope,
  type Periodicity,
} from "@/lib/client-finance";
import { formatCHF } from "@/lib/self-disclosure";

const steps: FinanceArea[] = [
  "income",
  "expense",
  "asset",
  "liability",
  "insurance",
  "pension",
];

const stepHints: Record<FinanceArea, string> = {
  income: "Alle regelmässigen Einnahmen von Hauptkunde, Partner/in oder gemeinsam.",
  expense: "Fixe und variable Haushaltsausgaben – ohne Versicherungen und Kredite.",
  asset: "Konten, Wertschriften, Vorsorgeguthaben. Optional: Anteil als Eigenmittel.",
  liability: "Kredite, Leasing, Karten – mit monatlicher Rate und Restschuld.",
  insurance: "Prämien; sie fliessen automatisch ins Budget ein.",
  pension: "Sparpläne und Vorsorge – Doppelzählung mit Vermögen vermeiden.",
};

type Draft = {
  key: string;
  category: string;
  label: string;
  amount: string;
  periodicity: Periodicity;
  person_scope: PersonScope;
  person_client_id: string;
  available_as_equity: string;
  provider: string;
  remaining_debt: string;
  interest_rate: string;
};

const newDraft = (area: FinanceArea): Draft => ({
  key: Math.random().toString(36).slice(2),
  category: categoryOptions[area][0],
  label: "",
  amount: "",
  periodicity: area === "asset" ? "once" : "monthly",
  person_scope: "main",
  person_client_id: "",
  available_as_equity: "",
  provider: "",
  remaining_debt: "",
  interest_rate: "",
});

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function FinanceGuidedWizard({
  open,
  onOpenChange,
  clientId,
  people = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  people?: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>({});
  const [savedCount, setSavedCount] = useState(0);

  const area = steps[step];

  useEffect(() => {
    if (open) {
      setStep(0);
      setDrafts({});
      setSavedCount(0);
    }
  }, [open]);

  const rows = drafts[area] ?? [];
  const setRows = (next: Draft[]) => setDrafts((d) => ({ ...d, [area]: next }));

  // Beim Öffnen eines Schritts immer eine leere Position bereitstellen
  useEffect(() => {
    if (!open) return;
    setDrafts((d) => (d[area]?.length ? d : { ...d, [area]: [newDraft(area)] }));
  }, [open, area]);


  const filled = rows.filter((r) => Number(r.amount || 0) > 0);
  const stepTotal = useMemo(
    () => filled.reduce((s, r) => s + Number(r.amount || 0), 0),
    [filled],
  );

  const save = useMutation({
    mutationFn: async (list: Draft[]) => {
      if (!list.length) return 0;
      const payload = list.map((r) => ({
        client_id: clientId,
        area,
        category: r.category,
        label: r.label || null,
        amount: Number(r.amount || 0),
        periodicity: r.periodicity,
        person_scope: r.person_scope,
        person_client_id: r.person_client_id || null,
        available_as_equity:
          area === "asset" ? numOrNull(r.available_as_equity) : null,
        details: {
          provider: r.provider || null,
          remaining_debt: numOrNull(r.remaining_debt),
          interest_rate: numOrNull(r.interest_rate),
        },
        source: "manual" as const,
      }));
      const { error } = await supabase
        .from("client_financial_items")
        .insert(payload);
      if (error) throw error;
      return list.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["client_financial_items", clientId] });
      if (n) setSavedCount((c) => c + n);
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });

  const goNext = async (persist: boolean) => {
    if (persist && filled.length) {
      await save.mutateAsync(filled);
      setRows([]);
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      toast.success(
        savedCount + (persist ? filled.length : 0) > 0
          ? "Finanzdaten gespeichert"
          : "Assistent abgeschlossen",
      );
      onOpenChange(false);
    }
  };

  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finanzdaten Schritt für Schritt</DialogTitle>
          <DialogDescription>{stepHints[area]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {steps.map((s, i) => (
                <Badge
                  key={s}
                  variant={i === step ? "default" : "outline"}
                  className={
                    "cursor-pointer text-[10px] " +
                    (i < step ? "opacity-70" : "")
                  }
                  onClick={() => setStep(i)}
                >
                  {i < step && <Check className="mr-1 h-3 w-3" />}
                  {areaLabels[s]}
                </Badge>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Schritt {step + 1} / {steps.length}
            </span>
          </div>
          <Progress value={((step + 1) / steps.length) * 100} className="h-1.5" />
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Keine Position in diesem Schritt. Du kannst ihn überspringen oder
              eine Position hinzufügen.
            </p>
          )}

          {rows.map((r, idx) => (
            <div
              key={r.key}
              className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2"
            >
              <FieldRow label="Kategorie">
                <Select
                  value={r.category}
                  onValueChange={(v) =>
                    setRows(rows.map((x, i) => (i === idx ? { ...x, category: v } : x)))
                  }
                >
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
              </FieldRow>

              <FieldRow label="Bezeichnung (optional)">
                <Input
                  value={r.label}
                  onChange={(e) =>
                    setRows(
                      rows.map((x, i) =>
                        i === idx ? { ...x, label: e.target.value } : x,
                      ),
                    )
                  }
                />
              </FieldRow>

              <FieldRow label="Betrag (CHF)">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) =>
                    setRows(
                      rows.map((x, i) =>
                        i === idx ? { ...x, amount: e.target.value } : x,
                      ),
                    )
                  }
                />
              </FieldRow>

              <FieldRow label="Periodizität">
                <Select
                  value={r.periodicity}
                  onValueChange={(v) =>
                    setRows(
                      rows.map((x, i) =>
                        i === idx ? { ...x, periodicity: v as Periodicity } : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(periodicityLabels) as Periodicity[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {periodicityLabels[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>

              <FieldRow label="Person">
                <Select
                  value={r.person_scope}
                  onValueChange={(v) =>
                    setRows(
                      rows.map((x, i) =>
                        i === idx ? { ...x, person_scope: v as PersonScope } : x,
                      ),
                    )
                  }
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
              </FieldRow>

              {people.length > 0 && (
                <FieldRow label="Familienmitglied (optional)">
                  <Select
                    value={r.person_client_id || "none"}
                    onValueChange={(v) =>
                      setRows(
                        rows.map((x, i) =>
                          i === idx
                            ? { ...x, person_client_id: v === "none" ? "" : v }
                            : x,
                        ),
                      )
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
                </FieldRow>
              )}

              {area === "asset" && (
                <FieldRow label="Davon als Eigenmittel (CHF)">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={r.available_as_equity}
                    onChange={(e) =>
                      setRows(
                        rows.map((x, i) =>
                          i === idx
                            ? { ...x, available_as_equity: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </FieldRow>
              )}

              {(area === "insurance" || area === "liability" || area === "income") && (
                <FieldRow
                  label={
                    area === "income"
                      ? "Arbeitgeber / Quelle"
                      : area === "insurance"
                        ? "Versicherer"
                        : "Gläubiger / Institut"
                  }
                >
                  <Input
                    value={r.provider}
                    onChange={(e) =>
                      setRows(
                        rows.map((x, i) =>
                          i === idx ? { ...x, provider: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </FieldRow>
              )}

              {area === "liability" && (
                <>
                  <FieldRow label="Restschuld (CHF)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={r.remaining_debt}
                      onChange={(e) =>
                        setRows(
                          rows.map((x, i) =>
                            i === idx
                              ? { ...x, remaining_debt: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </FieldRow>
                  <FieldRow label="Zinssatz (%)">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={r.interest_rate}
                      onChange={(e) =>
                        setRows(
                          rows.map((x, i) =>
                            i === idx
                              ? { ...x, interest_rate: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </FieldRow>
                </>
              )}

              <div className="sm:col-span-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Entfernen
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRows([...rows, newDraft(area)])}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Position hinzufügen
            </Button>
            {filled.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {filled.length} Position(en) · Summe {formatCHF(stepTotal)}
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || save.isPending}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Zurück
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => goNext(false)}
              disabled={save.isPending}
            >
              <SkipForward className="mr-1.5 h-4 w-4" />
              Überspringen
            </Button>
            <Button onClick={() => goNext(true)} disabled={save.isPending}>
              {isLast ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Speichern & abschliessen
                </>
              ) : (
                <>
                  Speichern & weiter
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({
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
