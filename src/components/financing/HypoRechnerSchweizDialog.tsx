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
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Download, Info } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Hyporechner Schweiz</DialogTitle>
          <DialogDescription>
            Belehnung, Amortisation und Tragbarkeit nach Schweizer Bankenstandard.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Kunde (optional)</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Kaufpreis (CHF)" value={purchasePrice} onChange={setPurchasePrice} />
              <Field label="Eigenmittel total (CHF)" value={equity} onChange={setEquity} />
              <Field label="davon Pensionskasse (CHF)" value={pkEquity} onChange={setPkEquity} />
              <Field label="Bruttoeinkommen p.a. (CHF)" value={grossIncome} onChange={setGrossIncome} />
              <Field label="Zinssatz effektiv (%)" value={interestPct} onChange={setInterestPct} step={0.05} />
              <Field label="Kalkulatorischer Zins (%)" value={calcInterestPct} onChange={setCalcInterestPct} step={0.25} />
              <Field label="Nebenkosten/Unterhalt (%)" value={maintenancePct} onChange={setMaintenancePct} step={0.1} />
              <Field label="Amortisationsdauer (Jahre)" value={amortYears} onChange={setAmortYears} step={1} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi title="Belehnung" value={`${calc.ltv.toFixed(1)}%`} hint={calc.ltv <= 80 ? "innerhalb 80%" : "über 80% – nicht finanzierbar"} />
              <Kpi title="Kosten p.M. (effektiv)" value={formatCurrency(calc.effectiveYearly / 12)} hint={`Amortisation ${formatCurrency(calc.amortYearly / 12)}/Mt.`} />
              <Kpi title="Tragbarkeit" value={`${calc.affordabilityPct.toFixed(1)}%`} hint="max. 33% des Bruttoeinkommens" />
            </div>

            <Card className={
              status === "ok" ? "border-emerald-500/40 bg-emerald-500/5"
                : status === "tight" ? "border-amber-500/40 bg-amber-500/5"
                  : "border-destructive/40 bg-destructive/5"
            }>
              <CardContent className="flex items-start gap-3 p-4 text-sm">
                {status === "ok" ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  : status === "tight" ? <Info className="h-5 w-5 text-amber-600 shrink-0" />
                    : <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
                <div className="space-y-1">
                  <p className="font-medium">
                    {status === "ok" ? "Tragbar – Richtwerte erfüllt"
                      : status === "tight" ? "Grenzwertig – Tragbarkeit über 33%"
                        : "Nicht tragbar bzw. Eigenmittel ungenügend"}
                  </p>
                  <p className="text-muted-foreground">
                    Benötigtes Bruttoeinkommen: {formatCurrency(calc.requiredIncome)} p.a.
                    {!calc.equityOk && " · Mind. 20% Eigenmittel, davon 10% hart (ohne PK) erforderlich."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline">1. Hypothek {formatCurrency(calc.firstMortgage)}</Badge>
                    <Badge variant="outline">2. Hypothek {formatCurrency(calc.secondMortgage)}</Badge>
                    <Badge variant="secondary">Harte EM {formatCurrency(calc.hardEquity)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Table>
              <TableHeader>
                <TableRow><TableHead>Parameter</TableHead><TableHead className="text-right">Wert</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell>{k}</TableCell>
                    <TableCell className="text-right font-medium">{v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schliessen</Button>
          <Button onClick={exportPdf}><Download className="mr-2 h-4 w-4" />PDF exportieren</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, step = 1000 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
