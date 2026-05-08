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

export type ReportBrand = {
  company_name?: string | null;
  company_address?: string | null;
  company_email?: string | null;
  company_website?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_family?: string | null;
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

  brand?: ReportBrand | null;
  agent_name?: string | null;
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
    <div class="rec">
      <h3>${escapeHtml(r.title)}</h3>
      <ul>
        ${r.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
      </ul>
    </div>
  `).join("");

  const today = new Date().toLocaleDateString("de-CH");
  const brand = input.brand ?? {};
  const primary = (brand.primary_color || "#324642").trim();
  const secondary = (brand.secondary_color || "#8a9a96").trim();
  const fontFamily = (brand.font_family || `-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`).trim();
  const companyName = (brand.company_name || "ASIMO").trim();
  const companyAddress = brand.company_address ?? "";
  const companyEmail = brand.company_email ?? "";
  const companyWebsite = brand.company_website ?? "";
  const logoUrl = brand.logo_url ?? "";
  const footerLine = [companyName, companyAddress, [companyEmail, companyWebsite].filter(Boolean).join(" · ")]
    .filter(Boolean).join(" · ");

  return `<!doctype html>
<html lang="de-CH"><head><meta charset="utf-8"/>
<title>${escapeHtml(companyName)} – Finanzierungs Quick-Check</title>
<style>
  @page { size: A4; margin: 18mm 16mm 22mm; }
  * { box-sizing: border-box; }
  body { font-family: ${fontFamily}; color:#111827; font-size:12.5px; line-height:1.55; margin:0; }
  h1 { font-size:24px; margin:0 0 4px; color:${primary}; letter-spacing:-0.01em; }
  h2 { font-size:13px; margin:22px 0 10px; color:${primary}; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; padding-bottom:6px; border-bottom:1px solid ${hexAlpha(primary, 0.15)}; }
  h3 { font-size:13px; margin:0 0 6px; color:${primary}; }
  table.kv { width:100%; border-collapse:collapse; }
  table.kv td { padding:7px 0; border-bottom:1px solid #f1f3f5; vertical-align:top; }
  table.kv td.l { color:#6b7280; width:38%; }
  .status { display:inline-block; padding:6px 14px; border-radius:999px; color:#fff; font-weight:600; font-size:12px; background:${color}; letter-spacing:0.02em; }
  .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
  .box { border:1px solid ${hexAlpha(primary, 0.18)}; border-radius:10px; padding:12px 14px; background:${hexAlpha(primary, 0.04)}; }
  .box .label { color:#6b7280; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
  .box .value { font-size:16px; font-weight:600; color:#111827; }
  .muted { color:#6b7280; font-size:11px; }
  .disclaimer { margin-top:28px; padding:12px 14px; background:${hexAlpha(secondary, 0.08)}; border-left:3px solid ${secondary}; border-radius:6px; font-size:10.5px; color:#4b5563; line-height:1.5; }
  .header { display:flex; justify-content:space-between; align-items:center; padding-bottom:14px; margin-bottom:18px; border-bottom:2px solid ${primary}; }
  .header-left { display:flex; align-items:center; gap:14px; }
  .logo { max-height:46px; max-width:160px; object-fit:contain; }
  .brand-text { font-weight:700; font-size:18px; color:${primary}; letter-spacing:0.04em; }
  .meta { text-align:right; font-size:10.5px; color:#6b7280; line-height:1.5; }
  .recs { display:grid; gap:10px; }
  .rec { border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; background:#fff; }
  .rec ul { margin:6px 0 0; padding-left:18px; color:#374151; font-size:12px; }
  .rec li { margin:3px 0; }
  .footer { position:fixed; bottom:8mm; left:16mm; right:16mm; text-align:center; font-size:9.5px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:6px; }
  @media print { .no-print { display:none; } }
</style></head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}"/>` : `<div class="brand-text">${escapeHtml(companyName)}</div>`}
      <div>
        <h1>Finanzierungs Quick-Check</h1>
        <div class="muted">Unverbindliche Vorprüfung</div>
      </div>
    </div>
    <div class="meta">
      Erstellt am ${today}${input.agent_name ? `<br/>von ${escapeHtml(input.agent_name)}` : ""}
    </div>
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
    <div class="box"><div class="label">Gesamtinvestition</div><div class="value">${fmt(input.total_investment)}</div></div>
    <div class="box"><div class="label">Gewünschte Hypothek</div><div class="value">${fmt(input.effective_mortgage)}</div></div>
    <div class="box"><div class="label">Eigenmittel</div><div class="value">${fmt(input.own_funds_total)}</div></div>
    <div class="box"><div class="label">Harte Eigenmittel</div><div class="value">${fmt(hard)}</div></div>
    <div class="box"><div class="label">Belehnung (LTV)</div><div class="value">${pct(input.loan_to_value_ratio)}</div></div>
    <div class="box"><div class="label">Tragbarkeit</div><div class="value">${pct(input.affordability_ratio)}</div></div>
  </div>

  <h2>Ergebnis</h2>
  <p style="margin:6px 0 0;"><span class="status">${escapeHtml(statusLabel)}</span></p>
  ${reasons.length ? `<ul style="margin:12px 0 0; padding-left:18px;">${reasonLi}</ul>` : ""}

  <h2>Empfehlungen</h2>
  <div class="recs">
    ${recsHtml || '<p class="muted">Keine spezifischen Empfehlungen.</p>'}
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> Dies ist eine unverbindliche Vorprüfung und keine definitive Finanzierungszusage.
    Eine verbindliche Finanzierungsbestätigung erfolgt ausschliesslich durch den finanzierenden Bankpartner
    nach vollständiger Prüfung aller Unterlagen.
  </div>

  <div class="footer">${escapeHtml(footerLine)}</div>
</body></html>`;
}

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
