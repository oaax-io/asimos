// Master-PDF für das Bank-Paket.
// Schweizer Rechtschreibung, kein ß. Sprache aktuell DE; Struktur für FR/IT vorbereitet
// via PackageLocale + LOCALE_STRINGS — wenn FR/IT übersetzt werden soll, nur das Dict erweitern.

import { formatCurrency } from "./format";
import {
  FINANCING_TYPE_LABELS,
  QUICK_CHECK_LABELS,
  DOSSIER_STATUS_LABELS,
  type FinancingType,
  type QuickCheckStatus,
  type DossierStatus,
} from "./financing";

export type PackageLocale = "de" | "fr" | "it";

type Brand = {
  company_name?: string | null;
  company_address?: string | null;
  company_email?: string | null;
  company_website?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_family?: string | null;
};

type Applicant = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  birth_date?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  employment_status?: string | null;
  employer_name?: string | null;
  salary_net_monthly?: number | null;
  annual_net_salary?: number | null;
  total_income_monthly?: number | null;
  total_expenses_monthly?: number | null;
  reserve_total?: number | null;
  // Erweiterte Selbstauskunft-Felder (für vollständige Übernahme im Bank-Paket)
  disclosure?: Disclosure | null;
};

export type Disclosure = {
  // Persönlich
  salutation?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  birth_name?: string | null;
  birth_place?: string | null;
  birth_country?: string | null;
  nationality?: string | null;
  marital_status?: string | null;
  resident_since?: string | null;
  // Kontakt
  street?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  tax_id_ch?: string | null;
  // Anstellung
  employment_status?: string | null;
  employed_as?: string | null;
  employer_name?: string | null;
  employer_address?: string | null;
  employer_phone?: string | null;
  employed_since?: string | null;
  salary_type?: string | null;
  // Einkommen
  salary_net_monthly?: number | null;
  annual_net_salary?: number | null;
  income_job_two?: number | null;
  income_rental?: number | null;
  additional_income?: number | null;
  total_income_monthly?: number | null;
  // Ausgaben
  rent_expense?: number | null;
  mortgage_expense?: number | null;
  utilities_expense?: number | null;
  taxes_expense?: number | null;
  health_insurance_expense?: number | null;
  life_insurance_expense?: number | null;
  property_insurance_expense?: number | null;
  telecom_expense?: number | null;
  leasing_expense?: number | null;
  credit_expense?: number | null;
  alimony_expense?: number | null;
  living_costs_expense?: number | null;
  miscellaneous_expense?: number | null;
  total_expenses_monthly?: number | null;
  // Reserve
  reserve_total?: number | null;
  reserve_ratio?: number | null;
  // Status
  status?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
};

type DocumentInventoryEntry = {
  folder: string;
  filename: string;
  source: string; // "Kunde" | "Ehepartner" | "Objekt" | "Finanzierung" | "Generiert"
  size_bytes?: number | null;
};

type ChecklistEntry = {
  label: string;
  section?: string | null;
  status: string;
  note?: string | null;
};

export type BankPackageInput = {
  locale?: PackageLocale;
  brand?: Brand | null;
  agent_name?: string | null;

  dossier: {
    id: string;
    title?: string | null;
    financing_type?: FinancingType | null;
    dossier_status?: DossierStatus | null;
    quick_check_status?: QuickCheckStatus | null;

    purchase_price?: number | null;
    renovation_costs?: number | null;
    renovation_own_work?: number | null;
    total_investment?: number | null;
    requested_mortgage?: number | null;

    own_funds_total?: number | null;
    own_funds_liquid?: number | null;
    own_funds_pillar_3a?: number | null;
    own_funds_pension_fund?: number | null;
    own_funds_vested_benefits?: number | null;
    own_funds_gift?: number | null;
    own_funds_inheritance?: number | null;

    loan_to_value_ratio?: number | null;
    affordability_ratio?: number | null;
    gross_income_yearly?: number | null;

    bank_type?: string | null;
    bank_name?: string | null;
    bank_contact?: string | null;
    bank_email?: string | null;
    bank_phone?: string | null;
    bank_notes?: string | null;
    internal_notes?: string | null;
    submitted_to_bank_at?: string | null;

    einkommen_kombiniert?: number | null;
    eigenkapital_kombiniert?: number | null;
    pk_anteil_kombiniert?: number | null;

    // Felder für Detailrechnung
    co_applicant_einkommen?: number | null;
    co_applicant_eigenkapital?: number | null;
    co_applicant_pk_anteil?: number | null;
    yearly_costs?: number | null;
    calculated_interest_rate?: number | null;
    ancillary_costs_yearly?: number | null;
    amortisation_yearly?: number | null;
  };

  applicant: Applicant;
  coApplicant?: Applicant | null;

  property?: {
    title?: string | null;
    address?: string | null;
    city?: string | null;
    type?: string | null;
    area?: number | null;
    rooms?: number | null;
  } | null;

  checklist: ChecklistEntry[];
  documents: DocumentInventoryEntry[];
};

// ---------- i18n scaffolding ----------

