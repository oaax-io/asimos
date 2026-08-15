import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, Download, Info, Wallet, Percent, TrendingUp, Home, Calculator,
  ShieldCheck, ArrowDownUp, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

export function HypoRechnerSchweizDialog({ open, onOpenChange }: Props) {
  const [clientId, setClientId] = useState<string>("");
  const [purchasePrice, setPurchasePrice] = useState<number>(1000000);
  const [equity, setEquity] = useState<number>(200000);
  const [pkEquity, setPkEquity] = useState<number>(0);
  const [interestPct, setInterestPct] = useState<number>(1.6);
  const [calcInterestPct, setCalcInterestPct] = useState<number>(5);
  const [maintenancePct, setMaintenancePct] = useState<number>(1);
  const [amortYears, setAmortYears] = useState<number>(15);
  const [grossIncome, setGrossIncome] = useState<number>(180000);
  const [amortMode, setAmortMode] = useState<"direct" | "indirect">("direct");
  const [taxRatePct, setTaxRatePct] = useState<number>(30);
  const [policyReturnPct, setPolicyReturnPct] = useState<number>(1.5);
  const [policyCostPct, setPolicyCostPct] = useState<number>(0.4);

  const { data: clients = [] } = useQuery({
    queryKey: ["hypo-ch-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").order("full_name");
      return data ?? [];
    },
    enabled: open,
  });

  const calc = useMemo(() => {
    const price = Math.max(0, purchasePrice || 0);
    const eq = Math.max(0, equity || 0);
    const hardEquity = Math.max(0, eq - Math.max(0, pkEquity || 0));
    const loan = Math.max(0, price - eq);
    const ltv = price > 0 ? (loan / price) * 100 : 0;
    const firstMax = price * (2 / 3);
    const firstMortgage = Math.min(loan, firstMax);
    const secondMortgage = Math.max(0, loan - firstMortgage);
    const amortYearly = amortYears > 0 ? secondMortgage / amortYears : 0;

    const interestYearly = loan * (interestPct / 100);
    const calcInterestYearly = loan * (calcInterestPct / 100);
    const maintenanceYearly = price * (maintenancePct / 100);
    const costsYearly = calcInterestYearly + maintenanceYearly + amortYearly;
    const affordabilityPct = grossIncome > 0 ? (costsYearly / grossIncome) * 100 : 999;
    const effectiveYearly = interestYearly + maintenanceYearly + amortYearly;

    const equityOk = eq >= price * 0.2 && hardEquity >= price * 0.1;
    const affordable = affordabilityPct <= 33;

    const requiredIncome = costsYearly / 0.33;

    return {
      price, eq, hardEquity, loan, ltv, firstMortgage, secondMortgage, amortYearly,
      interestYearly, calcInterestYearly, maintenanceYearly, costsYearly,
      affordabilityPct, effectiveYearly, equityOk, affordable, requiredIncome,
    };
  }, [purchasePrice, equity, pkEquity, interestPct, calcInterestPct, maintenancePct, amortYears, grossIncome]);

  // Vergleich direkte vs. indirekte Amortisation über die Amortisationsdauer
  const amort = useMemo(() => {
    const years = Math.max(1, Math.round(amortYears || 1));
    const rate = interestPct / 100;
    const tax = Math.min(60, Math.max(0, taxRatePct)) / 100;
    const netReturn = (policyReturnPct - policyCostPct) / 100;
    const yearly = calc.amortYearly;
    const loan = calc.loan;

    // Direkt: Hypothek sinkt jährlich
    let directInterest = 0;
    for (let i = 0; i < years; i++) directInterest += (loan - yearly * i) * rate;
    const directTaxSaving = directInterest * tax;
    const directNet = directInterest - directTaxSaving;
    const directDebtEnd = loan - yearly * years;

    // Indirekt: Hypothek bleibt konstant, Sparen in Police (Säule 3a / 3b)
    const indirectInterest = loan * rate * years;
    const indirectInterestTaxSaving = indirectInterest * tax;
    const contribTotal = yearly * years;
    const contribTaxSaving = contribTotal * tax; // nur bei Säule 3a abzugsfähig
    // Endwert der Police (nachschüssige Rente)
    const policyEnd = netReturn === 0
      ? contribTotal
      : contribTotal > 0 ? yearly * ((Math.pow(1 + netReturn, years) - 1) / netReturn) : 0;
    const policyGain = policyEnd - contribTotal;
    const payoutTax = policyEnd * 0.05; // pauschale Kapitalauszahlungssteuer ca. 5%
    const indirectNet = indirectInterest + contribTotal
      - indirectInterestTaxSaving - contribTaxSaving - policyEnd + payoutTax;
    const indirectDebtEnd = loan;

    const advantage = directNet - indirectNet; // > 0 = indirekt günstiger
    return {
      years, yearly, directInterest, directTaxSaving, directNet, directDebtEnd,
      indirectInterest, indirectInterestTaxSaving, contribTotal, contribTaxSaving,
      policyEnd, policyGain, payoutTax, indirectNet, indirectDebtEnd, advantage,
      monthlyDirect: (loan * rate + calc.maintenanceYearly + yearly) / 12,
      monthlyIndirect: (loan * rate + calc.maintenanceYearly + yearly) / 12,
    };
  }, [amortYears, interestPct, taxRatePct, policyReturnPct, policyCostPct, calc]);

  const compareRows: [string, string, string][] = [
    ["Hypothek während Laufzeit", "sinkend", "konstant"],
    ["Zinskosten total", formatCurrency(amort.directInterest), formatCurrency(amort.indirectInterest)],
    ["Steuerersparnis Schuldzinsen", formatCurrency(amort.directTaxSaving), formatCurrency(amort.indirectInterestTaxSaving)],
    ["Steuerersparnis Einzahlungen 3a", formatCurrency(0), formatCurrency(amort.contribTaxSaving)],
    ["Einzahlungen total", formatCurrency(amort.yearly * amort.years), formatCurrency(amort.contribTotal)],
    ["Guthaben Police am Ende", "—", formatCurrency(amort.policyEnd)],
    ["davon Zinsertrag Police", "—", formatCurrency(amort.policyGain)],
    ["Kapitalauszahlungssteuer (ca. 5%)", "—", `- ${formatCurrency(amort.payoutTax)}`],
    ["Restschuld nach Laufzeit", formatCurrency(Math.max(0, amort.directDebtEnd)), formatCurrency(amort.indirectDebtEnd)],
    ["Nettokosten total", formatCurrency(amort.directNet), formatCurrency(amort.indirectNet)],
  ];

  const prosCons = {
    direct: {
      pro: [
        "Schuld sinkt laufend – tiefere Zinskosten",
        "Einfach und transparent, keine Zusatzverträge",
        "Höhere Sicherheit bei steigenden Zinsen",
        "Keine Bindung an Versicherung oder Bank-Sparkonto",
      ],
      con: [
        "Steuerlich ungünstig: Schuldzinsabzug sinkt jedes Jahr",
        "Keine Steuerersparnis durch Säule-3a-Abzug",
        "Kein zusätzliches Vorsorgekapital",
        "Einbezahltes Geld ist gebunden (nicht flexibel verfügbar)",
      ],
    },
    indirect: {
      pro: [
        "Voller Schuldzinsabzug bleibt über die ganze Laufzeit erhalten",
        "Einzahlungen in Säule 3a sind vom Einkommen abziehbar",
        "Aufbau von Vorsorgekapital, oft mit Todesfall-/Erwerbsunfähigkeitsschutz",
        "Kapital kann später flexibel für Amortisation oder Vorsorge genutzt werden",
      ],
      con: [
        "Hypothek und damit Zinskosten bleiben während der Laufzeit hoch",
        "Vertragsbindung an Versicherung, Rückkaufswerte in den ersten Jahren tief",
        "Abschluss- und Verwaltungskosten schmälern die Rendite",
        "Kapitalauszahlungssteuer bei Bezug, 3a-Maximalbetrag begrenzt die Einzahlung",
      ],
    },
  };

  const status: "ok" | "tight" | "not_ok" =
    !calc.equityOk || calc.affordabilityPct > 40 ? "not_ok"
      : calc.affordabilityPct > 33 ? "tight" : "ok";

  const rows: [string, string][] = [
    ["Kaufpreis", formatCurrency(calc.price)],
    ["Eigenmittel total", formatCurrency(calc.eq)],
    ["davon harte Eigenmittel", formatCurrency(calc.hardEquity)],
    ["davon Pensionskasse (2. Säule)", formatCurrency(Math.max(0, pkEquity || 0))],
    ["Hypothek total", formatCurrency(calc.loan)],
    ["Belehnung", `${calc.ltv.toFixed(1)}%`],
    ["1. Hypothek (max. 66.67%)", formatCurrency(calc.firstMortgage)],
    ["2. Hypothek", formatCurrency(calc.secondMortgage)],
    [`Amortisation p.a. (${amortYears} Jahre)`, formatCurrency(calc.amortYearly)],
    ["Amortisationsart", amortMode === "direct" ? "Direkt (Hypothek sinkt)" : "Indirekt (über Versicherung / Säule 3a)"],
    [`Zins effektiv p.a. (${interestPct}%)`, formatCurrency(calc.interestYearly)],
    [`Kalkulatorischer Zins p.a. (${calcInterestPct}%)`, formatCurrency(calc.calcInterestYearly)],
    [`Nebenkosten/Unterhalt p.a. (${maintenancePct}%)`, formatCurrency(calc.maintenanceYearly)],
    ["Kalkulatorische Kosten p.a.", formatCurrency(calc.costsYearly)],
    ["Effektive Kosten p.a.", formatCurrency(calc.effectiveYearly)],
    ["Effektive Kosten p.M.", formatCurrency(calc.effectiveYearly / 12)],
    ["Tragbarkeit", `${calc.affordabilityPct.toFixed(1)}% (max. 33%)`],
    ["Benötigtes Bruttoeinkommen", formatCurrency(calc.requiredIncome)],
  ];

  const exportPdf = async () => {
    try {
      const client = clients.find((c: any) => c.id === clientId);
      const { data: companyRows } = await supabase
        .from("company")
        .select("name, address, postal_code, city, phone, email, logo_url")
        .limit(1);
      const company = companyRows?.[0] as any | undefined;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 15;

      if (company?.logo_url) {
        try {
          const res = await fetch(company.logo_url);
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.readAsDataURL(blob);
          });
          doc.addImage(dataUrl, "PNG", 15, y, 30, 15, undefined, "FAST");
        } catch { /* ignore */ }
      }

      doc.setFontSize(9);
      doc.setTextColor(100);
      if (company) {
        const lines = [
          company.name,
          company.address,
          [company.postal_code, company.city].filter(Boolean).join(" "),
          company.phone,
          company.email,
        ].filter(Boolean) as string[];
        lines.forEach((l, i) => doc.text(String(l), pageW - 15, y + 4 + i * 4, { align: "right" }));
      }
      y += 25;

      doc.setTextColor(20);
      doc.setFontSize(18);
      doc.text("Hyporechner Schweiz", 15, y);
      y += 6;
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text("Tragbarkeits- und Belehnungsrechnung", 15, y);
      y += 8;
      if (client) {
        doc.setTextColor(20);
        doc.text(`Kunde: ${client.full_name}`, 15, y);
        y += 5;
      }
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Erstellt am ${new Date().toLocaleDateString("de-CH")}`, 15, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [111, 107, 148] },
        head: [["Parameter", "Wert"]],
        body: rows,
      });

      const endY = (doc as any).lastAutoTable?.finalY ?? y;
      doc.setFontSize(10);
      doc.setTextColor(20);
      doc.text(
        status === "ok" ? "Ergebnis: Tragbar (Richtwerte erfüllt)"
          : status === "tight" ? "Ergebnis: Grenzwertig – Tragbarkeit über 33%"
            : "Ergebnis: Nicht tragbar / Eigenmittel ungenügend",
        15, endY + 10,
      );
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text(
        "Richtwerte Schweiz: min. 20% Eigenmittel (davon min. 10% hart), Belehnung über 66.67% in 15 Jahren amortisieren, kalk. Zins 5%, Nebenkosten 1%.",
        15, endY + 18, { maxWidth: pageW - 30 },
      );

      doc.save(`hyporechner-schweiz-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF-Export fehlgeschlagen");
    }
  };

  const statusConfig = {
    ok: {
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
      label: "Tragbar – Richtwerte erfüllt",
    },
    tight: {
      icon: Info,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
      label: "Grenzwertig – Tragbarkeit über 33%",
    },
    not_ok: {
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-200 dark:border-red-800",
      label: "Nicht tragbar bzw. Eigenmittel ungenügend",
    },
  } as const;
  const sc = statusConfig[status];
  const StatusIcon = sc.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col gap-0 p-0">
        {/* Header band */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-[#6F6B94] to-[#4C487A] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl text-white">Hyporechner Schweiz</DialogTitle>
              <DialogDescription className="text-white/70">
                Belehnung, Amortisation und Tragbarkeit nach Schweizer Bankenstandard
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* --- Section: Objekt & Kunde --- */}
          <section className="space-y-3">
            <SectionLabel icon={Home} title="Objekt & Kunde" />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Kunde (optional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="bg-card"><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kaufpreis (CHF)" value={purchasePrice} onChange={setPurchasePrice} />
              <Field label="Bruttoeinkommen p.a. (CHF)" value={grossIncome} onChange={setGrossIncome} />
            </div>
          </section>

          {/* --- Section: Eigenmittel --- */}
          <section className="space-y-3">
            <SectionLabel icon={Wallet} title="Eigenmittel" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Eigenmittel total (CHF)" value={equity} onChange={setEquity} />
              <Field label="davon Pensionskasse (CHF)" value={pkEquity} onChange={setPkEquity} />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Harte Eigenmittel</Label>
                <div className="h-9 flex items-center px-3 rounded-md bg-muted/60 font-semibold text-sm">
                  {formatCurrency(calc.hardEquity)}
                </div>
              </div>
            </div>
          </section>

          {/* --- Section: Zinsen & Kosten --- */}
          <section className="space-y-3">
            <SectionLabel icon={Percent} title="Zinsen & Kosten" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Zinssatz effektiv (%)" value={interestPct} onChange={setInterestPct} step={0.05} />
              <Field label="Kalkulatorischer Zins (%)" value={calcInterestPct} onChange={setCalcInterestPct} step={0.25} />
              <Field label="Nebenkosten/Unterhalt (%)" value={maintenancePct} onChange={setMaintenancePct} step={0.1} />
              <Field label="Amortisation (Jahre)" value={amortYears} onChange={setAmortYears} step={1} />
            </div>
          </section>

          {/* --- KPI Row --- */}
          <section className="space-y-3">
            <SectionLabel icon={TrendingUp} title="Kennzahlen" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                title="Belehnung"
                value={`${calc.ltv.toFixed(1)}%`}
                hint={calc.ltv <= 80 ? "innerhalb 80%" : "über 80% – kritisch"}
                tone={calc.ltv <= 80 ? "good" : "bad"}
              />
              <Kpi
                title="1. Hypothek"
                value={formatCurrency(calc.firstMortgage)}
                hint={`max. 66.67% = ${formatCurrency(calc.price * 2 / 3)}`}
                tone="neutral"
              />
              <Kpi
                title="2. Hypothek"
                value={formatCurrency(calc.secondMortgage)}
                hint={`Amortisation ${formatCurrency(calc.amortYearly)}/Jahr`}
                tone="neutral"
              />
              <Kpi
                title="Tragbarkeit"
                value={`${calc.affordabilityPct.toFixed(1)}%`}
                hint="max. 33% des Bruttoeink."
                tone={calc.affordabilityPct <= 33 ? "good" : calc.affordabilityPct <= 40 ? "warn" : "bad"}
              />
            </div>
          </section>

          {/* --- Status Banner --- */}
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${sc.bg} ${sc.border}`}>
            <StatusIcon className={`h-5 w-5 shrink-0 mt-0.5 ${sc.color}`} />
            <div className="space-y-1.5 flex-1">
              <p className="font-semibold text-sm">{sc.label}</p>
              <p className="text-sm text-muted-foreground">
                Benötigtes Bruttoeinkommen: <span className="font-semibold text-foreground">{formatCurrency(calc.requiredIncome)}</span> p.a.
                {!calc.equityOk && " · Mind. 20% Eigenmittel, davon 10% hart (ohne PK) erforderlich."}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="font-medium">1. Hyp. {formatCurrency(calc.firstMortgage)}</Badge>
                <Badge variant="secondary" className="font-medium">2. Hyp. {formatCurrency(calc.secondMortgage)}</Badge>
                <Badge variant="outline" className="font-medium">Harte EM {formatCurrency(calc.hardEquity)}</Badge>
                <Badge variant="outline" className="font-medium">Hypothek total {formatCurrency(calc.loan)}</Badge>
              </div>
            </div>
          </div>

          {/* --- Detail-Tabelle --- */}
          <section className="space-y-2">
            <SectionLabel icon={Calculator} title="Detailberechnung" />
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 border-b">
                    <th className="text-left font-medium px-3 py-2">Parameter</th>
                    <th className="text-right font-medium px-3 py-2">Wert</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([k, v], i) => (
                    <tr key={k} className={i % 2 === 0 ? "bg-transparent" : "bg-muted/30"}>
                      <td className="px-3 py-1.5 text-muted-foreground">{k}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground px-1 pt-1">
              Richtwerte Schweiz: min. 20% Eigenmittel (davon min. 10% hart), Belehnung über 66.67% in 15 Jahren amortisieren,
              kalk. Zins 5%, Nebenkosten 1%.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between gap-2 shrink-0">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Kosten p.M. effektiv: <span className="font-semibold text-foreground">{formatCurrency(calc.effectiveYearly / 12)}</span>
          </p>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Schliessen</Button>
            <Button onClick={exportPdf} className="bg-[#6F6B94] hover:bg-[#5a5790] text-white">
              <Download className="mr-2 h-4 w-4" />PDF exportieren
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-[#6F6B94]" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({ label, value, onChange, step = 1000 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-card"
      />
    </div>
  );
}

function Kpi({ title, value, hint, tone }: { title: string; value: string; hint?: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const toneClass = {
    good: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
    warn: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
    bad: "border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
    neutral: "border-l-[#6F6B94] bg-muted/40",
  }[tone];
  return (
    <div className={`border border-l-4 rounded-lg p-3 space-y-0.5 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{title}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
