// Empfehlungen + HTML-Bericht für den Finanzierungs Quick-Check
// Schweizer Rechtschreibung, kein ß.
import {
  FINANCING_TYPE_LABELS, QUICK_CHECK_LABELS,
  type FinancingType, type QuickCheckStatus,
} from "./financing";
import { formatCurrency } from "./format";

export type RecommendationSource = "rules" | "ai";

export type Recommendation = {
  category: "equity" | "hard_equity" | "affordability" | "next_steps" | "general";
  title: string;
  items: string[];
};

export type ReportInput = {
  client_name?: string | null;
  client_email?: string | null;
  property_label?: string | null;
  data_source?: string | null;

  financing_type: FinancingType;
  total_investment?: number | null;
  effective_mortgage?: number | null;
  own_funds_total?: number | null;
  own_funds_pension_fund?: number | null;
  own_funds_vested_benefits?: number | null;
  loan_to_value_ratio?: number | null;
  affordability_ratio?: number | null;

  quick_check_status?: QuickCheckStatus | null;
  quick_check_reasons?: { key: string; label: string; tone: string }[] | null;
};

export function buildRecommendations(input: ReportInput): Recommendation[] {
  const recs: Recommendation[] = [];
  const total = num(input.total_investment);
  const mort = num(input.effective_mortgage);
  const equity = num(input.own_funds_total) || Math.max(0, total - mort);
  const pension = num(input.own_funds_pension_fund) + num(input.own_funds_vested_benefits);
  const hard = Math.max(0, equity - pension);
  const equityRatio = total > 0 ? (equity / total) * 100 : 0;
  const hardRatio = total > 0 ? (hard / total) * 100 : 0;
  const afford = num(input.affordability_ratio);

  if (equityRatio < 20) {
    recs.push({
      category: "equity",
      title: "Eigenmittel erhöhen",
      items: [
        "Säule 3a, Freizügigkeit, Schenkung oder Erbvorbezug prüfen",
        "Liquide Mittel und Wertschriften einbeziehen",
        "Kaufpreis reduzieren oder günstigeres Objekt wählen",
      ],
    });
  }

  if (hardRatio < 10) {
    recs.push({
      category: "hard_equity",
      title: "Harte Eigenmittel stärken",
      items: [
        "Mehr Eigenmittel ausserhalb der Pensionskasse einbringen",
        "Liquide Mittel, Säule 3a oder Schenkung als harte Eigenmittel prüfen",
        "Anteil Pensionskassenbezug reduzieren",
      ],
    });
  }

  if (afford > 33) {
    recs.push({
      category: "affordability",
      title: "Tragbarkeit verbessern",
      items: [
        "Kaufpreis oder Hypothekenhöhe reduzieren",
        "Mehr Eigenmittel einsetzen",
        "Zweiten Antragsteller / Mitantragsteller prüfen",
        "Bestehende Kredite und Leasings reduzieren",
      ],
    });
  }

  if (input.quick_check_status === "realistic") {
    recs.push({
      category: "next_steps",
      title: "Nächste Schritte",
      items: [
        "Selbstauskunft vollständig erfassen",
        "Erforderliche Unterlagen sammeln",
        "UBS Checkliste vorbereiten",
        "Bankeinreichung starten",
      ],
    });
  } else if (input.quick_check_status === "critical") {
    recs.push({
      category: "next_steps",
      title: "Nächste Schritte",
      items: [
        "Optimierungspotenzial mit Kunde besprechen",
        "Alternativszenarien rechnen (z. B. tieferer Kaufpreis)",
        "Selbstauskunft starten, um Bild zu schärfen",
      ],
    });
  } else if (input.quick_check_status === "not_financeable") {
    recs.push({
      category: "next_steps",
      title: "Nächste Schritte",
      items: [
        "Objekt oder Finanzierungsstruktur grundlegend anpassen",
        "Eigenmittelbasis ausbauen",
        "Alternative Objekte mit anderem Preisniveau prüfen",
      ],
    });
  } else {
    recs.push({
      category: "next_steps",
      title: "Nächste Schritte",
      items: [
        "Fehlende Pflichtangaben ergänzen (Kaufpreis, Hypothek, Einkommen)",
        "Quick Check anschliessend wiederholen",
      ],
    });
  }

  return recs;
}

function num(v: any): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function statusColor(status?: QuickCheckStatus | null): string {
  if (status === "realistic") return "#059669";
  if (status === "critical") return "#d97706";
  if (status === "not_financeable") return "#dc2626";
  return "#6b7280";
}

function fmt(v: any): string {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  if (!Number.isFinite(n)) return "—";
  return formatCurrency(n);
}

