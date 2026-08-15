import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  expenseFields,
  expenseLabels,
  formatCHF,
  incomeFields,
  incomeLabels,
} from "@/lib/self-disclosure";

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
  id?: string;
  disclosureField?: string;
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

const draftFromItem = (item: any): Draft => ({
  key: item.id,
  id: item.id,
  category: item.category ?? "",
  label: item.label ?? "",
  amount: item.amount != null ? String(item.amount) : "",
  periodicity: (item.periodicity ?? "monthly") as Periodicity,
  person_scope: (item.person_scope ?? "main") as PersonScope,
  person_client_id: item.person_client_id ?? "",
  available_as_equity:
    item.available_as_equity != null ? String(item.available_as_equity) : "",
  provider: item.details?.provider ?? "",
  remaining_debt:
    item.details?.remaining_debt != null
      ? String(item.details.remaining_debt)
      : "",
  interest_rate:
    item.details?.interest_rate != null
      ? String(item.details.interest_rate)
      : "",
});

export function FinanceGuidedWizard({
  open,
  onOpenChange,
  clientId,
  people = [],
  startArea,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  people?: { id: string; name: string }[];
  startArea?: FinanceArea;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>({});
  const [loadedSteps, setLoadedSteps] = useState<Record<string, boolean>>({});
  const [savedCount, setSavedCount] = useState(0);

  const area = steps[step];

  const { data: existing = [] } = useQuery<any[]>({
    queryKey: ["client_financial_items", clientId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_items")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Werte aus der Selbstauskunft (Gehalt, Ausgaben …) mitladen
  const { data: disclosure } = useQuery<any>({
    queryKey: ["client_self_disclosure", clientId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_self_disclosures")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  useEffect(() => {
    if (open) {
      const idx = startArea ? steps.indexOf(startArea) : 0;
      setStep(idx >= 0 ? idx : 0);
      setDrafts({});
      setLoadedSteps({});
      setSavedCount(0);
    }
  }, [open, startArea]);

  const rows = drafts[area] ?? [];
  const setRows = (next: Draft[]) => setDrafts((d) => ({ ...d, [area]: next }));

  // Bestehende Positionen laden, sonst eine leere Position bereitstellen
  useEffect(() => {
    if (!open || loadedSteps[area]) return;

    const fromDisclosure: Draft[] = [];
    if (disclosure) {
      const fields =
        area === "income"
          ? incomeFields.map((f) => [f, incomeLabels[f]] as const)
          : area === "expense"
            ? expenseFields.map((f) => [f, expenseLabels[f]] as const)
            : [];
      for (const [field, label] of fields) {
        const value = Number(disclosure[field] ?? 0);
        if (!Number.isFinite(value) || value === 0) continue;
        fromDisclosure.push({
          ...newDraft(area),
          key: `sd:${field}`,
          disclosureField: field,
          category: label,
          label,
          amount: String(value),
          periodicity: "monthly",
        });
      }
    }

    const mine = existing.filter((i) => i.area === area).map(draftFromItem);
    const all = [...fromDisclosure, ...mine];
    setDrafts((d) => ({ ...d, [area]: all.length ? all : [newDraft(area)] }));
    setLoadedSteps((s) => ({ ...s, [area]: true }));
  }, [open, area, existing, disclosure, loadedSteps]);

  const filled = rows.filter(
    (r) => r.disclosureField || Number(r.amount || 0) > 0,
  );
  const stepTotal = useMemo(
    () => filled.reduce((s, r) => s + Number(r.amount || 0), 0),
    [filled],
  );


  const removeRow = async (r: Draft) => {
    setRows(rows.filter((x) => x.key !== r.key));
    if (r.disclosureField) {
      const { error } = await supabase
        .from("client_self_disclosures")
        .update({ [r.disclosureField]: null } as any)
        .eq("client_id", clientId);
      if (error) {
        toast.error(error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["client_self_disclosure", clientId] });
      toast.success("Position entfernt");
      return;
    }
    if (!r.id) return;
    const { error } = await supabase
      .from("client_financial_items")
      .delete()
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["client_financial_items", clientId] });
    toast.success("Position gelöscht");
  };

  const save = useMutation({
    mutationFn: async (list: Draft[]) => {
      if (!list.length) return 0;
      const toPayload = (r: Draft) => ({
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
      });

      // Selbstauskunfts-Werte direkt in der Selbstauskunft aktualisieren
      const sdRows = list.filter((r) => r.disclosureField);
      if (sdRows.length) {
        const patch: Record<string, number | null> = {};
        for (const r of sdRows) {
          patch[r.disclosureField!] = numOrNull(r.amount);
        }
        const { error } = await supabase
          .from("client_self_disclosures")
          .update(patch as any)
          .eq("client_id", clientId);
        if (error) throw error;
      }

      const items = list.filter((r) => !r.disclosureField);
      const inserts = items.filter((r) => !r.id);
      const updates = items.filter((r) => r.id);

      if (inserts.length) {
        const { error } = await supabase
          .from("client_financial_items")
          .insert(inserts.map(toPayload));
        if (error) throw error;
      }
      for (const r of updates) {
        const { error } = await supabase
          .from("client_financial_items")
          .update(toPayload(r))
          .eq("id", r.id!);
        if (error) throw error;
      }
      return inserts.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["client_financial_items", clientId] });
      qc.invalidateQueries({ queryKey: ["client_self_disclosure", clientId] });
      if (n) setSavedCount((c) => c + n);
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });


  const goNext = async (persist: boolean) => {
    if (persist && filled.length) {
      await save.mutateAsync(filled);
      setLoadedSteps((s) => ({ ...s, [area]: false }));
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
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
              {r.disclosureField && (
                <div className="sm:col-span-2">
                  <Badge variant="secondary" className="text-[10px]">
                    Aus Selbstauskunft
                  </Badge>
                </div>
              )}
              <FieldRow label="Kategorie">
                {r.disclosureField ? (
                  <Input value={r.category} disabled />
                ) : (
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
                )}

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
                  onClick={() => removeRow(r)}
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
        <HelpPanel area={area} />
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

const helpContent: Record<
  FinanceArea,
  {
    icon: typeof Wallet;
    intro: string;
    examples: string[];
    tips: string[];
    warn?: string;
  }
> = {
  income: {
    icon: Wallet,
    intro:
      "Alles, was regelmässig aufs Konto kommt – Basis für Tragbarkeit und Budget.",
    examples: [
      "Nettolohn Haupt- und Nebenerwerb",
      "13. Monatslohn / Bonus (jährlich erfassen)",
      "Renten, Alimente, Mieteinnahmen",
    ],
    tips: [
      "Beträge netto erfassen, Periodizität korrekt wählen – wird automatisch auf Monat gerechnet.",
      "Partnereinkommen über «Person» zuordnen, nicht zusammenzählen.",
    ],
    warn: "Bonus/Variable Anteile werden von Banken oft nur zu 50–100 % angerechnet.",
  },
  expense: {
    icon: Receipt,
    intro:
      "Laufende Haushaltskosten – zeigt dem Kunden, was am Monatsende wirklich frei bleibt.",
    examples: [
      "Miete / Nebenkosten",
      "Steuern, Krankenkasse-Selbstbehalt, Kita",
      "Mobilität, Lebensmittel, Freizeit",
    ],
    tips: [
      "Versicherungen und Kredite hier NICHT erfassen – dafür gibt es eigene Schritte.",
      "Jährliche Kosten (z. B. Steuern) mit Periodizität «jährlich» erfassen.",
    ],
  },
  asset: {
    icon: PiggyBank,
    intro: "Was vorhanden ist – und wie viel davon wirklich als Eigenmittel dient.",
    examples: [
      "Spar- und Lohnkonto, Festgeld",
      "Wertschriften, Krypto",
      "Säule 3a, Freizügigkeitsguthaben",
    ],
    tips: [
      "«Davon als Eigenmittel» nur den Teil eintragen, der tatsächlich eingesetzt wird.",
      "Vorsorgegelder gelten als weiche Eigenmittel (max. 10 % des Kaufpreises).",
    ],
    warn: "Reserve von 3–6 Monatslöhnen nicht als Eigenmittel einplanen.",
  },
  liability: {
    icon: CreditCard,
    intro:
      "Kredite und Leasing belasten die Tragbarkeit stark – Banken rechnen sie hoch an.",
    examples: [
      "Autoleasing, Konsumkredit",
      "Kreditkarten-Teilzahlung",
      "Privatdarlehen mit Rückzahlung",
    ],
    tips: [
      "Monatliche Rate + Restschuld erfassen – beides ist für die Bank relevant.",
      "Bei Ablösung vor Kauf im Gespräch festhalten.",
    ],
    warn: "Banken rechnen Kredite oft mit ~10 % der Restschuld pro Jahr an.",
  },
  insurance: {
    icon: ShieldCheck,
    intro: "Prämien fliessen automatisch ins Budget – wichtig für ein realistisches Bild.",
    examples: [
      "Krankenkasse (Grund + Zusatz)",
      "Hausrat / Privathaftpflicht",
      "Lebens- und Risikoversicherung (3b)",
    ],
    tips: [
      "Versicherer und Policennummer erfassen – hilft beim Bankdossier.",
      "Gebundene Lebensversicherungen können als Amortisation dienen.",
    ],
  },
  pension: {
    icon: Landmark,
    intro: "Sparverhalten und Vorsorge – zeigt Disziplin und künftige Eigenmittel.",
    examples: [
      "3a-Einzahlung pro Jahr",
      "Sparplan / Fondssparen",
      "Pensionskassen-Einkauf",
    ],
    tips: [
      "Guthaben, das bereits unter «Vermögen» steht, hier nicht nochmals als Betrag erfassen.",
      "Sparraten monatlich erfassen – sie zeigen die Sparfähigkeit.",
    ],
    warn: "Doppelzählung Vorsorge/Vermögen vermeiden.",
  },
};

function HelpPanel({ area }: { area: FinanceArea }) {
  const h = helpContent[area];
  const Icon = h.icon;
  return (
    <aside className="h-fit space-y-4 rounded-xl border bg-muted/40 p-4 lg:sticky lg:top-2">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">{areaLabels[area]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{h.intro}</p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Typische Positionen
        </p>
        <ul className="mt-1.5 space-y-1">
          {h.examples.map((e) => (
            <li key={e} className="flex gap-2 text-xs">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5" />
          Beratungstipps
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {h.tips.map((t) => (
            <li key={t} className="text-xs text-muted-foreground">
              {t}
            </li>
          ))}
        </ul>
      </div>

      {h.warn && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>{h.warn}</span>
        </div>
      )}
    </aside>
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
