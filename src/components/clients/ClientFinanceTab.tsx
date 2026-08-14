import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Upload,
  Send,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CreditCard,
  Landmark,
  ShieldCheck,
  ChevronDown,
  Home,
} from "lucide-react";
import {
  calculateBenchmark,
  expenseFields,
  expenseLabels,
  formatCHF,
  incomeFields,
  incomeLabels,
} from "@/lib/self-disclosure";
import {
  areaLabels,
  byArea,
  completeness,
  completenessLabels,
  formatDateCH,
  monthlyAmount,
  numeric,
  pensionAssetCategories,
  periodicityLabels,
  personScopeLabels,
  scopeBreakdown,
  sourceLabels,
  sumAmount,
  sumMonthly,
  type FinanceArea,
  type FinanceItem,
} from "@/lib/client-finance";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";
import { ClientSelfDisclosureWizard } from "@/components/clients/ClientSelfDisclosureWizard";
import { SelfDisclosureLinkCard } from "@/components/clients/SelfDisclosureLinkCard";
import { FinanceItemDialog } from "@/components/clients/FinanceItemDialog";

type Row = Record<string, any> | null;

const num = numeric;

export function ClientFinanceTab({
  clientId,
  clientEmail,
  userId,
}: {
  clientId: string;
  clientEmail?: string | null;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [itemDialog, setItemDialog] = useState<{
    area: FinanceArea;
    item: FinanceItem | null;
  } | null>(null);

  const { data: disclosure, isLoading } = useQuery<Row>({
    queryKey: ["client_self_disclosure", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_self_disclosures")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Row;
    },
  });

  const { data: dossier } = useQuery<Row>({
    queryKey: ["client_finance_dossier", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers")
        .select("*")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Row;
    },
  });

  const { data: items = [] } = useQuery<FinanceItem[]>({
    queryKey: ["client_financial_items", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_items")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FinanceItem[];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["self_disclosure_links", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_links")
        .select("*")
        .eq("client_id", clientId)
        .eq("link_type", "self_disclosure")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Familien-/Partnerdaten referenzieren (keine zweite Partnerverwaltung)
  const { data: family = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["client_finance_family", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_relationships")
        .select(
          "client_id, related_client_id, related:clients!client_relationships_related_client_id_fkey(id, full_name), owner:clients!client_relationships_client_id_fkey(id, full_name)",
        )
        .or(`client_id.eq.${clientId},related_client_id.eq.${clientId}`);
      if (error) throw error;
      const out: { id: string; name: string }[] = [];
      const seen = new Set<string>();
      for (const row of (data ?? []) as any[]) {
        const other = row.client_id === clientId ? row.related : row.owner;
        if (!other || other.id === clientId || seen.has(other.id)) continue;
        seen.add(other.id);
        out.push({ id: other.id, name: other.full_name ?? "Unbenannt" });
      }
      return out;
    },
  });

  // Immobilienvermögen nur referenzieren
  const { data: ownedProperties = [] } = useQuery<any[]>({
    queryKey: ["client_finance_properties", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_ownerships")
        .select("id, share_percent, property:properties(id, title, price, address, city)")
        .eq("client_id", clientId);
      if (error) return [];
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_financial_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_financial_items", clientId] });
      toast.success("Position gelöscht");
    },
    onError: (e: any) => toast.error(e?.message ?? "Löschen fehlgeschlagen"),
  });

  const activeLink = (links as any[]).find(
    (l) => !l.used_at && new Date(l.expires_at) > new Date(),
  );
  const submitted =
    !!disclosure?.submitted_at || (links as any[]).some((l) => l.used_at);

  const benchmark = useMemo(
    () => calculateBenchmark((disclosure ?? {}) as any),
    [disclosure],
  );

  const ownFundsParts = [
    ["own_funds_liquid", "Liquide Mittel"],
    ["own_funds_pillar_3a", "Säule 3a"],
    ["own_funds_pension_fund", "Pensionskasse"],
    ["own_funds_vested_benefits", "Freizügigkeitsguthaben"],
    ["own_funds_gift", "Schenkung"],
    ["own_funds_inheritance", "Erbvorbezug"],
    ["own_funds_private_loan", "Privatdarlehen"],
  ] as const;

  const incomeItems = byArea(items, "income");
  const expenseItems = byArea(items, "expense");
  const assetItems = byArea(items, "asset");
  const liabilityItems = byArea(items, "liability");
  const insuranceItems = byArea(items, "insurance");
  const pensionItems = byArea(items, "pension");

  // Einnahmen/Ausgaben: Selbstauskunft + zusätzlich erfasste Positionen
  const totalIncome = benchmark.totalIncome + sumMonthly(incomeItems);
  const insuranceMonthly = sumMonthly(insuranceItems);
  const liabilityMonthly = sumMonthly(liabilityItems);
  const totalExpenses =
    benchmark.totalExpenses +
    sumMonthly(expenseItems) +
    insuranceMonthly +
    liabilityMonthly;
  const freeBudget = totalIncome - totalExpenses;

  const dossierOwnFunds =
    num(dossier?.own_funds_total) ||
    ownFundsParts.reduce((s, [k]) => s + num(dossier?.[k]), 0);

  // Vorsorge, die bereits unter Vermögen geführt wird, nicht doppelt zählen
  const assetsTotalRaw = sumAmount(assetItems);
  const pensionInAssets = sumAmount(
    assetItems.filter((i) => pensionAssetCategories.has(i.category)),
  );
  const pensionItemsTotal = sumAmount(
    pensionItems.filter((i) => i.periodicity === "once"),
  );
  const assetsTotal = dossierOwnFunds + assetsTotalRaw;

  const hardEquityDossier =
    num(dossier?.own_funds_liquid) +
    num(dossier?.own_funds_pillar_3a) +
    num(dossier?.own_funds_gift) +
    num(dossier?.own_funds_inheritance);
  const equityFromItems = assetItems.reduce(
    (s, i) => s + num(i.available_as_equity),
    0,
  );
  const availableEquity = hardEquityDossier + equityFromItems;

  const obligationsBase =
    num(dossier?.monthly_obligations) ||
    num(disclosure?.leasing_expense) + num(disclosure?.credit_expense);
  const obligations = obligationsBase + liabilityMonthly;

  const disclosureInsuranceFields = [
    "health_insurance_expense",
    "life_insurance_expense",
    "property_insurance_expense",
  ] as const;
  const disclosureInsuranceTotal = disclosureInsuranceFields.reduce(
    (s, f) => s + num(disclosure?.[f]),
    0,
  );

  const hasDisclosureIncome = incomeFields.some((f) => num(disclosure?.[f]) > 0);
  const hasDisclosureExpenses = expenseFields.some(
    (f) => num(disclosure?.[f]) > 0,
  );

  const status = completeness({
    income: hasDisclosureIncome || incomeItems.length > 0,
    expenses: hasDisclosureExpenses || expenseItems.length > 0,
    assets: assetItems.length > 0 || dossierOwnFunds > 0,
    liabilities: liabilityItems.length > 0 || obligationsBase > 0,
    insurances: insuranceItems.length > 0 || disclosureInsuranceTotal > 0,
    pension:
      pensionItems.length > 0 ||
      num(dossier?.own_funds_pillar_3a) + num(dossier?.own_funds_pension_fund) >
        0,
  });

  const lastUpdated = useMemo(() => {
    const dates = [
      disclosure?.updated_at,
      dossier?.updated_at,
      ...items.map((i) => i.updated_at),
    ].filter(Boolean) as string[];
    if (!dates.length) return null;
    return dates.sort().at(-1) as string;
  }, [disclosure, dossier, items]);

  const householdIncome = useMemo(
    () => scopeBreakdown(incomeItems),
    [incomeItems],
  );

  const hasData =
    !!disclosure?.id || !!dossier || items.length > 0;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }

  const openItem = (area: FinanceArea, item: FinanceItem | null = null) =>
    setItemDialog({ area, item });

  const sectionProps = (area: FinanceArea) => ({
    onAdd: () => openItem(area),
  });

  const renderItems = (list: FinanceItem[], area: FinanceArea) =>
    list.length ? (
      <div className="mt-3 space-y-2">
        {list.map((i) => (
          <div
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span className="truncate">{i.label || i.category}</span>
                {i.label && (
                  <Badge variant="outline" className="text-[10px]">
                    {i.category}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {personScopeLabels[i.person_scope]}
                </Badge>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {periodicityLabels[i.periodicity]}
                {i.details?.provider ? ` · ${i.details.provider}` : ""}
                {i.details?.policy_number ? ` · Police ${i.details.policy_number}` : ""}
                {i.details?.remaining_debt
                  ? ` · Restschuld ${formatCHF(Number(i.details.remaining_debt))}`
                  : ""}
                {i.details?.interest_rate ? ` · ${i.details.interest_rate}%` : ""}
                {` · ${sourceLabels[i.source] ?? "Manuell erfasst"}`}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="tabular-nums text-sm font-semibold">
                {formatCHF(num(i.amount))}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openItem(area, i)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => del.mutate(i.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-xs text-muted-foreground">
        Noch keine Positionen erfasst.
      </p>
    );

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">Finanzen</h2>
          <p className="text-sm text-muted-foreground">
            Finanzielle 360°-Sicht dieses Kunden
            {lastUpdated ? ` · Zuletzt aktualisiert: ${formatDateCH(lastUpdated)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {submitted ? (
            <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">
              Vom Kunden ausgefüllt
            </Badge>
          ) : activeLink ? (
            <Badge variant="outline">Selbstauskunft offen</Badge>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Finanzdaten erfassen
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setWizardOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Manuell erfassen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setLinkOpen(true)}>
                <Send className="mr-2 h-4 w-4" />
                Selbstauskunft senden
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setWizardOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                PDF importieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Wallet className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">
                Finanzübersicht
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Noch keine Finanzdaten vorhanden. Erfassen Sie die finanzielle
                Situation des Kunden manuell, lassen Sie die Daten direkt vom
                Kunden ausfüllen oder importieren Sie eine bestehende
                Selbstauskunft.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Finanzdaten erfassen
              </Button>
              <Button variant="outline" onClick={() => setLinkOpen(true)}>
                <Send className="mr-2 h-4 w-4" />
                Selbstauskunft senden
              </Button>
              <Button variant="outline" onClick={() => setWizardOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                PDF importieren
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Vollständigkeit */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Finanzprofil</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {status.percent}% vollständig
                </span>
              </div>
              <Progress value={status.percent} className="mt-2 h-2" />
              {status.missing.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Fehlt noch:{" "}
                  {status.missing.map((m) => completenessLabels[m]).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={TrendingUp} label="Einnahmen / Mt." value={totalIncome} tone="text-emerald-600 dark:text-emerald-400" />
            <Kpi icon={TrendingDown} label="Ausgaben / Mt." value={totalExpenses} tone="text-rose-600 dark:text-rose-400" />
            <Kpi icon={Wallet} label="Freies Budget" value={freeBudget} />
            <Kpi icon={Landmark} label="Vermögen" value={assetsTotal} />
            <Kpi icon={CreditCard} label="Verpflichtungen / Mt." value={obligations} />
            <Kpi icon={PiggyBank} label="Verfügbare Eigenmittel" value={availableEquity} />
          </div>

          {/* Cashflow */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 text-sm font-semibold">Monatlicher Cashflow</div>
              <div className="space-y-2 text-sm">
                <CashRow label="Einnahmen" value={totalIncome} bar={100} tone="bg-emerald-500" />
                <CashRow
                  label="Ausgaben"
                  value={totalExpenses}
                  bar={totalIncome > 0 ? Math.min(100, (totalExpenses / totalIncome) * 100) : 0}
                  tone="bg-rose-500"
                />
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>Verfügbares Budget</span>
                  <span className="tabular-nums">{formatCHF(freeBudget)}</span>
                </div>
              </div>
              {(householdIncome.partner > 0 || householdIncome.joint > 0) && (
                <div className="mt-3 grid gap-2 border-t pt-3 text-xs sm:grid-cols-3">
                  <Item label="Hauptkunde" value={formatCHF(householdIncome.main)} />
                  <Item label="Partner/in" value={formatCHF(householdIncome.partner)} />
                  <Item label="Gemeinsam" value={formatCHF(householdIncome.joint)} />
                </div>
              )}
            </CardContent>
          </Card>

          <BenchmarkCard benchmark={benchmark} />
        </>
      )}

      {/* Finanzbereiche */}
      <Accordion type="multiple" className="w-full space-y-2">
        <Section value="income" title={areaLabels.income} right={formatCHF(totalIncome)} {...sectionProps("income")}>
          <Grid>
            {incomeFields.map((f) => (
              <Item key={f} label={incomeLabels[f]} value={formatCHF(disclosure?.[f])} />
            ))}
            <Item label="Jahresgehalt netto" value={formatCHF(disclosure?.annual_net_salary)} />
            <Item label="Arbeitgeber" value={disclosure?.employer_name || "—"} />
          </Grid>
          {renderItems(incomeItems, "income")}
        </Section>

        <Section value="expenses" title={areaLabels.expense} right={formatCHF(totalExpenses)} {...sectionProps("expense")}>
          <Grid>
            {expenseFields.map((f) => (
              <Item key={f} label={expenseLabels[f]} value={formatCHF(disclosure?.[f])} />
            ))}
            <Item label="Versicherungen (erfasst)" value={formatCHF(insuranceMonthly)} />
            <Item label="Kredite / Leasing (erfasst)" value={formatCHF(liabilityMonthly)} />
            <Item label="Freies Budget" value={formatCHF(freeBudget)} />
          </Grid>
          {renderItems(expenseItems, "expense")}
        </Section>

        <Section value="assets" title={areaLabels.asset} right={formatCHF(assetsTotal)} {...sectionProps("asset")}>
          <Grid>
            {ownFundsParts.map(([k, label]) => (
              <Item key={k} label={label} value={formatCHF(dossier?.[k])} />
            ))}
            <Item label="Verfügbare Eigenmittel" value={formatCHF(availableEquity)} />
          </Grid>
          {renderItems(assetItems, "asset")}
        </Section>

        <Section value="liabilities" title={areaLabels.liability} right={formatCHF(obligations)} {...sectionProps("liability")}>
          <Grid>
            <Item label="Leasing (Selbstauskunft)" value={formatCHF(disclosure?.leasing_expense)} />
            <Item label="Kredit (Selbstauskunft)" value={formatCHF(disclosure?.credit_expense)} />
            <Item label="Alimente" value={formatCHF(disclosure?.alimony_expense)} />
            <Item label="Hypothek" value={formatCHF(disclosure?.mortgage_expense)} />
            <Item label="Verpflichtungen / Mt. (Dossier)" value={formatCHF(dossier?.monthly_obligations)} />
          </Grid>
          {renderItems(liabilityItems, "liability")}
        </Section>

        <Section
          value="insurance"
          title={areaLabels.insurance}
          right={formatCHF(disclosureInsuranceTotal + insuranceMonthly)}
          {...sectionProps("insurance")}
        >
          <Grid>
            {disclosureInsuranceFields.map((f) => (
              <Item
                key={f}
                label={expenseLabels[f as keyof typeof expenseLabels]}
                value={formatCHF(disclosure?.[f])}
              />
            ))}
          </Grid>
          {renderItems(insuranceItems, "insurance")}
        </Section>

        <Section
          value="pension"
          title={areaLabels.pension}
          right={formatCHF(
            num(dossier?.own_funds_pillar_3a) +
              num(dossier?.own_funds_pension_fund) +
              num(dossier?.own_funds_vested_benefits) +
              pensionItemsTotal,
          )}
          {...sectionProps("pension")}
        >
          <Grid>
            <Item label="Säule 3a" value={formatCHF(dossier?.own_funds_pillar_3a)} />
            <Item label="Pensionskasse" value={formatCHF(dossier?.own_funds_pension_fund)} />
            <Item label="Freizügigkeitsguthaben" value={formatCHF(dossier?.own_funds_vested_benefits)} />
            <Item label="Monatliches Sparen" value={formatCHF(sumMonthly(pensionItems))} />
          </Grid>
          {pensionInAssets > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hinweis: {formatCHF(pensionInAssets)} sind bereits unter «Vermögen»
              erfasst und werden nicht doppelt gezählt.
            </p>
          )}
          {renderItems(pensionItems, "pension")}
        </Section>

        {ownedProperties.length > 0 && (
          <Section value="properties" title="Immobilienvermögen" right={String(ownedProperties.length)}>
            <div className="space-y-2">
              {ownedProperties.map((o: any) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {o.property?.title || o.property?.address || "Objekt"}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCHF(o.property?.price)}
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Details werden im Tab «Immobilien» verwaltet.
              </p>
            </div>
          </Section>
        )}
      </Accordion>

      <ClientSelfDisclosureWizard
        clientId={clientId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initial={disclosure as any}
      />

      {itemDialog && (
        <FinanceItemDialog
          open
          onOpenChange={(o) => !o && setItemDialog(null)}
          clientId={clientId}
          area={itemDialog.area}
          item={itemDialog.item}
          people={family}
        />
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Selbstauskunft senden
            </DialogTitle>
            <DialogDescription>
              Sicheren Link erstellen und dem Kunden zusenden.
            </DialogDescription>
          </DialogHeader>
          {userId && (
            <SelfDisclosureLinkCard
              clientId={clientId}
              clientEmail={clientEmail}
              userId={userId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone?: string;
}) {
  const empty = !value;
  return (
    <Card className="min-w-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span className="truncate">{label}</span>
        </div>
        <div
          className={
            "mt-1 truncate text-base font-semibold tabular-nums " +
            (empty ? "text-muted-foreground" : (tone ?? ""))
          }
        >
          {empty ? "—" : formatCHF(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function CashRow({
  label,
  value,
  bar,
  tone,
}: {
  label: string;
  value: number;
  bar: number;
  tone: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{formatCHF(value)}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={"h-full rounded-full " + tone} style={{ width: `${bar}%` }} />
      </div>
    </div>
  );
}

function Section({
  value,
  title,
  right,
  onAdd,
  children,
}: {
  value: string;
  title: string;
  right?: string;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-xl border bg-card px-4">
      <AccordionTrigger className="py-3 hover:no-underline">
        <span className="flex w-full items-center justify-between gap-3 pr-2">
          <span className="text-sm font-semibold">{title}</span>
          {right && (
            <span className="text-sm tabular-nums text-muted-foreground">{right}</span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        {children}
        {onAdd && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onAdd}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Position hinzufügen
          </Button>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Item({ label, value }: { label: string; value: any }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">
        {value && String(value).trim() !== "" ? value : "—"}
      </div>
    </div>
  );
}