const STRINGS: Record<PackageLocale, Record<string, string>> = {
  de: {
    title: "Finanzierungsdossier zur Bankeinreichung",
    subtitle: "Vollständiges Dossier inklusive Selbstauskünfte und Unterlagen",
    created_on: "Erstellt am",
    created_by: "von",
    section_overview: "Übersicht",
    section_applicants: "Antragsteller",
    section_main_applicant: "Hauptantragsteller",
    section_co_applicant: "Mitantragsteller / Ehepartner",
    section_property: "Objekt",
    section_financing: "Finanzierungskennzahlen",
    section_quick_check: "Quick-Check Ergebnis",
    section_vorpruefung: "Vorprüfung Quick-Check",
    section_detailrechnung: "Detailrechnung",
    section_self_disclosure: "Selbstauskunft",
    section_checklist: "Unterlagen-Checkliste (Bank)",
    section_notes: "Notizen",
    section_documents: "Dokumenten-Inventar",
    section_bank: "Bankangaben",
    no_coapp: "Kein Mitantragsteller erfasst.",
    no_property: "Kein Objekt verknüpft.",
    no_checklist: "Keine Checkliste-Einträge vorhanden.",
    no_notes: "Keine Notizen erfasst.",
    no_docs: "Keine Dokumente im Inventar.",
    label_dossier: "Dossier",
    label_status: "Status",
    label_financing_type: "Finanzierungsart",
    label_quick_check: "Quick-Check",
    label_purchase: "Kaufpreis",
    label_renovation: "Renovationskosten",
    label_own_work: "davon Eigenleistung",
    label_total_investment: "Gesamtinvestition",
    label_mortgage: "Gewünschte Hypothek",
    label_equity_total: "Eigenmittel total",
    label_equity_combined: "Eigenmittel (kombiniert)",
    label_income_combined: "Einkommen (kombiniert)",
    label_pk_combined: "davon PK / Freizügigkeit",
    label_ltv: "Belehnung (LTV)",
    label_affordability: "Tragbarkeit",
    label_income_yearly: "Bruttoeinkommen p.a.",
    label_bank_type: "Banktyp",
    label_bank_name: "Bankname",
    label_bank_contact: "Kontaktperson",
    label_bank_email: "E-Mail",
    label_bank_phone: "Telefon",
    label_submitted_at: "Eingereicht am",
    label_bank_notes: "Bank-Notizen",
    label_internal_notes: "Interne Notizen",
    cover_for: "Für",
    cover_dossier_id: "Dossier-ID",
    inventory_intro:
      "Das ZIP-Paket enthält dieses Dossier-PDF sowie alle untenstehenden Unterlagen, geordnet nach Quelle.",
  },
  fr: {} as Record<string, string>,
  it: {} as Record<string, string>,
};

function t(locale: PackageLocale, key: string): string {
  return STRINGS[locale]?.[key] ?? STRINGS.de[key] ?? key;
}

// ---------- helpers ----------