function pct(v: any): string {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function buildReportHtml(input: ReportInput, recs: Recommendation[]): string {
  const status = input.quick_check_status ?? "incomplete";
  const statusLabel = QUICK_CHECK_LABELS[status];
  const color = statusColor(status);
  const reasons = input.quick_check_reasons ?? [];
  const equity = num(input.own_funds_total);
  const pension = num(input.own_funds_pension_fund) + num(input.own_funds_vested_benefits);
  const hard = Math.max(0, equity - pension);

  const reasonLi = reasons.map((r) => {
    const c = r.tone === "ok" ? "#059669" : r.tone === "warn" ? "#d97706" : r.tone === "bad" ? "#dc2626" : "#374151";
    return `<li style="color:${c}; margin:4px 0;">${escapeHtml(r.label)}</li>`;
  }).join("");

  const recsHtml = recs.map((r) => `
    <div style="margin-top:16px;">
      <h3 style="font-size:14px; margin:0 0 6px; color:#111827;">${escapeHtml(r.title)}</h3>
      <ul style="margin:0; padding-left:18px; color:#374151; font-size:13px;">
        ${r.items.map((i) => `<li style="margin:3px 0;">${escapeHtml(i)}</li>`).join("")}
      </ul>
    </div>
  `).join("");

  const today = new Date().toLocaleDateString("de-CH");

  return `<!doctype html>
<html lang="de-CH"><head><meta charset="utf-8"/>
<title>ASIMO Finanzierungs Quick-Check</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:#111827; font-size:13px; line-height:1.5; }
  h1 { font-size:22px; margin:0 0 4px; }
  h2 { font-size:15px; margin:24px 0 8px; border-bottom:1px solid #e5e7eb; padding-bottom:4px; }
  table.kv { width:100%; border-collapse:collapse; }
  table.kv td { padding:6px 8px; border-bottom:1px solid #f3f4f6; vertical-align:top; }
  table.kv td.l { color:#6b7280; width:42%; }
  .status { display:inline-block; padding:4px 10px; border-radius:999px; color:#fff; font-weight:600; font-size:12px; background:${color}; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .box { border:1px solid #e5e7eb; border-radius:8px; padding:12px; }
  .muted { color:#6b7280; font-size:11px; }
  .disclaimer { margin-top:28px; padding:10px 12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; font-size:11px; color:#6b7280; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #111827; padding-bottom:8px; }
  .brand { font-weight:700; letter-spacing:0.5px; }
  @media print { .no-print { display:none; } }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">ASIMO</div>
      <h1>Finanzierungs Quick-Check</h1>
    </div>
    <div class="muted">Erstellt am ${today}</div>
  </div>

  <h2>Übersicht</h2>
  <table class="kv">
    <tr><td class="l">Kunde</td><td>${escapeHtml(input.client_name ?? "—")}</td></tr>
    <tr><td class="l">Finanzierungsart</td><td>${escapeHtml(FINANCING_TYPE_LABELS[input.financing_type])}</td></tr>
    <tr><td class="l">Objekt</td><td>${escapeHtml(input.property_label ?? "—")}</td></tr>
    <tr><td class="l">Datenbasis</td><td>${escapeHtml(input.data_source === "quick_entry" ? "Schnellprüfung" : "Bestehende Immobilie")}</td></tr>
  </table>

  <h2>Finanzierungskennzahlen</h2>
  <div class="grid">
    <div class="box"><div class="muted">Gesamtinvestition</div><div style="font-size:16px; font-weight:600;">${fmt(input.total_investment)}</div></div>
    <div class="box"><div class="muted">Gewünschte Hypothek</div><div style="font-size:16px; font-weight:600;">${fmt(input.effective_mortgage)}</div></div>
    <div class="box"><div class="muted">Eigenmittel</div><div style="font-size:16px; font-weight:600;">${fmt(input.own_funds_total)}</div></div>
    <div class="box"><div class="muted">Harte Eigenmittel</div><div style="font-size:16px; font-weight:600;">${fmt(hard)}</div></div>
    <div class="box"><div class="muted">Belehnung</div><div style="font-size:16px; font-weight:600;">${pct(input.loan_to_value_ratio)}</div></div>
    <div class="box"><div class="muted">Tragbarkeit</div><div style="font-size:16px; font-weight:600;">${pct(input.affordability_ratio)}</div></div>
  </div>

  <h2>Ergebnis</h2>
  <p><span class="status">${escapeHtml(statusLabel)}</span></p>
  ${reasons.length ? `<ul style="margin:8px 0 0; padding-left:18px;">${reasonLi}</ul>` : ""}

  <h2>Empfehlungen</h2>
  ${recsHtml || '<p class="muted">Keine spezifischen Empfehlungen.</p>'}

  <div class="disclaimer">
    Disclaimer: Dies ist eine unverbindliche Vorprüfung und keine definitive Finanzierungszusage.
    Eine verbindliche Finanzierungsbestätigung erfolgt ausschliesslich durch den finanzierenden Bankpartner
    nach vollständiger Prüfung aller Unterlagen.
  </div>
</body></html>`;
}

function escapeHtml(s: any): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
