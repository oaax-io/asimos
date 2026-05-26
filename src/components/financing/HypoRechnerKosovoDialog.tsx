import { useMemo, useState, useEffect } from "react";
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

type Props = { open: boolean; onOpenChange: (o: boolean) => void; calculationId?: string | null };

const TERMS = [10, 15, 20, 25] as const;

export function HypoRechnerKosovoDialog({ open, onOpenChange, calculationId }: Props) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [purchasePrice, setPurchasePrice] = useState<number>(270000);
  const [equityPct, setEquityPct] = useState<number>(10);
  const [interestPct, setInterestPct] = useState<number>(5.5);
  const [termYears, setTermYears] = useState<number>(20);
  const [adminPct, setAdminPct] = useState<number>(1.5);
  const [label, setLabel] = useState<string>("");
  const [calcNotes, setCalcNotes] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  // Bestehende Berechnung laden
  useEffect(() => {
    if (!open || !calculationId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("hypo_calculations")
        .select("*")
        .eq("id", calculationId)
        .single();
      if (error || !data) return;
      setClientId(data.client_id ?? "");
      setPurchasePrice(Number(data.purchase_price));
      setEquityPct(Number(data.equity_pct));
      setInterestPct(Number(data.interest_pct));
      setTermYears(Number(data.term_years));
      setAdminPct(Number(data.admin_pct));
      setLabel(data.label ?? "");
      setCalcNotes(data.notes ?? "");
      if (data.start_date) setStartDate(data.start_date);
    };
    load();
  }, [open, calculationId]);

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

  // Selbstauskunft des gewählten Kunden laden (für Tragbarkeitsbewertung)
  const { data: disclosure } = useQuery({
    queryKey: ["hypo-disclosure", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase
        .from("client_self_disclosures")
        .select("total_income_monthly, total_expenses_monthly, reserve_total, salary_net_monthly, additional_income, income_job_two, income_rental")
        .eq("client_id", clientId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!clientId,
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

  // Tragbarkeits-Bewertung basierend auf Selbstauskunft des Kunden
  const affordability = useMemo(() => {
    if (!clientId) return null;
    if (!disclosure) {
      return {
        status: "no_data" as const,
        message: "Keine Selbstauskunft vorhanden. Bitte zuerst Selbstauskunft beim Kunden erfassen.",
      };
    }
    const income = Number(disclosure.total_income_monthly) || 0;
    const expenses = Number(disclosure.total_expenses_monthly) || 0;
    const reserve = Number(disclosure.reserve_total) || (income - expenses);
    const monthly = calc.monthly + calc.adminYearly / 12;
    const remaining = reserve - monthly;
    const ratio = reserve > 0 ? (monthly / reserve) * 100 : 999;

    // Max. tragbare Hypothek bei aktueller Rate für 80% der Reserve
    const maxPayment = reserve * 0.8;
    const r = interestPct / 100 / 12;
    const n = termYears * 12;
    const maxPrincipal = r > 0 ? (maxPayment * (1 - Math.pow(1 + r, -n))) / r : maxPayment * n;
    const maxPrice = maxPrincipal / (1 - equityPct / 100);

    let status: "ok" | "tight" | "not_ok" = "ok";
    if (remaining < 0) status = "not_ok";
    else if (ratio > 70) status = "tight";

    return {
      status,
      reserve,
      monthly,
      remaining,
      ratio,
      maxPrice,
      maxPrincipal,
    };
  }, [clientId, disclosure, calc.monthly, calc.adminYearly, interestPct, termYears, equityPct]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("hypo_calculations").insert({
        client_id: clientId || null,
        created_by: userData.user?.id,
        label: label || `Hyporechner ${termYears}J ${purchasePrice}€`,
        purchase_price: purchasePrice,
        equity_pct: equityPct,
        interest_pct: interestPct,
        term_years: termYears,
        admin_pct: adminPct,
        start_date: startDate,
        monthly_payment: calc.monthly,
        total_interest: calc.totalInterest,
        total_paid: calc.totalPaid,
        principal: calc.principal,
        notes: calcNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Berechnung gespeichert");
      qc.invalidateQueries({ queryKey: ["hypo_calculations"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Speichern fehlgeschlagen"),
  });

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

            {affordability && <AffordabilityCard a={affordability} />}

            <div>
              <Label>Bezeichnung (für Speicherung)</Label>
              <Input
                placeholder="z.B. Variante 20J, Szenario A"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div>
              <Label>Notizen</Label>
              <Textarea
                rows={2}
                value={calcNotes}
                onChange={(e) => setCalcNotes(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Speichert…" : "Speichern"}
              </Button>
              <Button variant="secondary" onClick={exportPdf}>
                <FileText className="mr-2 h-4 w-4" /> PDF
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

function AffordabilityCard({ a }: { a: any }) {
  if (a.status === "no_data") {
    return (
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="p-3 flex gap-2 text-sm">
          <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p>{a.message}</p>
        </CardContent>
      </Card>
    );
  }
  const tone =
    a.status === "ok"
      ? "border-emerald-500/50 bg-emerald-500/5"
      : a.status === "tight"
      ? "border-amber-500/50 bg-amber-500/5"
      : "border-red-500/50 bg-red-500/5";
  const Icon = a.status === "ok" ? CheckCircle2 : AlertTriangle;
  const iconTone =
    a.status === "ok" ? "text-emerald-600" : a.status === "tight" ? "text-amber-600" : "text-red-600";
  const title =
    a.status === "ok"
      ? "Finanzierbar"
      : a.status === "tight"
      ? "Knapp finanzierbar"
      : "Nicht finanzierbar";

  return (
    <Card className={tone}>
      <CardContent className="p-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconTone}`} />
          <p className="font-semibold">{title}</p>
          <Badge variant="outline" className="ml-auto">
            {a.ratio.toFixed(0)}% der Reserve
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Mtl. Reserve</p>
            <p className="font-semibold">{formatCurrency(a.reserve)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mtl. Belastung</p>
            <p className="font-semibold">{formatCurrency(a.monthly)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Verbleibend</p>
            <p className={`font-semibold ${a.remaining < 0 ? "text-red-600" : ""}`}>
              {formatCurrency(a.remaining)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Max. Kaufpreis (Empfehlung)</p>
            <p className="font-semibold text-primary">{formatCurrency(a.maxPrice)}</p>
          </div>
        </div>
        {a.status !== "ok" && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            {a.status === "not_ok"
              ? `Die monatliche Belastung übersteigt die Reserve des Kunden. Empfehlung: Kaufpreis auf max. ${formatCurrency(a.maxPrice)} reduzieren, Eigenkapital erhöhen oder Laufzeit verlängern.`
              : `Die Belastung beansprucht den Grossteil der Reserve. Empfehlung: Kaufpreis auf ca. ${formatCurrency(a.maxPrice)} prüfen oder Konditionen verbessern.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
