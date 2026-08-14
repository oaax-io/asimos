import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CreditCard,
  Landmark,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  calculateBenchmark,
  expenseFields,
  expenseLabels,
  formatCHF,
  incomeFields,
  incomeLabels,
} from "@/lib/self-disclosure";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";
import { ClientSelfDisclosureWizard } from "@/components/clients/ClientSelfDisclosureWizard";
import { SelfDisclosureLinkCard } from "@/components/clients/SelfDisclosureLinkCard";

type Row = Record<string, any> | null;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function ClientFinanceTab({
  clientId,
  clientEmail,
  userId,
}: {
  clientId: string;
  clientEmail?: string | null;
  userId?: string;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

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

  const ownFundsTotal =
    num(dossier?.own_funds_total) ||
    ownFundsParts.reduce((s, [k]) => s + num(dossier?.[k]), 0);
  const hardEquity =
    num(dossier?.own_funds_liquid) +
    num(dossier?.own_funds_pillar_3a) +
    num(dossier?.own_funds_gift) +
    num(dossier?.own_funds_inheritance);
  const obligations =
    num(dossier?.monthly_obligations) ||
    num(disclosure?.leasing_expense) + num(disclosure?.credit_expense);

  const insuranceFields = [
    "health_insurance_expense",
    "life_insurance_expense",
    "property_insurance_expense",
  ] as const;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }

  const hasData = !!disclosure?.id || !!dossier;

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Kopfzeile */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">Finanzen</h2>
          <p className="text-sm text-muted-foreground">
            Finanzielle 360°-Sicht dieses Kunden
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

      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Noch keine Finanzdaten erfasst. Starte mit «Finanzdaten erfassen».
          </CardContent>
        </Card>
      )}

      {/* 1. Finanzübersicht */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={TrendingUp} label="Einnahmen" value={formatCHF(benchmark.totalIncome)} tone="text-emerald-600 dark:text-emerald-400" />
        <Kpi icon={TrendingDown} label="Ausgaben" value={formatCHF(benchmark.totalExpenses)} tone="text-rose-600 dark:text-rose-400" />
        <Kpi icon={Wallet} label="Freies Budget" value={formatCHF(benchmark.reserveTotal)} />
        <Kpi icon={Landmark} label="Vermögen" value={formatCHF(ownFundsTotal)} />
        <Kpi icon={CreditCard} label="Verpflichtungen" value={formatCHF(obligations)} />
        <Kpi icon={PiggyBank} label="Eigenmittel" value={formatCHF(hardEquity)} />
      </div>

      {hasData && <BenchmarkCard benchmark={benchmark} />}

      {/* 2. Finanzbereiche */}
      <Accordion type="multiple" className="w-full space-y-2">
        <Section value="income" title="Einkommen" right={formatCHF(benchmark.totalIncome)}>
          <Grid>
            {incomeFields.map((f) => (
              <Item key={f} label={incomeLabels[f]} value={formatCHF(disclosure?.[f])} />
            ))}
            <Item label="Jahresgehalt netto" value={formatCHF(disclosure?.annual_net_salary)} />
            <Item label="Arbeitgeber" value={disclosure?.employer_name || "—"} />
          </Grid>
        </Section>

        <Section value="expenses" title="Ausgaben & Budget" right={formatCHF(benchmark.totalExpenses)}>
          <Grid>
            {expenseFields.map((f) => (
              <Item key={f} label={expenseLabels[f]} value={formatCHF(disclosure?.[f])} />
            ))}
            <Item label="Freies Budget" value={formatCHF(benchmark.reserveTotal)} />
          </Grid>
        </Section>

        <Section value="assets" title="Vermögen & Eigenmittel" right={formatCHF(ownFundsTotal)}>
          <Grid>
            {ownFundsParts.map(([k, label]) => (
              <Item key={k} label={label} value={formatCHF(dossier?.[k])} />
            ))}
            <Item label="Harte Eigenmittel" value={formatCHF(hardEquity)} />
          </Grid>
        </Section>

        <Section value="obligations" title="Verpflichtungen" right={formatCHF(obligations)}>
          <Grid>
            <Item label="Leasing" value={formatCHF(disclosure?.leasing_expense)} />
            <Item label="Kredit" value={formatCHF(disclosure?.credit_expense)} />
            <Item label="Alimente" value={formatCHF(disclosure?.alimony_expense)} />
            <Item label="Hypothek" value={formatCHF(disclosure?.mortgage_expense)} />
            <Item label="Verpflichtungen / Mt. (Dossier)" value={formatCHF(dossier?.monthly_obligations)} />
          </Grid>
        </Section>

        <Section
          value="insurance"
          title="Versicherungen"
          right={formatCHF(insuranceFields.reduce((s, f) => s + num(disclosure?.[f]), 0))}
        >
          <Grid>
            {insuranceFields.map((f) => (
              <Item key={f} label={expenseLabels[f as keyof typeof expenseLabels]} value={formatCHF(disclosure?.[f])} />
            ))}
          </Grid>
        </Section>

        <Section
          value="savings"
          title="Sparen & Vorsorge"
          right={formatCHF(
            num(dossier?.own_funds_pillar_3a) +
              num(dossier?.own_funds_pension_fund) +
              num(dossier?.own_funds_vested_benefits),
          )}
        >
          <Grid>
            <Item label="Säule 3a" value={formatCHF(dossier?.own_funds_pillar_3a)} />
            <Item label="Pensionskasse" value={formatCHF(dossier?.own_funds_pension_fund)} />
            <Item label="Freizügigkeitsguthaben" value={formatCHF(dossier?.own_funds_vested_benefits)} />
            <Item label="Monatliche Reserve" value={formatCHF(benchmark.reserveTotal)} />
          </Grid>
        </Section>
      </Accordion>

      <ClientSelfDisclosureWizard
        clientId={clientId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initial={disclosure as any}
      />

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
  value: string;
  tone?: string;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span className="truncate">{label}</span>
        </div>
        <div className={"mt-1 truncate text-base font-semibold tabular-nums " + (tone ?? "")}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  value,
  title,
  right,
  children,
}: {
  value: string;
  title: string;
  right?: string;
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
      <AccordionContent className="pb-4">{children}</AccordionContent>
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
