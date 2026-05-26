import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Download, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Props = { open: boolean; onOpenChange: (o: boolean) => void };

const TERMS = [10, 15, 20, 25] as const;

export function HypoRechnerKosovoDialog({ open, onOpenChange }: Props) {
  const [clientId, setClientId] = useState<string>("");
  const [purchasePrice, setPurchasePrice] = useState<number>(270000);
  const [equityPct, setEquityPct] = useState<number>(10);
  const [interestPct, setInterestPct] = useState<number>(5.5);
  const [termYears, setTermYears] = useState<number>(20);
  const [adminPct, setAdminPct] = useState<number>(1.5);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const calc = useMemo(() => {
    const price = Math.max(0, purchasePrice || 0);
    const equity = price * (equityPct / 100);
    const principal = price - equity;
    const n = termYears * 12;
    const r = interestPct / 100 / 12;
    const monthly =
      r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
    const totalPaid = monthly * n;
    const totalInterest = totalPaid - principal;
    const adminYearly = principal * (adminPct / 100);

    const start = new Date(startDate);
    const schedule: {
      idx: number;
      date: string;
      balance: number;
      interest: number;
      principal: number;
      payment: number;
    }[] = [];
    let balance = principal;
    for (let i = 1; i <= n; i++) {
      const interest = balance * r;
      const princPart = monthly - interest;
      const next = balance - princPart;
      const d = new Date(start);
      d.setMonth(d.getMonth() + (i - 1));
      schedule.push({
        idx: i,
        date: d.toLocaleDateString("de-CH", { year: "numeric", month: "2-digit" }),
        balance: balance,
        interest,
        principal: princPart,
        payment: monthly,
      });
      balance = Math.max(0, next);
    }

    return { equity, principal, monthly, totalPaid, totalInterest, adminYearly, schedule };
  }, [purchasePrice, equityPct, interestPct, termYears, adminPct, startDate]);

  const exportCsv = () => {
    const client = clients.find((c: any) => c.id === clientId);
    const head = `Hyporechner Kosovo${client ? " - " + client.full_name : ""}\nKaufpreis;${purchasePrice}\nEigenkapital %;${equityPct}\nFinanzierter Betrag;${calc.principal.toFixed(2)}\nZinssatz %;${interestPct}\nLaufzeit Jahre;${termYears}\nMonatliche Rate;${calc.monthly.toFixed(2)}\n\n#;Datum;Restschuld;Zins;Kapital;Zahlung\n`;
    const rows = calc.schedule
      .map(
        (s) =>
          `${s.idx};${s.date};${s.balance.toFixed(2)};${s.interest.toFixed(2)};${s.principal.toFixed(2)};${s.payment.toFixed(2)}`,
      )
      .join("\n");
    const blob = new Blob([head + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hyporechner-kosovo-${termYears}j.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const client = clients.find((c: any) => c.id === clientId);
    const { data: companyRows } = await supabase
      .from("company")
      .select("name, address, postal_code, city, country, phone, email, website, logo_url")
      .limit(1);
    const company = companyRows?.[0] as any | undefined;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    // Logo
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

    // Header right
    doc.setFontSize(9);
    doc.setTextColor(100);
    if (company) {
      const lines = [
        company.name,
        [company.address].filter(Boolean).join(""),
        [company.postal_code, company.city].filter(Boolean).join(" "),
        company.phone,
        company.email,
      ].filter(Boolean) as string[];
      lines.forEach((l, i) => doc.text(l, pageW - 15, y + 4 + i * 4, { align: "right" }));
    }
    y += 25;

    doc.setTextColor(20);
    doc.setFontSize(18);
    doc.text("Hyporechner Kosovo", 15, y);
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text("Amortisationsplan für Immobilienfinanzierung", 15, y);
    y += 8;

    if (client) {
      doc.setTextColor(20);
      doc.setFontSize(11);
      doc.text(`Kunde: ${client.full_name}`, 15, y);
      y += 5;
    }
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Erstellt am ${new Date().toLocaleDateString("de-CH")}`, 15, y);
    y += 6;

    // Summary table
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
      head: [["Parameter", "Wert"]],
      body: [
        ["Kaufpreis", formatCurrency(purchasePrice)],
        [`Eigenkapital (${equityPct}%)`, formatCurrency(calc.equity)],
        ["Finanzierter Betrag", formatCurrency(calc.principal)],
        ["Zinssatz p.a.", `${interestPct}%`],
        ["Laufzeit", `${termYears} Jahre (${termYears * 12} Monate)`],
        ["Verwaltungskosten p.a.", formatCurrency(calc.adminYearly)],
        ["Monatliche Rate", formatCurrency(calc.monthly)],
        ["Gesamtzinsen", formatCurrency(calc.totalInterest)],
        ["Total Rückzahlung", formatCurrency(calc.totalPaid)],
      ],
    });

    // Amortization table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 30, 30] },
      head: [["#", "Datum", "Restschuld", "Zins", "Kapital", "Zahlung"]],
      body: calc.schedule.map((s) => [
        String(s.idx),
        s.date,
        formatCurrency(s.balance),
        formatCurrency(s.interest),
        formatCurrency(s.principal),
        formatCurrency(s.payment),
      ]),
      columnStyles: {
        0: { halign: "right", cellWidth: 12 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
    });

    // Footer page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Seite ${i} / ${pageCount}`,
        pageW - 15,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" },
      );
    }

    const fname = `hyporechner-kosovo-${client?.full_name?.replace(/\s+/g, "_") ?? "kunde"}-${termYears}j.pdf`;
    doc.save(fname);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Hyporechner Kosovo
          </DialogTitle>
          <DialogDescription>
            Amortisationsplan für Immobilienfinanzierung im Kosovo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label>Kunde (optional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Kunde auswählen…" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kaufpreis (€)</Label>
              <Input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Eigenkapital (%)</Label>
                <Input
                  type="number" step="0.1"
                  value={equityPct}
                  onChange={(e) => setEquityPct(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Zinssatz p.a. (%)</Label>
                <Input
                  type="number" step="0.01"
                  value={interestPct}
                  onChange={(e) => setInterestPct(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Laufzeit</Label>
                <Select value={String(termYears)} onValueChange={(v) => setTermYears(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TERMS.map((t) => (
                      <SelectItem key={t} value={String(t)}>{t} Jahre</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Verwaltungskosten p.a. (%)</Label>
                <Input
                  type="number" step="0.1"
                  value={adminPct}
                  onChange={(e) => setAdminPct(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <Label>Datum der ersten Zahlung</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Card>
              <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                <KV label="Eigenkapital" value={formatCurrency(calc.equity)} />
                <KV label="Finanzierter Betrag" value={formatCurrency(calc.principal)} />
                <KV label="Monatliche Rate" value={formatCurrency(calc.monthly)} highlight />
                <KV label="Verwaltung p.a." value={formatCurrency(calc.adminYearly)} />
                <KV label="Gesamtzinsen" value={formatCurrency(calc.totalInterest)} />
                <KV label="Total Rückzahlung" value={formatCurrency(calc.totalPaid)} />
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={exportPdf}>
                <FileText className="mr-2 h-4 w-4" /> PDF für Kunde
              </Button>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 mt-2">
          <p className="text-sm font-medium mb-2">Amortisationsplan ({calc.schedule.length} Monate)</p>
          <ScrollArea className="h-[280px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Restschuld</TableHead>
                  <TableHead className="text-right">Zins</TableHead>
                  <TableHead className="text-right">Kapital</TableHead>
                  <TableHead className="text-right">Zahlung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.schedule.map((s) => (
                  <TableRow key={s.idx}>
                    <TableCell>{s.idx}</TableCell>
                    <TableCell>{s.date}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.balance)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.interest)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.principal)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(s.payment)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schliessen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KV({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? "text-lg font-bold text-primary" : "font-semibold"}>{value}</p>
    </div>
  );
}
