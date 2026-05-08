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
  const total = num(input.total_investment);
  const mort = num(input.effective_mortgage);
  const equity = num(input.own_funds_total);
  const pension = num(input.own_funds_pension_fund) + num(input.own_funds_vested_benefits);
  const hard = Math.max(0, equity - pension);
  const ltv = num(input.loan_to_value_ratio);
  const afford = num(input.affordability_ratio);
  const equityRatio = total > 0 ? (equity / total) * 100 : 0;
  const hardRatio = total > 0 ? (hard / total) * 100 : 0;
  const pensionShare = equity > 0 ? (pension / equity) * 100 : 0;

  const summaryNarrative = buildSummaryNarrative(status, input.financing_type, total, mort, equity, ltv, afford);
  const ltvAssessment = assessLtv(ltv);
  const equityAssessment = assessEquity(equityRatio, hardRatio);
  const affordAssessment = assessAffordability(afford);

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
  @page { size: A4; margin: 20mm 16mm 28mm; }
  * { box-sizing: border-box; }
  body { font-family: ${fontFamily}; color:#111827; font-size:11.5px; line-height:1.6; margin:0; }
  h1 { font-size:24px; margin:0 0 4px; color:${primary}; letter-spacing:-0.01em; }
  h2 { font-size:13px; margin:22px 0 10px; color:${primary}; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; padding-bottom:6px; border-bottom:1px solid ${hexAlpha(primary, 0.15)}; page-break-after:avoid; }
  h3 { font-size:12.5px; margin:0 0 6px; color:${primary}; page-break-after:avoid; }
  p { margin:6px 0; }
  table.kv { width:100%; border-collapse:collapse; }
  table.kv td { padding:7px 0; border-bottom:1px solid #f1f3f5; vertical-align:top; }
  table.kv td.l { color:#6b7280; width:38%; }
  .status { display:inline-block; padding:6px 14px; border-radius:999px; color:#fff; font-weight:600; font-size:12px; background:${color}; letter-spacing:0.02em; }
  .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
  .box { border:1px solid ${hexAlpha(primary, 0.18)}; border-radius:10px; padding:12px 14px; background:${hexAlpha(primary, 0.04)}; page-break-inside:avoid; }
  .box .label { color:#6b7280; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
  .box .value { font-size:16px; font-weight:600; color:#111827; }
  .box .sub { font-size:10px; color:#6b7280; margin-top:2px; }
  .muted { color:#6b7280; font-size:11px; }
  .section { page-break-inside:avoid; }
  .narrative { background:${hexAlpha(primary, 0.04)}; border-left:3px solid ${primary}; padding:12px 14px; border-radius:6px; margin:8px 0; font-size:11.5px; color:#374151; }
  .analysis { display:grid; gap:10px; margin-top:6px; }
  .analysis-row { border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; background:#fff; page-break-inside:avoid; }
  .analysis-row .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
  .analysis-row .tag { font-size:10px; padding:2px 8px; border-radius:999px; font-weight:600; letter-spacing:0.02em; }
  .tag.ok { background:#d1fae5; color:#065f46; }
  .tag.warn { background:#fef3c7; color:#92400e; }
  .tag.bad { background:#fee2e2; color:#991b1b; }
  .tag.neutral { background:#e5e7eb; color:#374151; }
  .disclaimer { margin-top:24px; padding:12px 14px; background:${hexAlpha(secondary, 0.08)}; border-left:3px solid ${secondary}; border-radius:6px; font-size:10px; color:#4b5563; line-height:1.55; page-break-inside:avoid; }
  .header { display:flex; justify-content:space-between; align-items:center; padding-bottom:14px; margin-bottom:18px; border-bottom:2px solid ${primary}; }
  .header-left { display:flex; align-items:center; gap:14px; }
  .logo { max-height:46px; max-width:160px; object-fit:contain; }
  .brand-text { font-weight:700; font-size:18px; color:${primary}; letter-spacing:0.04em; }
  .meta { text-align:right; font-size:10.5px; color:#6b7280; line-height:1.5; }
  .recs { display:grid; gap:10px; }
  .rec { border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; background:#fff; page-break-inside:avoid; }
  .rec ul { margin:6px 0 0; padding-left:18px; color:#374151; font-size:11.5px; }
  .rec li { margin:3px 0; }
  .glossary { display:grid; gap:6px; font-size:10.5px; color:#374151; }
  .glossary dt { font-weight:600; color:${primary}; }
  .glossary dd { margin:0 0 6px; color:#4b5563; }
  .page-break { page-break-before:always; }
  .footer { position:fixed; bottom:8mm; left:16mm; right:16mm; text-align:center; font-size:9px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:6px; }
  @media print { .no-print { display:none; } }
</style></head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}"/>` : `<div class="brand-text">${escapeHtml(companyName)}</div>`}
      <div>
        <h1>Finanzierungs Quick-Check</h1>
        <div class="muted">Unverbindliche Vorprüfung gemäss Schweizer Bankstandards</div>
      </div>
    </div>
    <div class="meta">
      Erstellt am ${today}${input.agent_name ? `<br/>von ${escapeHtml(input.agent_name)}` : ""}
      ${input.client_name ? `<br/>für ${escapeHtml(input.client_name)}` : ""}
    </div>
  </div>

  <div class="section">
    <h2>Management Summary</h2>
    <p style="margin:6px 0 10px;"><span class="status">${escapeHtml(statusLabel)}</span></p>
    <div class="narrative">${summaryNarrative}</div>
  </div>

  <div class="section">
    <h2>Übersicht</h2>
    <table class="kv">
      <tr><td class="l">Kunde</td><td>${escapeHtml(input.client_name ?? "—")}</td></tr>
      <tr><td class="l">Finanzierungsart</td><td>${escapeHtml(FINANCING_TYPE_LABELS[input.financing_type])}</td></tr>
      <tr><td class="l">Objekt</td><td>${escapeHtml(input.property_label ?? "—")}</td></tr>
      <tr><td class="l">Datenbasis</td><td>${escapeHtml(input.data_source === "quick_entry" ? "Schnellprüfung (manuelle Eingaben)" : "Bestehende Immobilie aus CRM")}</td></tr>
      <tr><td class="l">Berichtsdatum</td><td>${today}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Finanzierungskennzahlen</h2>
    <div class="grid">
      <div class="box"><div class="label">Gesamtinvestition</div><div class="value">${fmt(input.total_investment)}</div><div class="sub">Kaufpreis inkl. Nebenkosten</div></div>
      <div class="box"><div class="label">Gewünschte Hypothek</div><div class="value">${fmt(input.effective_mortgage)}</div><div class="sub">Fremdfinanzierungsbedarf</div></div>
      <div class="box"><div class="label">Eigenmittel</div><div class="value">${fmt(input.own_funds_total)}</div><div class="sub">Total verfügbares Eigenkapital</div></div>
      <div class="box"><div class="label">Harte Eigenmittel</div><div class="value">${fmt(hard)}</div><div class="sub">${pct(100 - pensionShare)} ohne Pensionskasse</div></div>
      <div class="box"><div class="label">Belehnung (LTV)</div><div class="value">${pct(input.loan_to_value_ratio)}</div><div class="sub">Richtwert Bank: max. 80 %</div></div>
      <div class="box"><div class="label">Tragbarkeit</div><div class="value">${pct(input.affordability_ratio)}</div><div class="sub">Richtwert Bank: max. 33 %</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Detailanalyse</h2>
    <div class="analysis">
      <div class="analysis-row">
        <div class="head"><h3>Belehnung (Loan-to-Value)</h3><span class="tag ${ltvAssessment.tone}">${ltvAssessment.tagLabel}</span></div>
        <p>Die berechnete Belehnung beträgt <strong>${pct(ltv)}</strong> bei einer Gesamtinvestition von ${fmt(total)} und einer gewünschten Hypothek von ${fmt(mort)}. ${ltvAssessment.text}</p>
      </div>
      <div class="analysis-row">
        <div class="head"><h3>Eigenmittelstruktur</h3><span class="tag ${equityAssessment.tone}">${equityAssessment.tagLabel}</span></div>
        <p>Die Gesamteigenmittel von ${fmt(equity)} entsprechen <strong>${pct(equityRatio)}</strong> der Investitionssumme. Davon sind ${fmt(hard)} (${pct(hardRatio)}) harte Eigenmittel ausserhalb der beruflichen Vorsorge, der Pensionskassenanteil beträgt ${fmt(pension)} (${pct(pensionShare)} der Eigenmittel). ${equityAssessment.text}</p>
      </div>
      <div class="analysis-row">
        <div class="head"><h3>Tragbarkeit</h3><span class="tag ${affordAssessment.tone}">${affordAssessment.tagLabel}</span></div>
        <p>Die kalkulatorische Tragbarkeit beläuft sich auf <strong>${pct(afford)}</strong> des Bruttoeinkommens. Die Berechnung erfolgt mit einem kalkulatorischen Zinssatz von 5 %, 1 % Unterhalts- und Nebenkosten der Liegenschaft sowie einer Amortisation der zweiten Hypothek innerhalb von 15 Jahren. ${affordAssessment.text}</p>
      </div>
    </div>
  </div>

  ${reasons.length ? `
  <div class="section">
    <h2>Bewertungsdetails</h2>
    <ul style="margin:6px 0 0; padding-left:18px;">${reasonLi}</ul>
  </div>` : ""}

  <div class="section">
    <h2>Empfehlungen</h2>
    <div class="recs">
      ${recsHtml || '<p class="muted">Auf Basis der vorliegenden Werte sind keine spezifischen Optimierungen erforderlich. Die Finanzierungsstruktur entspricht den marktüblichen Bankrichtlinien.</p>'}
    </div>
  </div>

  <div class="section">
    <h2>Methodik</h2>
    <p>Der Quick-Check basiert auf den marktüblichen Richtlinien Schweizer Hypothekarbanken und der FINMA-Selbstregulierung der Schweizerischen Bankiervereinigung (SBVg). Geprüft werden insbesondere die Belehnung (LTV), die Tragbarkeit auf Basis kalkulatorischer Werte sowie der Anteil harter Eigenmittel.</p>
    <p>Die Berechnung berücksichtigt einen kalkulatorischen Hypothekarzinssatz von 5 % p.a., Unterhalts- und Nebenkosten von 1 % des Liegenschaftswerts pro Jahr sowie die obligatorische Amortisation der zweiten Hypothek (Anteil über 66.67 % LTV) innerhalb von 15 Jahren bzw. bis zur Pensionierung. Die Eigenmittel werden in harte Eigenmittel (eigene Ersparnisse, Säule 3a, Schenkungen, Erbvorbezug) und Pensionskassenmittel unterteilt; mindestens 10 % der Belehnungsbasis müssen aus harten Eigenmitteln stammen.</p>
    <p>Diese Vorprüfung ersetzt keine vollständige Bonitätsprüfung. Eine verbindliche Finanzierungszusage kann ausschliesslich durch einen Bankpartner nach Einreichung sämtlicher Unterlagen (Lohnausweise, Steuererklärungen, Vorsorgeausweise, Objektunterlagen) erfolgen.</p>
  </div>

  <div class="section">
    <h2>Glossar</h2>
    <dl class="glossary">
      <dt>Belehnung (LTV)</dt><dd>Verhältnis der Hypothek zur Gesamtinvestition. Schweizer Banken finanzieren in der Regel maximal 80 %.</dd>
      <dt>Harte Eigenmittel</dt><dd>Eigenkapital ausserhalb der beruflichen Vorsorge. Mindestens 10 % der Belehnungsbasis sind erforderlich.</dd>
      <dt>Tragbarkeit</dt><dd>Verhältnis der jährlichen Wohnkosten (kalk. Zins, Unterhalt, Amortisation) zum Bruttoeinkommen. Richtwert: maximal 33 %.</dd>
      <dt>Kalkulatorischer Zinssatz</dt><dd>Standardisierter Stresstest-Zinssatz von 5 %, unabhängig vom aktuellen Marktzins.</dd>
    </dl>
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> Dies ist eine unverbindliche Vorprüfung und keine definitive Finanzierungszusage. Die Berechnung erfolgt auf Basis der vom Kunden gemachten Angaben und marktüblicher Richtwerte. Eine verbindliche Finanzierungsbestätigung erfolgt ausschliesslich durch den finanzierenden Bankpartner nach vollständiger Prüfung aller Unterlagen. ${escapeHtml(companyName)} übernimmt keine Haftung für Entscheidungen, die auf Basis dieser Vorprüfung getroffen werden.
  </div>

  <div class="footer">${escapeHtml(footerLine)}</div>
</body></html>`;
}

type Assessment = { tone: "ok" | "warn" | "bad" | "neutral"; tagLabel: string; text: string };

function assessLtv(ltv: number): Assessment {
  if (!Number.isFinite(ltv) || ltv <= 0) return { tone: "neutral", tagLabel: "Unvollständig", text: "Es liegen noch nicht genügend Daten für eine abschliessende Beurteilung vor." };
  if (ltv <= 66.67) return { tone: "ok", tagLabel: "Optimal", text: "Die Belehnung liegt im Bereich der ersten Hypothek und ist somit ohne obligatorische Amortisation finanzierbar." };
  if (ltv <= 80) return { tone: "ok", tagLabel: "Im Rahmen", text: "Die Belehnung ist innerhalb der bankenüblichen Maximalgrenze von 80 %. Der Anteil über 66.67 % muss innerhalb von 15 Jahren amortisiert werden." };
  return { tone: "bad", tagLabel: "Zu hoch", text: "Die Belehnung überschreitet die übliche Maximalgrenze von 80 %. Eine Erhöhung der Eigenmittel oder Reduktion des Kaufpreises ist erforderlich." };
}

function assessEquity(equityRatio: number, hardRatio: number): Assessment {
  if (equityRatio <= 0) return { tone: "neutral", tagLabel: "Unvollständig", text: "Eigenmittelangaben fehlen für eine vollständige Beurteilung." };
  if (equityRatio < 20) return { tone: "bad", tagLabel: "Ungenügend", text: "Der Eigenmittelanteil von unter 20 % erfüllt die regulatorischen Mindestanforderungen nicht. Eine Erhöhung ist zwingend." };
  if (hardRatio < 10) return { tone: "warn", tagLabel: "Harte Mittel knapp", text: "Der Anteil harter Eigenmittel von unter 10 % entspricht nicht den FINMA-Richtlinien. Es sind zusätzliche Eigenmittel ausserhalb der Pensionskasse erforderlich." };
  return { tone: "ok", tagLabel: "Solide", text: "Die Eigenmittelstruktur erfüllt die regulatorischen Anforderungen sowohl in Bezug auf den Gesamtanteil als auch auf die harten Eigenmittel." };
}

function assessAffordability(afford: number): Assessment {
  if (!Number.isFinite(afford) || afford <= 0) return { tone: "neutral", tagLabel: "Unvollständig", text: "Einkommensangaben fehlen für eine abschliessende Tragbarkeitsberechnung." };
  if (afford <= 28) return { tone: "ok", tagLabel: "Komfortabel", text: "Die Tragbarkeit liegt deutlich unter dem Richtwert. Die Finanzierung ist auch bei Zinsanstiegen oder Einkommensschwankungen gut tragbar." };
  if (afford <= 33) return { tone: "ok", tagLabel: "Im Rahmen", text: "Die Tragbarkeit liegt innerhalb der bankenüblichen Grenze von 33 %. Eine Bankenfinanzierung ist grundsätzlich möglich." };
  if (afford <= 38) return { tone: "warn", tagLabel: "Grenzwertig", text: "Die Tragbarkeit überschreitet den Richtwert leicht. Einzelne Banken akzeptieren dies bei guter Bonität, eine Optimierung wird empfohlen." };
  return { tone: "bad", tagLabel: "Nicht tragbar", text: "Die Tragbarkeit liegt deutlich über dem Richtwert von 33 %. Eine Finanzierung in der aktuellen Struktur ist sehr unwahrscheinlich." };
}

function buildSummaryNarrative(
  status: QuickCheckStatus,
  type: FinancingType,
  total: number, mort: number, equity: number,
  ltv: number, afford: number,
): string {
  const typeLabel = FINANCING_TYPE_LABELS[type];
  const base = `Geprüft wurde eine <strong>${escapeHtml(typeLabel)}</strong> mit einer Gesamtinvestition von <strong>${fmt(total)}</strong>, einer Hypothek von <strong>${fmt(mort)}</strong> und Eigenmitteln in Höhe von <strong>${fmt(equity)}</strong>. Daraus ergibt sich eine Belehnung von <strong>${pct(ltv)}</strong> sowie eine kalkulatorische Tragbarkeit von <strong>${pct(afford)}</strong>.`;
  let verdict = "";
  if (status === "realistic") verdict = " Die Finanzierung ist auf Basis der vorliegenden Daten realistisch und entspricht den üblichen Bankrichtlinien. Wir empfehlen, mit der vollständigen Selbstauskunft und der Bankeinreichung fortzufahren.";
  else if (status === "critical") verdict = " Die Finanzierung weist einzelne Schwachstellen auf, ist aber nicht ausgeschlossen. Mit gezielten Optimierungen (siehe Empfehlungen) kann die Bankfähigkeit deutlich verbessert werden.";
  else if (status === "not_financeable") verdict = " Die Finanzierung ist in der aktuellen Struktur nicht bankfähig. Eine grundlegende Anpassung der Eigenmittel-, Tragbarkeits- oder Objektsituation ist erforderlich.";
  else verdict = " Für eine abschliessende Beurteilung fehlen noch Pflichtangaben. Bitte vervollständigen Sie die Eingaben und wiederholen Sie den Quick-Check.";
  return base + verdict;
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

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
