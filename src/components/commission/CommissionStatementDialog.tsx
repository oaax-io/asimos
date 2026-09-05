// ---------------------------------------------------------------------------
// Provisionsabrechnung: erzeugt pro Mitarbeiter oder pro Objekt eine
// druckbare Abrechnung (HTML -> Druckdialog/PDF) für einen frei wählbaren
// Zeitraum. Nutzt ausschliesslich bereits geladene Daten der Seite.
// ---------------------------------------------------------------------------
import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  commission: "Abschlussprovision",
  reservation_fee: "Reservationsgebühr",
  cancellation_fee: "Rücktrittsentschädigung",
  referral_fee: "Vermittlungsprovision",
  adjustment: "Korrektur",
};

type Props = {
  data: any;
  isCommissionAdmin: boolean;
  myUserId: string | null;
};

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearISO() {
  return `${new Date().getFullYear()}-01-01`;
}

export function CommissionStatementDialog({ data, isCommissionAdmin, myUserId }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"employee" | "property">("employee");
  const [targetId, setTargetId] = useState<string>(isCommissionAdmin ? "" : (myUserId ?? ""));
  const [from, setFrom] = useState(startOfYearISO());
  const [to, setTo] = useState(todayISO());

  const profiles: any[] = data?.profiles ?? [];
  const properties: any[] = data?.properties ?? [];
  const records: any[] = data?.records ?? [];
  const splits: any[] = data?.splits ?? [];
  const clients: any[] = data?.clients ?? [];

  const employeeOptions = useMemo(
    () => (isCommissionAdmin ? profiles : profiles.filter((p) => p.id === myUserId)),
    [profiles, isCommissionAdmin, myUserId],
  );

  // Objekte, zu denen es überhaupt Buchungen gibt (bei Nicht-Admins nur eigene).
  const propertyOptions = useMemo(() => {
    const mine = new Set(
      splits.filter((s) => isCommissionAdmin || s.user_id === myUserId).map((s) => s.commission_record_id),
    );
    const ids = new Set(
      records.filter((r) => isCommissionAdmin || mine.has(r.id)).map((r) => r.property_id).filter(Boolean),
    );
    return properties.filter((p) => ids.has(p.id));
  }, [records, splits, properties, isCommissionAdmin, myUserId]);

  const inPeriod = (r: any) => {
    if (!r.booked_at) return false;
    const d = String(r.booked_at).slice(0, 10);
    return d >= from && d <= to;
  };

  const nameOf = (id: string | null) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || p?.email || "Unbekannt";
  };
  const propTitle = (id: string | null) => properties.find((p) => p.id === id)?.title || "—";

  const rows = useMemo(() => {
    if (!targetId) return [];
    const active = records.filter((r) => r.status !== "void" && inPeriod(r));
    if (mode === "employee") {
      return splits
        .filter((s) => s.user_id === targetId)
        .map((s) => ({ s, r: active.find((r) => r.id === s.commission_record_id) }))
        .filter((x) => x.r)
        .map(({ s, r }) => ({
          date: String(r.booked_at).slice(0, 10),
          type: TYPE_LABELS[r.record_type] ?? r.record_type,
          subject: propTitle(r.property_id),
          gross: Number(r.gross_amount) || 0,
          percent: Number(s.split_percent) || 0,
          share: Number(s.gross_share) || 0,
          rate: Number(s.payout_rate) || 0,
          payout: Number(s.payout_amount) || 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    return active
      .filter((r) => r.property_id === targetId)
      .map((r) => {
        const rs = splits.filter((s) => s.commission_record_id === r.id);
        return {
          date: String(r.booked_at).slice(0, 10),
          type: TYPE_LABELS[r.record_type] ?? r.record_type,
          subject:
            rs.map((s) => `${nameOf(s.user_id)} ${Number(s.split_percent) || 0} %`).join(", ") ||
            clients.find((c) => c.id === r.client_id)?.full_name ||
            "—",
          gross: Number(r.gross_amount) || 0,
          percent: 100,
          share: Number(r.gross_amount) || 0,
          rate: 0,
          payout: rs.reduce((sum, s) => sum + (Number(s.payout_amount) || 0), 0),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [mode, targetId, records, splits, from, to]);

  const totals = useMemo(
    () => ({
      gross: rows.reduce((s, r) => s + r.share, 0),
      payout: rows.reduce((s, r) => s + r.payout, 0),
    }),
    [rows],
  );

  const title =
    mode === "employee"
      ? `Provisionsabrechnung – ${nameOf(targetId)}`
      : `Provisionsabrechnung – ${propTitle(targetId)}`;

  const print = () => {
    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1b22;margin:32px;}
  h1{font-size:20px;margin:0 0 4px;color:#6F6B94;}
  .meta{font-size:12px;color:#6b6b7b;margin-bottom:24px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{text-align:left;background:#6F6B94;color:#fff;padding:8px;}
  td{padding:8px;border-bottom:1px solid #e6e5ee;}
  .r{text-align:right;font-variant-numeric:tabular-nums;}
  tfoot td{font-weight:700;border-top:2px solid #6F6B94;border-bottom:none;}
  .empty{padding:24px;text-align:center;color:#6b6b7b;font-size:12px;}
  @media print{body{margin:12mm;}}
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">Zeitraum ${esc(from)} bis ${esc(to)} &middot; erstellt am ${esc(todayISO())}</div>
${rows.length === 0 ? '<div class="empty">Keine Buchungen im gewählten Zeitraum.</div>' : `
<table><thead><tr>
  <th>Datum</th><th>Art</th><th>${mode === "employee" ? "Objekt" : "Beteiligte"}</th>
  <th class="r">Brutto</th><th class="r">Anteil %</th><th class="r">Anteil</th><th class="r">Auszahlung</th>
</tr></thead><tbody>
${rows.map((r) => `<tr>
  <td>${esc(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.subject)}</td>
  <td class="r">${esc(formatCurrency(r.gross))}</td>
  <td class="r">${esc(r.percent)} %</td>
  <td class="r">${esc(formatCurrency(r.share))}</td>
  <td class="r">${esc(formatCurrency(r.payout))}</td>
</tr>`).join("")}
</tbody><tfoot><tr>
  <td colspan="5">Total</td>
  <td class="r">${esc(formatCurrency(totals.gross))}</td>
  <td class="r">${esc(formatCurrency(totals.payout))}</td>
</tr></tfoot></table>`}
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <FileText className="h-4 w-4" /> Abrechnung erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Provisionsabrechnung</DialogTitle>
          <DialogDescription>
            Abrechnung pro Mitarbeiter oder pro Objekt für einen frei wählbaren Zeitraum erstellen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Abrechnung für</Label>
              <Select
                value={mode}
                onValueChange={(v) => { setMode(v as any); setTargetId(v === "employee" && !isCommissionAdmin ? (myUserId ?? "") : ""); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Mitarbeiter</SelectItem>
                  <SelectItem value="property">Objekt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{mode === "employee" ? "Mitarbeiter" : "Objekt"}</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                <SelectContent>
                  {(mode === "employee" ? employeeOptions : propertyOptions).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {mode === "employee" ? o.full_name || o.email : o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Von</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Buchungen</span>
              <span className="font-medium tabular-nums">{rows.length}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Anteil brutto</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totals.gross)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Auszahlung</span>
              <span className="font-semibold tabular-nums text-primary">{formatCurrency(totals.payout)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Schliessen</Button>
          <Button onClick={print} disabled={!targetId} className="gap-2">
            <Printer className="h-4 w-4" /> Abrechnung erzeugen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