const escapeHtml = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const fmt = (n: number | null | undefined): string => (n == null ? "—" : formatCurrency(n));
const pct = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)}%`;
const dash = (s: string | null | undefined): string =>
  s != null && String(s).trim() !== "" ? escapeHtml(s) : "—";

function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatDateCH(d: string | null | undefined): string {
  if (!d) return "—";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("de-CH");
}

function kv(label: string, value: string): string {
  return `<tr><td class="l">${escapeHtml(label)}</td><td>${value}</td></tr>`;
}

function applicantBlock(locale: PackageLocale, a: Applicant): string {
  return `
    <table class="kv">
      ${kv("Name", dash(a.full_name))}
      ${kv("E-Mail", dash(a.email))}
      ${kv("Telefon", dash(a.phone))}
      ${kv("Adresse", dash(a.address))}
      ${kv("Geburtsdatum", formatDateCH(a.birth_date))}
      ${kv("Nationalität", dash(a.nationality))}
      ${kv("Zivilstand", dash(a.marital_status))}
      ${kv("Anstellungsstatus", dash(a.employment_status))}
      ${kv("Arbeitgeber", dash(a.employer_name))}
      ${kv("Nettolohn (mtl.)", fmt(a.salary_net_monthly ?? null))}
      ${kv("Jahres-Nettolohn", fmt(a.annual_net_salary ?? null))}
      ${kv("Total Einkommen (mtl.)", fmt(a.total_income_monthly ?? null))}
      ${kv("Total Ausgaben (mtl.)", fmt(a.total_expenses_monthly ?? null))}
      ${kv("Verfügbare Reserve", fmt(a.reserve_total ?? null))}
    </table>
  `;
}

// ---------- Quick-Check Vorprüfung (Balken-Grafiken) ----------

const TONE_COLORS = {
  ok: { bar: "#10b981", text: "#047857", bg: "#d1fae5" },
  warn: { bar: "#f59e0b", text: "#92400e", bg: "#fef3c7" },
  bad: { bar: "#ef4444", text: "#991b1b", bg: "#fee2e2" },
};

function kpiCardHtml(opts: {
  label: string;
  value: number;
  limit: number;
  mode: "max" | "min";
}): string {
  const { label, value, limit, mode } = opts;
  // Spiegelt die App-Logik: bis Limit = grün, leichte Überschreitung = orange, deutlich darüber = rot
  let tone: "ok" | "warn" | "bad";
  if (mode === "max") {
    if (value <= limit) tone = "ok";
    else if (value <= limit * 1.1) tone = "warn";
    else tone = "bad";
  } else {
    if (value >= limit) tone = "ok";
    else if (value >= limit * 0.9) tone = "warn";
    else tone = "bad";
  }
  const c = TONE_COLORS[tone];
  const scaleMax = mode === "max" ? Math.max(limit * 1.25, value) : Math.max(limit * 1.5, value, 100);
  const valuePct = Math.min(100, (value / scaleMax) * 100);
  const limitPct = Math.min(100, (limit / scaleMax) * 100);
  return `
    <div class="kpi">
      <div class="kpi-head">
        <span class="kpi-label">${escapeHtml(label)}</span>
        <span class="kpi-limit">Limit ${limit}%</span>
      </div>
      <div class="kpi-value" style="color:${c.text};">${value.toFixed(1)}%</div>
      <div class="kpi-bar">
        <div class="kpi-bar-fill" style="width:${valuePct.toFixed(1)}%; background:${c.bar};"></div>
        <div class="kpi-bar-limit" style="left:${limitPct.toFixed(1)}%;"></div>
      </div>
    </div>
  `;
}

function vorpruefungHtml(d: BankPackageInput["dossier"]): string {
  const purchase = Number(d.purchase_price ?? 0) || 0;
  const reno = Number(d.renovation_costs ?? 0) || 0;
  const total = Number(d.total_investment ?? 0) || (purchase + reno);
  const mortgage = Number(d.requested_mortgage ?? 0) || 0;
  const equity =
    Number(d.eigenkapital_kombiniert ?? 0) > 0
      ? Number(d.eigenkapital_kombiniert)
      : Number(d.own_funds_total ?? 0) +
        Number(d.co_applicant_eigenkapital ?? 0) +
        Number(d.co_applicant_pk_anteil ?? 0);
  const pension =
    Number(d.pk_anteil_kombiniert ?? 0) > 0
      ? Number(d.pk_anteil_kombiniert)
      : Number(d.own_funds_pension_fund ?? 0) +
        Number(d.own_funds_vested_benefits ?? 0) +
        Number(d.co_applicant_pk_anteil ?? 0);
  const hardEquity = Math.max(0, equity - pension);
  const income =
    Number(d.einkommen_kombiniert ?? 0) > 0
      ? Number(d.einkommen_kombiniert)
      : Number(d.gross_income_yearly ?? 0) + Number(d.co_applicant_einkommen ?? 0);
  const rate = Number(d.calculated_interest_rate ?? 5) || 5;
  const ancillary =
    d.ancillary_costs_yearly != null ? Number(d.ancillary_costs_yearly) : total * 0.01;
  const amort = Number(d.amortisation_yearly ?? 0) || 0;
  const yearly = Number(d.yearly_costs ?? 0) > 0
    ? Number(d.yearly_costs)
    : mortgage * (rate / 100) + ancillary + amort;

  const ltv = total > 0 ? (mortgage / total) * 100 : 0;
  const afford = income > 0 ? (yearly / income) * 100 : 0;
  const equityRatio = total > 0 ? (equity / total) * 100 : 0;
  const hardRatio = total > 0 ? (hardEquity / total) * 100 : 0;

  return `
    <div class="kpi-grid">
      ${kpiCardHtml({ label: "Belehnung (LTV)", value: ltv, limit: 80, mode: "max" })}
      ${kpiCardHtml({ label: "Tragbarkeit", value: afford, limit: 33, mode: "max" })}
      ${kpiCardHtml({ label: "Eigenmittelquote", value: equityRatio, limit: 20, mode: "min" })}
      ${kpiCardHtml({ label: "Harte Eigenmittel", value: hardRatio, limit: 10, mode: "min" })}
    </div>
  `;
}

// ---------- Detailrechnung ----------

function detailRechnungHtml(d: BankPackageInput["dossier"]): string {
  const purchase = Number(d.purchase_price ?? 0) || 0;
  const reno = Number(d.renovation_costs ?? 0) || 0;
  const ownWork = Number(d.renovation_own_work ?? 0) || 0;
  const total = Number(d.total_investment ?? 0) || (purchase + reno);
  const mortgage = Number(d.requested_mortgage ?? 0) || 0;
  const equity =
    Number(d.eigenkapital_kombiniert ?? 0) > 0
      ? Number(d.eigenkapital_kombiniert)
      : Number(d.own_funds_total ?? 0) +
        Number(d.co_applicant_eigenkapital ?? 0) +
        Number(d.co_applicant_pk_anteil ?? 0);
  const pension =
    Number(d.pk_anteil_kombiniert ?? 0) > 0
      ? Number(d.pk_anteil_kombiniert)
      : Number(d.own_funds_pension_fund ?? 0) +
        Number(d.own_funds_vested_benefits ?? 0) +
        Number(d.co_applicant_pk_anteil ?? 0);
  const cash = Math.max(0, equity - pension);
  const income =
    Number(d.einkommen_kombiniert ?? 0) > 0
      ? Number(d.einkommen_kombiniert)
      : Number(d.gross_income_yearly ?? 0) + Number(d.co_applicant_einkommen ?? 0);
  const rate = Number(d.calculated_interest_rate ?? 5) || 5;

  const firstMortgageMax = total * 0.65;
  const firstMortgage = Math.min(mortgage, firstMortgageMax);
  const secondMortgage = Math.max(0, mortgage - firstMortgageMax);
  const amortYearly = secondMortgage / 15;
  const interestCost = mortgage * (rate / 100);
  const ancillary =
    d.ancillary_costs_yearly != null ? Number(d.ancillary_costs_yearly) : total * 0.01;
  const totalYearly = interestCost + ancillary + amortYearly;
  const afford = income > 0 ? (totalYearly / income) * 100 : 0;
  const minIncome = totalYearly / 0.33;
  const equityRatio = total > 0 ? (equity / total) * 100 : 0;
  const mortgageRatio = total > 0 ? (mortgage / total) * 100 : 0;
  const affordColor = afford <= 33 ? TONE_COLORS.ok.text : afford <= 38 ? TONE_COLORS.warn.text : TONE_COLORS.bad.text;

  const r = (label: string, value: string, opt?: { bold?: boolean; muted?: boolean }) =>
    `<tr><td class="${opt?.muted ? "l-muted" : "l"}" style="${opt?.bold ? "font-weight:600;" : ""}">${escapeHtml(label)}</td><td style="${opt?.bold ? "font-weight:600;" : ""}">${value}</td></tr>`;
  const divider = `<tr><td colspan="2" style="border-top:1px solid #e5e7eb; padding:2px 0;"></td></tr>`;

  return `
    <div class="two-col">
      <div>
        <h3>Finanzierungsstruktur</h3>
        <table class="kv">
          ${r("Kaufpreis", fmt(purchase))}
          ${reno > 0 ? r("+ Renovationskosten", fmt(reno)) : ""}
          ${ownWork > 0 ? r("davon Eigenleistung", fmt(ownWork), { muted: true }) : ""}
          ${r("= Gesamtinvestition", fmt(total), { bold: true })}
          ${divider}
          ${r("Eigenmittel total", `${fmt(equity)} (${equityRatio.toFixed(1)}%)`)}
          ${r("davon Barvermögen", fmt(cash), { muted: true })}
          ${r("davon PK / Freizügigkeit", fmt(pension), { muted: true })}
          ${r("Hypothek gesamt", `${fmt(mortgage)} (${mortgageRatio.toFixed(1)}%)`)}
          ${r("1. Hypothek (≤ 65%)", fmt(firstMortgage), { muted: true })}
          ${r("2. Hypothek (65–80%)", fmt(secondMortgage), { muted: true })}
          ${r("Amortisation 2. Hypothek", `${fmt(amortYearly)} / Jahr (über 15 J.)`, { muted: true })}
        </table>
      </div>
      <div>
        <h3>Jahreskosten</h3>
        <table class="kv">
          ${r(`Kalk. Zinssatz (${rate.toFixed(1)}%)`, fmt(interestCost))}
          ${r("Nebenkosten (1%)", fmt(ancillary))}
          ${r("Amortisation", fmt(amortYearly))}
          ${divider}
          ${r("Total Wohnkosten p.a.", fmt(totalYearly), { bold: true })}
          ${r("Bruttoeinkommen p.a.", fmt(income))}
          ${divider}
          <tr><td class="l" style="font-weight:600;">Tragbarkeitsquote</td><td style="font-weight:700; color:${affordColor};">${afford.toFixed(1)}%</td></tr>
          ${r("Mindesteinkommen (33%)", fmt(minIncome), { muted: true })}
        </table>
      </div>
    </div>
  `;
}

// ---------- Vollständige Selbstauskunft (Vergleichstabelle Haupt- / Mitantragsteller) ----------

type DiscRow = {
  label: string;
  main: string;
  co: string;
  group?: boolean;
};

function discValue(a: Applicant | null | undefined, picker: (d: Disclosure, a: Applicant) => unknown): string {
  if (!a) return "—";
  const d = (a.disclosure ?? {}) as Disclosure;
  const v = picker(d, a);
  if (v == null || String(v).trim() === "") return "—";
  return escapeHtml(String(v));
}
function discDate(a: Applicant | null | undefined, picker: (d: Disclosure, a: Applicant) => string | null | undefined): string {
  if (!a) return "—";
  const d = (a.disclosure ?? {}) as Disclosure;
  return formatDateCH(picker(d, a));
}
function discMoney(a: Applicant | null | undefined, picker: (d: Disclosure, a: Applicant) => number | null | undefined): string {
  if (!a) return "—";
  const d = (a.disclosure ?? {}) as Disclosure;
  const v = picker(d, a);
  return fmt(v == null ? null : Number(v));
}

function disclosureCompareTable(main: Applicant, co?: Applicant | null): string {
  const fullName = (a: Applicant | null | undefined) => {
    if (!a) return "—";
    const d = a.disclosure;
    const n = [d?.first_name, d?.last_name].filter(Boolean).join(" ");
    return n || a.full_name || "—";
  };
  const addr = (a: Applicant | null | undefined) => {
    if (!a) return "—";
    const d = a.disclosure;
    const parts = [
      [d?.street, d?.street_number].filter(Boolean).join(" "),
      [d?.postal_code, d?.city].filter(Boolean).join(" "),
      d?.country,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : (a.address ?? "—");
  };

  const rows: DiscRow[] = [
    { label: "Persönliche Angaben", main: "", co: "", group: true },
    { label: "Anrede", main: discValue(main, (d) => d.salutation), co: discValue(co, (d) => d.salutation) },
    { label: "Name", main: escapeHtml(fullName(main)), co: escapeHtml(fullName(co)) },
    { label: "Geburtsname", main: discValue(main, (d) => d.birth_name), co: discValue(co, (d) => d.birth_name) },
    { label: "Geburtsdatum", main: discDate(main, (_d, a) => a.birth_date), co: discDate(co, (_d, a) => a.birth_date) },
    { label: "Geburtsort", main: discValue(main, (d) => d.birth_place), co: discValue(co, (d) => d.birth_place) },
    { label: "Geburtsland", main: discValue(main, (d) => d.birth_country), co: discValue(co, (d) => d.birth_country) },
    { label: "Nationalität", main: discValue(main, (d, a) => d.nationality ?? a.nationality), co: discValue(co, (d, a) => d.nationality ?? a.nationality) },
    { label: "Zivilstand", main: discValue(main, (d, a) => d.marital_status ?? a.marital_status), co: discValue(co, (d, a) => d.marital_status ?? a.marital_status) },
    { label: "Wohnhaft seit", main: discDate(main, (d) => d.resident_since), co: discDate(co, (d) => d.resident_since) },
    { label: "Steuer-ID (CH)", main: discValue(main, (d) => d.tax_id_ch), co: discValue(co, (d) => d.tax_id_ch) },

    { label: "Kontakt", main: "", co: "", group: true },
    { label: "Adresse", main: addr(main), co: addr(co) },
    { label: "Telefon", main: discValue(main, (d, a) => d.phone ?? a.phone), co: discValue(co, (d, a) => d.phone ?? a.phone) },
    { label: "Mobile", main: discValue(main, (d) => d.mobile), co: discValue(co, (d) => d.mobile) },
    { label: "E-Mail", main: discValue(main, (d, a) => d.email ?? a.email), co: discValue(co, (d, a) => d.email ?? a.email) },

    { label: "Anstellung", main: "", co: "", group: true },
    { label: "Status", main: discValue(main, (d, a) => d.employment_status ?? a.employment_status), co: discValue(co, (d, a) => d.employment_status ?? a.employment_status) },
    { label: "Funktion", main: discValue(main, (d) => d.employed_as), co: discValue(co, (d) => d.employed_as) },
    { label: "Arbeitgeber", main: discValue(main, (d, a) => d.employer_name ?? a.employer_name), co: discValue(co, (d, a) => d.employer_name ?? a.employer_name) },
    { label: "Adresse Arbeitgeber", main: discValue(main, (d) => d.employer_address), co: discValue(co, (d) => d.employer_address) },
    { label: "Telefon Arbeitgeber", main: discValue(main, (d) => d.employer_phone), co: discValue(co, (d) => d.employer_phone) },
    { label: "Angestellt seit", main: discDate(main, (d) => d.employed_since), co: discDate(co, (d) => d.employed_since) },
    { label: "Lohnart", main: discValue(main, (d) => d.salary_type), co: discValue(co, (d) => d.salary_type) },

    { label: "Einkommen (monatlich)", main: "", co: "", group: true },
    { label: "Nettolohn", main: discMoney(main, (d, a) => d.salary_net_monthly ?? a.salary_net_monthly), co: discMoney(co, (d, a) => d.salary_net_monthly ?? a.salary_net_monthly) },
    { label: "Zweiteinkommen", main: discMoney(main, (d) => d.income_job_two), co: discMoney(co, (d) => d.income_job_two) },
    { label: "Mieteinnahmen", main: discMoney(main, (d) => d.income_rental), co: discMoney(co, (d) => d.income_rental) },
    { label: "Weitere Einkünfte", main: discMoney(main, (d) => d.additional_income), co: discMoney(co, (d) => d.additional_income) },
    { label: "Total Einkommen (mtl.)", main: discMoney(main, (d, a) => d.total_income_monthly ?? a.total_income_monthly), co: discMoney(co, (d, a) => d.total_income_monthly ?? a.total_income_monthly) },
    { label: "Jahres-Nettolohn", main: discMoney(main, (d, a) => d.annual_net_salary ?? a.annual_net_salary), co: discMoney(co, (d, a) => d.annual_net_salary ?? a.annual_net_salary) },

    { label: "Ausgaben (monatlich)", main: "", co: "", group: true },
    { label: "Miete", main: discMoney(main, (d) => d.rent_expense), co: discMoney(co, (d) => d.rent_expense) },
    { label: "Hypothek", main: discMoney(main, (d) => d.mortgage_expense), co: discMoney(co, (d) => d.mortgage_expense) },
    { label: "Nebenkosten", main: discMoney(main, (d) => d.utilities_expense), co: discMoney(co, (d) => d.utilities_expense) },
    { label: "Steuern", main: discMoney(main, (d) => d.taxes_expense), co: discMoney(co, (d) => d.taxes_expense) },
    { label: "Krankenkasse", main: discMoney(main, (d) => d.health_insurance_expense), co: discMoney(co, (d) => d.health_insurance_expense) },
    { label: "Lebensversicherung", main: discMoney(main, (d) => d.life_insurance_expense), co: discMoney(co, (d) => d.life_insurance_expense) },
    { label: "Sachversicherung", main: discMoney(main, (d) => d.property_insurance_expense), co: discMoney(co, (d) => d.property_insurance_expense) },
    { label: "Telekom", main: discMoney(main, (d) => d.telecom_expense), co: discMoney(co, (d) => d.telecom_expense) },
    { label: "Leasing", main: discMoney(main, (d) => d.leasing_expense), co: discMoney(co, (d) => d.leasing_expense) },
    { label: "Kredite", main: discMoney(main, (d) => d.credit_expense), co: discMoney(co, (d) => d.credit_expense) },
    { label: "Alimente", main: discMoney(main, (d) => d.alimony_expense), co: discMoney(co, (d) => d.alimony_expense) },
    { label: "Lebenshaltung", main: discMoney(main, (d) => d.living_costs_expense), co: discMoney(co, (d) => d.living_costs_expense) },
    { label: "Sonstiges", main: discMoney(main, (d) => d.miscellaneous_expense), co: discMoney(co, (d) => d.miscellaneous_expense) },
    { label: "Total Ausgaben (mtl.)", main: discMoney(main, (d, a) => d.total_expenses_monthly ?? a.total_expenses_monthly), co: discMoney(co, (d, a) => d.total_expenses_monthly ?? a.total_expenses_monthly) },

    { label: "Reserve & Status", main: "", co: "", group: true },
    { label: "Verfügbare Reserve (mtl.)", main: discMoney(main, (d, a) => d.reserve_total ?? a.reserve_total), co: discMoney(co, (d, a) => d.reserve_total ?? a.reserve_total) },
    { label: "Reservequote", main: discValue(main, (d) => (d.reserve_ratio != null ? `${Number(d.reserve_ratio).toFixed(1)}%` : null)), co: discValue(co, (d) => (d.reserve_ratio != null ? `${Number(d.reserve_ratio).toFixed(1)}%` : null)) },
    { label: "Status Selbstauskunft", main: discValue(main, (d) => d.status), co: discValue(co, (d) => d.status) },
    { label: "Eingereicht am", main: discDate(main, (d) => d.submitted_at), co: discDate(co, (d) => d.submitted_at) },
    { label: "Geprüft am", main: discDate(main, (d) => d.reviewed_at), co: discDate(co, (d) => d.reviewed_at) },
  ];

  const mainHeader = escapeHtml(main.full_name ?? "Hauptantragsteller");
  const coHeader = co ? escapeHtml(co.full_name ?? "Mitantragsteller / Ehepartner") : "—";

  return `
    <table class="disc">
      <thead>
        <tr>
          <th class="disc-l">Feld</th>
          <th>Hauptantragsteller<div class="muted-sm">${mainHeader}</div></th>
          <th>Mitantragsteller / Ehepartner<div class="muted-sm">${coHeader}</div></th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((r) => {
            if (r.group) {
              return `<tr class="disc-group"><td colspan="3">${escapeHtml(r.label)}</td></tr>`;
            }
            return `<tr>
              <td class="disc-l">${escapeHtml(r.label)}</td>
              <td>${r.main}</td>
              <td>${r.co}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

export function buildBankPackageHtml(input: BankPackageInput): string {
  const locale: PackageLocale = input.locale ?? "de";
  const brand = input.brand ?? {};
  const primary = (brand.primary_color || "#324642").trim();
  const secondary = (brand.secondary_color || "#8a9a96").trim();
  const fontFamily = (
    brand.font_family || `-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
  ).trim();
  const companyName = (brand.company_name || "ASIMO").trim();
  const logoUrl = brand.logo_url ?? "";
  const today = new Date().toLocaleDateString("de-CH");
  const d = input.dossier;

  const financingTypeLabel = d.financing_type ? FINANCING_TYPE_LABELS[d.financing_type] : "—";
  const quickCheckLabel = d.quick_check_status ? QUICK_CHECK_LABELS[d.quick_check_status] : "—";
  const dossierStatusLabel = d.dossier_status ? DOSSIER_STATUS_LABELS[d.dossier_status] : "—";

  const CHECKLIST_SECTION_LABELS: Record<string, string> = {
    customer: "Kundenangaben",
    property_docs: "Objekt-Unterlagen",
    financing_structure: "Finanzierungsstruktur",
    income_employment: "Einkommen & Anstellung",
    tax: "Steuern",
    self_employed: "Selbstständige",
    affordability: "Tragbarkeit",
    additional_check: "Zusätzliche Prüfungen",
    submission_quality: "Einreichungsqualität",
    rejection_reasons: "Ablehnungsgründe",
  };
  const CHECKLIST_STATUS_LABELS: Record<string, { label: string; tag: string }> = {
    present: { label: "Vorhanden", tag: "ok" },
    complete: { label: "Vollständig", tag: "ok" },
    done: { label: "Erledigt", tag: "ok" },
    open: { label: "Offen", tag: "warn" },
    missing: { label: "Fehlt", tag: "warn" },
    pending: { label: "Ausstehend", tag: "warn" },
    not_relevant: { label: "Nicht relevant", tag: "neutral" },
    not_applicable: { label: "Nicht anwendbar", tag: "neutral" },
    rejected: { label: "Abgelehnt", tag: "bad" },
  };
  const sectionLabel = (k: string | null | undefined) =>
    !k ? "Allgemein" : (CHECKLIST_SECTION_LABELS[k] ?? k);
  const statusInfo = (k: string) =>
    CHECKLIST_STATUS_LABELS[k] ?? { label: k, tag: "neutral" };

  const checklistByGroup = new Map<string, ChecklistEntry[]>();
  for (const c of input.checklist) {
    const k = sectionLabel(c.section);
    const arr = checklistByGroup.get(k) ?? [];
    arr.push(c);
    checklistByGroup.set(k, arr);
  }

  const checklistHtml = input.checklist.length
    ? Array.from(checklistByGroup.entries())
        .map(
          ([group, items]) => `
        <h3>${escapeHtml(group)}</h3>
        <table class="kv">
          ${items
            .map((c) => {
              const s = statusInfo(c.status);
              return `<tr>
                  <td class="l">${escapeHtml(c.label)}</td>
                  <td>
                    <span class="tag ${s.tag}">${escapeHtml(s.label)}</span>
                    ${c.note ? `<div class="muted" style="margin-top:2px;">${escapeHtml(c.note)}</div>` : ""}
                  </td>
                </tr>`;
            })
            .join("")}
        </table>
      `,
        )
        .join("")
    : `<p class="muted">${t(locale, "no_checklist")}</p>`;

  const docsByFolder = new Map<string, DocumentInventoryEntry[]>();
  for (const doc of input.documents) {
    const arr = docsByFolder.get(doc.folder) ?? [];
    arr.push(doc);
    docsByFolder.set(doc.folder, arr);
  }
  const docsHtml = input.documents.length
    ? Array.from(docsByFolder.entries())
        .map(
          ([folder, items]) => `
        <h3>${escapeHtml(folder)} (${items.length})</h3>
        <ol style="padding-left:18px; margin:0 0 10px;">
          ${items
            .map(
              (i) =>
                `<li><span style="font-family:ui-monospace,Menlo,Consolas,monospace; font-size:11px;">${escapeHtml(i.filename)}</span>${
                  i.source ? ` <span class="muted">— ${escapeHtml(i.source)}</span>` : ""
                }</li>`,
            )
            .join("")}
        </ol>
      `,
        )
        .join("")
    : `<p class="muted">${t(locale, "no_docs")}</p>`;

  const coAppHtml = input.coApplicant
    ? applicantBlock(locale, input.coApplicant)
    : `<p class="muted">${t(locale, "no_coapp")}</p>`;

  const propertyHtml = input.property
    ? `
      <table class="kv">
        ${kv("Bezeichnung", dash(input.property.title))}
        ${kv("Adresse", dash([input.property.address, input.property.city].filter(Boolean).join(", ")))}
        ${kv("Typ", dash(input.property.type))}
        ${kv("Fläche", input.property.area != null ? `${input.property.area} m²` : "—")}
        ${kv("Zimmer", input.property.rooms != null ? String(input.property.rooms) : "—")}
      </table>
    `
    : `<p class="muted">${t(locale, "no_property")}</p>`;

  return `<!doctype html>
<html lang="${locale}-CH"><head><meta charset="utf-8"/>
<title>${escapeHtml(companyName)} – ${escapeHtml(t(locale, "title"))}</title>
<style>
  @page { size: A4; margin: 18mm 14mm 24mm; }
  * { box-sizing: border-box; }
  body { font-family: ${fontFamily}; color:#111827; font-size:11px; line-height:1.55; margin:0; }
  h1 { font-size:22px; margin:0 0 4px; color:${primary}; letter-spacing:-0.01em; }
  h2 { font-size:13px; margin:18px 0 8px; color:${primary}; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; padding-bottom:5px; border-bottom:1px solid ${hexAlpha(primary, 0.18)}; page-break-after:avoid; }
  h3 { font-size:12px; margin:10px 0 4px; color:${primary}; page-break-after:avoid; }
  table.kv { width:100%; border-collapse:collapse; }
  table.kv td { padding:5px 0; border-bottom:1px solid #f1f3f5; vertical-align:top; }
  table.kv td.l { color:#6b7280; width:38%; }
  .header { display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; margin-bottom:14px; border-bottom:2px solid ${primary}; }
  .header-left { display:flex; align-items:center; gap:12px; }
  .logo { max-height:42px; max-width:150px; object-fit:contain; }
  .brand-text { font-weight:700; font-size:16px; color:${primary}; letter-spacing:0.04em; }
  .meta { text-align:right; font-size:10px; color:#6b7280; line-height:1.5; }
  .muted { color:#6b7280; font-size:10.5px; }
  .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .box { border:1px solid ${hexAlpha(primary, 0.18)}; border-radius:8px; padding:9px 11px; background:${hexAlpha(primary, 0.04)}; }
  .box .label { color:#6b7280; font-size:9.5px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:3px; }
  .box .value { font-size:14px; font-weight:600; color:#111827; }
  .section { page-break-inside:avoid; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .tag { font-size:9.5px; padding:2px 7px; border-radius:999px; font-weight:600; letter-spacing:0.02em; }
  .tag.ok { background:#d1fae5; color:#065f46; }
  .tag.warn { background:#fef3c7; color:#92400e; }
  .tag.bad { background:#fee2e2; color:#991b1b; }
  .tag.neutral { background:#e5e7eb; color:#374151; }
  .footer { position:fixed; bottom:8mm; left:14mm; right:14mm; text-align:center; font-size:9px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:5px; }
  .notes-block { white-space:pre-wrap; background:${hexAlpha(secondary, 0.06)}; border-left:3px solid ${secondary}; padding:9px 12px; border-radius:6px; font-size:11px; color:#374151; }
  .kpi-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .kpi { border:1px solid ${hexAlpha(primary, 0.18)}; border-radius:8px; padding:10px 12px; background:#ffffff; }
  .kpi-head { display:flex; justify-content:space-between; align-items:baseline; }
  .kpi-label { font-size:10.5px; color:#6b7280; }
  .kpi-limit { font-size:9.5px; color:#9ca3af; }
  .kpi-value { font-size:22px; font-weight:700; margin:4px 0 8px; letter-spacing:-0.01em; }
  .kpi-bar { position:relative; height:8px; width:100%; background:#f1f3f5; border-radius:999px; overflow:hidden; }
  .kpi-bar-fill { position:absolute; left:0; top:0; height:100%; border-radius:999px; }
  .kpi-bar-limit { position:absolute; top:-2px; bottom:-2px; width:2px; background:#111827; opacity:0.65; }
  .disclosure-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  td.l-muted { color:#6b7280; width:38%; padding-left:12px; }
</style></head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)}"/>` : `<div class="brand-text">${escapeHtml(companyName)}</div>`}
      <div>
        <h1>${escapeHtml(t(locale, "title"))}</h1>
        <div class="muted">${escapeHtml(t(locale, "subtitle"))}</div>
      </div>
    </div>
    <div class="meta">
      ${escapeHtml(t(locale, "created_on"))} ${today}${input.agent_name ? `<br/>${escapeHtml(t(locale, "created_by"))} ${escapeHtml(input.agent_name)}` : ""}
      <br/>${escapeHtml(t(locale, "cover_for"))} ${escapeHtml(input.applicant.full_name ?? "—")}
      <br/><span style="font-family:ui-monospace,Menlo,Consolas,monospace; font-size:9px;">${escapeHtml(t(locale, "cover_dossier_id"))}: ${escapeHtml(d.id)}</span>
    </div>
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_overview"))}</h2>
    <table class="kv">
      ${kv(t(locale, "label_dossier"), dash(d.title))}
      ${kv(t(locale, "label_status"), escapeHtml(dossierStatusLabel))}
      ${kv(t(locale, "label_financing_type"), escapeHtml(financingTypeLabel))}
      ${kv(t(locale, "label_quick_check"), escapeHtml(quickCheckLabel))}
    </table>
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_financing"))}</h2>
    <div class="grid">
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_purchase"))}</div><div class="value">${fmt(d.purchase_price ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_renovation"))}</div><div class="value">${fmt(d.renovation_costs ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_own_work"))}</div><div class="value">${fmt(d.renovation_own_work ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_total_investment"))}</div><div class="value">${fmt(d.total_investment ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_mortgage"))}</div><div class="value">${fmt(d.requested_mortgage ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_equity_total"))}</div><div class="value">${fmt(d.own_funds_total ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_equity_combined"))}</div><div class="value">${fmt(d.eigenkapital_kombiniert ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_income_combined"))}</div><div class="value">${fmt(d.einkommen_kombiniert ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_pk_combined"))}</div><div class="value">${fmt(d.pk_anteil_kombiniert ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_ltv"))}</div><div class="value">${pct(d.loan_to_value_ratio ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_affordability"))}</div><div class="value">${pct(d.affordability_ratio ?? null)}</div></div>
      <div class="box"><div class="label">${escapeHtml(t(locale, "label_income_yearly"))}</div><div class="value">${fmt(d.gross_income_yearly ?? null)}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_vorpruefung"))}</h2>
    ${vorpruefungHtml(d)}
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_detailrechnung"))}</h2>
    ${detailRechnungHtml(d)}
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_applicants"))}</h2>
    <div class="two-col">
      <div>
        <h3>${escapeHtml(t(locale, "section_main_applicant"))}</h3>
        ${applicantBlock(locale, input.applicant)}
      </div>
      <div>
        <h3>${escapeHtml(t(locale, "section_co_applicant"))}</h3>
        ${coAppHtml}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_self_disclosure"))} – ${escapeHtml(t(locale, "section_main_applicant"))}</h2>
    ${disclosureBlock(input.applicant)}
  </div>

  ${
    input.coApplicant
      ? `<div class="section">
    <h2>${escapeHtml(t(locale, "section_self_disclosure"))} – ${escapeHtml(t(locale, "section_co_applicant"))}</h2>
    ${disclosureBlock(input.coApplicant)}
  </div>`
      : ""
  }

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_property"))}</h2>
    ${propertyHtml}
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_checklist"))}</h2>
    ${checklistHtml}
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_bank"))}</h2>
    <table class="kv">
      ${kv(t(locale, "label_bank_type"), dash(d.bank_type))}
      ${kv(t(locale, "label_bank_name"), dash(d.bank_name))}
      ${kv(t(locale, "label_bank_contact"), dash(d.bank_contact))}
      ${kv(t(locale, "label_bank_email"), dash(d.bank_email))}
      ${kv(t(locale, "label_bank_phone"), dash(d.bank_phone))}
      ${kv(t(locale, "label_submitted_at"), formatDateCH(d.submitted_to_bank_at))}
    </table>
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_notes"))}</h2>
    ${
      d.bank_notes
        ? `<h3>${escapeHtml(t(locale, "label_bank_notes"))}</h3><div class="notes-block">${escapeHtml(d.bank_notes)}</div>`
        : ""
    }
    ${
      d.internal_notes
        ? `<h3>${escapeHtml(t(locale, "label_internal_notes"))}</h3><div class="notes-block">${escapeHtml(d.internal_notes)}</div>`
        : ""
    }
    ${
      !d.bank_notes && !d.internal_notes
        ? `<p class="muted">${escapeHtml(t(locale, "no_notes"))}</p>`
        : ""
    }
  </div>

  <div class="section">
    <h2>${escapeHtml(t(locale, "section_documents"))}</h2>
    <p class="muted">${escapeHtml(t(locale, "inventory_intro"))}</p>
    ${docsHtml}
  </div>

  <div class="footer">${escapeHtml(companyName)} · ${escapeHtml(t(locale, "title"))} · ${today}</div>
</body></html>`;
}
