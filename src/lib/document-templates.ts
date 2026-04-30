// Document template variable substitution for mandates, reservations, NDAs and other documents.
// All available data sources auto-resolve from CRM (clients, properties, owners, relationships,
// reservations, mandates, financing, company profile, bank accounts).

import { formatCurrency, formatDate } from "@/lib/format";

export type TemplateContext = {
  client?: {
    full_name?: string | null;
    salutation?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    birth_date?: string | null;
    nationality?: string | null;
  } | null;
  // Second party (Mitkäufer, Ehepartner, Mitunterzeichner)
  partner?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    relationship?: string | null;
  } | null;
  property?: {
    title?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    price?: number | string | null;
    rent?: number | string | null;
    rooms?: number | string | null;
    living_area?: number | string | null;
    plot_area?: number | string | null;
    property_type?: string | null;
    year_built?: number | string | null;
  } | null;
  owner?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
  } | null;
  mandate?: {
    commission_model?: string | null;
    commission_value?: number | string | null;
    valid_from?: string | null;
    valid_until?: string | null;
    type?: string | null;
  } | null;
  reservation?: {
    reservation_fee?: number | string | null;
    valid_until?: string | null;
    payment_deadline?: string | null;
  } | null;
  nda?: {
    type?: string | null;
    valid_from?: string | null;
    valid_until?: string | null;
    purpose?: string | null;
  } | null;
  financing?: {
    bank_name?: string | null;
    bank_contact?: string | null;
    budget?: number | string | null;
    equity?: number | string | null;
    income?: number | string | null;
    approval_status?: string | null;
  } | null;
  company?: {
    name?: string | null;
    legal_name?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    uid_number?: string | null;
    commercial_register?: string | null;
    default_signatory_name?: string | null;
    default_signatory_role?: string | null;
    default_place?: string | null;
  } | null;
  bank?: {
    label?: string | null;
    bank_name?: string | null;
    account_holder?: string | null;
    iban?: string | null;
    bic?: string | null;
    purpose?: string | null;
  } | null;
  brand?: {
    company_name?: string | null;
    company_address?: string | null;
    company_email?: string | null;
    company_website?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    font_family?: string | null;
    header_html?: string | null;
    footer_html?: string | null;
  } | null;
  today?: string;
  place?: string;
};

// Default brand fallback (ASIMO)
export const DEFAULT_BRAND = {
  company_name: "ASIMO",
  company_address: "",
  company_email: "",
  company_website: "",
  logo_url: "",
  primary_color: "#324642",
  secondary_color: "#6A9387",
  font_family: "Helvetica Neue, Arial, sans-serif",
  header_html: "",
  footer_html: "",
} as const;

// Top-level alias keys (so templates can write {{logo_url}} instead of {{brand.logo_url}})
const BRAND_ALIASES: Record<string, keyof NonNullable<TemplateContext["brand"]>> = {
  company_name: "company_name",
  company_address: "company_address",
  company_email: "company_email",
  company_website: "company_website",
  logo_url: "logo_url",
  primary_color: "primary_color",
  secondary_color: "secondary_color",
  font_family: "font_family",
};


export const AVAILABLE_VARIABLES = [
  // Client
  { key: "client.full_name", label: "Kunde – Name", group: "Kunde" },
  { key: "client.salutation", label: "Kunde – Anrede", group: "Kunde" },
  { key: "client.address", label: "Kunde – Adresse", group: "Kunde" },
  { key: "client.postal_code", label: "Kunde – PLZ", group: "Kunde" },
  { key: "client.city", label: "Kunde – Ort", group: "Kunde" },
  { key: "client.email", label: "Kunde – E-Mail", group: "Kunde" },
  { key: "client.phone", label: "Kunde – Telefon", group: "Kunde" },
  { key: "client.birth_date", label: "Kunde – Geburtsdatum", group: "Kunde" },
  { key: "client.nationality", label: "Kunde – Nationalität", group: "Kunde" },
  // Partner
  { key: "partner.full_name", label: "Mitunterzeichner – Name", group: "Mitunterzeichner" },
  { key: "partner.address", label: "Mitunterzeichner – Adresse", group: "Mitunterzeichner" },
  { key: "partner.postal_code", label: "Mitunterzeichner – PLZ", group: "Mitunterzeichner" },
  { key: "partner.city", label: "Mitunterzeichner – Ort", group: "Mitunterzeichner" },
  { key: "partner.email", label: "Mitunterzeichner – E-Mail", group: "Mitunterzeichner" },
  { key: "partner.relationship", label: "Mitunterzeichner – Beziehung", group: "Mitunterzeichner" },
  // Property
  { key: "property.title", label: "Objekt – Titel", group: "Objekt" },
  { key: "property.address", label: "Objekt – Adresse", group: "Objekt" },
  { key: "property.postal_code", label: "Objekt – PLZ", group: "Objekt" },
  { key: "property.city", label: "Objekt – Ort", group: "Objekt" },
  { key: "property.price", label: "Objekt – Verkaufspreis", group: "Objekt" },
  { key: "property.rent", label: "Objekt – Mietpreis", group: "Objekt" },
  { key: "property.rooms", label: "Objekt – Zimmer", group: "Objekt" },
  { key: "property.living_area", label: "Objekt – Wohnfläche", group: "Objekt" },
  { key: "property.plot_area", label: "Objekt – Grundstücksfläche", group: "Objekt" },
  { key: "property.property_type", label: "Objekt – Typ", group: "Objekt" },
  { key: "property.year_built", label: "Objekt – Baujahr", group: "Objekt" },
  // Owner
  { key: "owner.full_name", label: "Eigentümer – Name", group: "Eigentümer" },
  { key: "owner.address", label: "Eigentümer – Adresse", group: "Eigentümer" },
  { key: "owner.postal_code", label: "Eigentümer – PLZ", group: "Eigentümer" },
  { key: "owner.city", label: "Eigentümer – Ort", group: "Eigentümer" },
  { key: "owner.email", label: "Eigentümer – E-Mail", group: "Eigentümer" },
  { key: "owner.phone", label: "Eigentümer – Telefon", group: "Eigentümer" },
  // Mandate
  { key: "mandate.commission_value", label: "Mandat – Provisionswert", group: "Mandat" },
  { key: "mandate.commission_model", label: "Mandat – Provisionsmodell", group: "Mandat" },
  { key: "mandate.valid_from", label: "Mandat – Gültig ab", group: "Mandat" },
  { key: "mandate.valid_until", label: "Mandat – Gültig bis", group: "Mandat" },
  { key: "mandate.type", label: "Mandat – Typ", group: "Mandat" },
  // Reservation
  { key: "reservation.reservation_fee", label: "Reservation – Gebühr", group: "Reservation" },
  { key: "reservation.valid_until", label: "Reservation – Gültig bis", group: "Reservation" },
  { key: "reservation.payment_deadline", label: "Reservation – Zahlungsfrist", group: "Reservation" },
  // NDA
  { key: "nda.type", label: "NDA – Typ", group: "NDA" },
  { key: "nda.valid_from", label: "NDA – Gültig ab", group: "NDA" },
  { key: "nda.valid_until", label: "NDA – Gültig bis", group: "NDA" },
  { key: "nda.purpose", label: "NDA – Zweck", group: "NDA" },
  // Financing
  { key: "financing.bank_name", label: "Finanzierung – Bank", group: "Finanzierung" },
  { key: "financing.bank_contact", label: "Finanzierung – Kontakt", group: "Finanzierung" },
  { key: "financing.budget", label: "Finanzierung – Budget", group: "Finanzierung" },
  { key: "financing.equity", label: "Finanzierung – Eigenkapital", group: "Finanzierung" },
  // Company
  { key: "company.name", label: "Firma – Name", group: "Firma" },
  { key: "company.legal_name", label: "Firma – Rechtlicher Name", group: "Firma" },
  { key: "company.address", label: "Firma – Adresse", group: "Firma" },
  { key: "company.postal_code", label: "Firma – PLZ", group: "Firma" },
  { key: "company.city", label: "Firma – Ort", group: "Firma" },
  { key: "company.phone", label: "Firma – Telefon", group: "Firma" },
  { key: "company.email", label: "Firma – E-Mail", group: "Firma" },
  { key: "company.website", label: "Firma – Webseite", group: "Firma" },
  { key: "company.uid_number", label: "Firma – UID-Nummer", group: "Firma" },
  { key: "company.default_signatory_name", label: "Firma – Unterzeichner Name", group: "Firma" },
  { key: "company.default_signatory_role", label: "Firma – Unterzeichner Funktion", group: "Firma" },
  // Bank
  { key: "bank.label", label: "Bank – Bezeichnung", group: "Bankkonto" },
  { key: "bank.bank_name", label: "Bank – Name", group: "Bankkonto" },
  { key: "bank.account_holder", label: "Bank – Inhaber", group: "Bankkonto" },
  { key: "bank.iban", label: "Bank – IBAN", group: "Bankkonto" },
  { key: "bank.bic", label: "Bank – BIC", group: "Bankkonto" },
  // Misc
  { key: "today", label: "Heutiges Datum", group: "Allgemein" },
  { key: "place", label: "Ort", group: "Allgemein" },
] as const;

const NUMERIC_KEYS = new Set([
  "property.price",
  "property.rent",
  "mandate.commission_value",
  "reservation.reservation_fee",
  "financing.budget",
  "financing.equity",
  "financing.income",
]);
const DATE_KEYS = new Set([
  "mandate.valid_from",
  "mandate.valid_until",
  "reservation.valid_until",
  "reservation.payment_deadline",
  "nda.valid_from",
  "nda.valid_until",
  "client.birth_date",
  "today",
]);

function getValue(ctx: TemplateContext, path: string): string {
  // Checkbox helpers: {{check.<key>}} returns ☑ or ☐ depending on overrides.checks
  if (path.startsWith("check.")) {
    const key = path.slice("check.".length);
    const map = (ctx as TemplateContext & { checks?: Record<string, boolean> }).checks ?? {};
    return map[key] ? "☑" : "☐";
  }

  // Brand alias resolution: {{logo_url}} → ctx.brand.logo_url (with default fallback)
  if (BRAND_ALIASES[path]) {
    const key = BRAND_ALIASES[path];
    const v = ctx.brand?.[key] ?? DEFAULT_BRAND[key];
    return v ? String(v) : "";
  }

  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return "";
    }
  }
  if (cur === null || cur === undefined || cur === "") return "";

  if (NUMERIC_KEYS.has(path)) {
    const n = typeof cur === "number" ? cur : Number(cur);
    if (Number.isFinite(n)) {
      if (path === "mandate.commission_value") return String(n);
      return formatCurrency(n) ?? String(n);
    }
  }
  if (DATE_KEYS.has(path)) {
    return formatDate(String(cur)) ?? String(cur);
  }
  return String(cur);
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  const fullCtx: TemplateContext = {
    ...ctx,
    today: ctx.today ?? new Date().toISOString(),
  };
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) =>
    getValue(fullCtx, String(path)),
  );
}

/**
 * Find which variables in a template are not resolvable from the given context.
 * Used by wizards to ask the user only for missing values.
 */
export function findMissingVariables(template: string, ctx: TemplateContext): string[] {
  const used = new Set<string>();
  template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
    used.add(String(path));
    return "";
  });
  const missing: string[] = [];
  for (const path of used) {
    // Brand aliases & checkbox helpers are always resolvable → skip
    if (BRAND_ALIASES[path]) continue;
    if (path.startsWith("check.")) continue;
    if (!getValue(ctx, path)) missing.push(path);
  }
  return missing;
}

export function wrapHtmlDocument(
  title: string,
  bodyHtml: string,
  brand?: TemplateContext["brand"] | null,
  options?: { customCss?: string | null },
): string {
  const b = { ...DEFAULT_BRAND, ...(brand ?? {}) };
  const primary = b.primary_color || DEFAULT_BRAND.primary_color;
  const secondary = b.secondary_color || DEFAULT_BRAND.secondary_color;
  const font = b.font_family || DEFAULT_BRAND.font_family;
  const companyName = escapeAttr(b.company_name || "");
  const customCss = (options?.customCss ?? "").toString();

  const headerHtml = b.header_html
    ? b.header_html
    : `<div class="doc-header">
         <div class="doc-header__brand">
           ${
             b.logo_url
               ? `<img src="${escapeAttr(b.logo_url)}" alt="${companyName}" class="doc-logo" />`
               : `<div class="doc-wordmark">${companyName}</div>`
           }
         </div>
         <div class="doc-header__meta">
           <div class="doc-header__company">${companyName}</div>
           ${b.company_address ? `<div>${escapeAttr(b.company_address)}</div>` : ""}
           ${b.company_email ? `<div>${escapeAttr(b.company_email)}</div>` : ""}
           ${b.company_website ? `<div>${escapeAttr(b.company_website)}</div>` : ""}
         </div>
       </div>`;

  const footerHtml = b.footer_html
    ? b.footer_html
    : `<div class="doc-footer">
         <span>${companyName}</span>
         ${b.company_website ? `<span> · ${escapeAttr(b.company_website)}</span>` : ""}
         ${b.company_email ? `<span> · ${escapeAttr(b.company_email)}</span>` : ""}
       </div>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${title.replace(/</g, "&lt;")}</title>
<style>
  @page {
    size: A4;
    margin: 22mm 18mm 22mm 18mm;
  }
  :root {
    --brand-primary: ${primary};
    --brand-secondary: ${secondary};
    --brand-soft: color-mix(in oklab, ${primary} 6%, white);
    --text: #1a1a1a;
    --text-muted: #5b6770;
    --border: #d9dee2;
    --rule: ${secondary};
  }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    font-family: ${font};
    color: var(--text);
    line-height: 1.55;
    font-size: 11pt;
    margin: 0 auto;
    padding: 0;
    max-width: 800px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-shell { padding: 0 4mm; }

  /* Header */
  .doc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding-bottom: 14px;
    margin-bottom: 22px;
    border-bottom: 2px solid var(--brand-primary);
  }
  .doc-logo { height: 48px; width: auto; display: block; }
  .doc-wordmark {
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.04em;
    color: var(--brand-primary);
    text-transform: uppercase;
  }
  .doc-header__meta {
    text-align: right;
    font-size: 10pt;
    color: var(--text-muted);
    line-height: 1.45;
  }
  .doc-header__company { color: var(--brand-primary); font-weight: 600; }

  /* Title block */
  .doc-title { margin: 0 0 6px; }
  h1 {
    font-size: 22pt;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--brand-primary);
    letter-spacing: -0.01em;
  }
  h2 {
    font-size: 12pt;
    font-weight: 700;
    margin: 22px 0 10px;
    color: var(--brand-primary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--brand-secondary);
  }
  h3 {
    font-size: 11pt;
    font-weight: 600;
    margin: 14px 0 6px;
    color: var(--brand-primary);
  }
  p { margin: 6px 0; }
  strong { color: var(--brand-primary); font-weight: 600; }
  hr { border: 0; border-top: 1px solid var(--border); margin: 18px 0; }

  /* Tables — structured data */
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10.5pt; }
  th, td { text-align: left; padding: 7px 9px; vertical-align: top; }
  table.data th {
    width: 38%;
    color: var(--text-muted);
    font-weight: 500;
    background: var(--brand-soft);
    border-bottom: 1px solid var(--border);
  }
  table.data td {
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  /* Two-column grid */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin: 8px 0 14px;
  }
  .panel {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px 14px;
    background: #fff;
    page-break-inside: avoid;
  }
  .panel h3 {
    margin-top: 0;
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--brand-primary);
  }
  .panel .label { font-size: 9pt; color: var(--text-muted); display: block; margin-top: 6px; }
  .panel .value { font-size: 11pt; color: var(--text); }

  /* Numbered sections */
  .section { page-break-inside: avoid; margin-top: 16px; }
  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12pt;
    font-weight: 700;
    color: var(--brand-primary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 22px 0 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--brand-secondary);
  }
  .section-title .num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border-radius: 4px;
    background: var(--brand-primary);
    color: #fff;
    font-weight: 700;
    font-size: 10pt;
  }

  /* Checkboxes */
  .checks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 18px; margin: 6px 0; }
  .check { font-size: 10.5pt; line-height: 1.6; }
  .check .box-icon { font-size: 12pt; margin-right: 6px; color: var(--brand-primary); }

  .box {
    border-left: 4px solid var(--brand-secondary);
    padding: 10px 14px;
    margin: 12px 0;
    background: var(--brand-soft);
    border-radius: 0 4px 4px 0;
    page-break-inside: avoid;
  }

  .muted { color: var(--text-muted); font-size: 10pt; }

  /* Signatures */
  .signature {
    margin-top: 36px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    page-break-inside: avoid;
  }
  .signature .sig-line {
    border-top: 1px solid var(--text);
    padding-top: 6px;
    font-size: 10pt;
    color: var(--text-muted);
  }
  .signature .sig-name { color: var(--text); font-weight: 600; }

  /* Footer */
  .doc-footer {
    margin-top: 32px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    font-size: 8.5pt;
    color: var(--text-muted);
    text-align: center;
  }

  /* Pagination */
  .page-break { page-break-after: always; break-after: page; }
  h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
  table, .panel, .section, .signature, .box { page-break-inside: avoid; break-inside: avoid; }

  ${customCss || ""}
</style>
</head>
<body>
<div class="doc-shell">
${headerHtml}
${bodyHtml}
${footerHtml}
</div>
</body>
</html>`;
}

function escapeAttr(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


/* ---------- Helpers used inside templates ---------- */
// Templates are pure HTML strings (no JS). Checkbox states are rendered via
// {{var}} substitution: if the variable resolves to a truthy value it shows ☑,
// otherwise ☐. We expose helper variables for the property type checkboxes via
// the wizard's `overrides.checks` payload (see MandateWizard).

const MANDATE_INTRO = `
<h1 class="doc-title">Maklermandat</h1>
<p class="muted">Verkaufsvermittlungsauftrag · {{mandate.type}}</p>
<p class="muted">Ausgestellt am {{today}} in {{company.default_place}}</p>
`;

const MANDATE_PARTIES_GRID = `
<div class="grid-2">
  <div class="panel">
    <h3>Auftraggeber</h3>
    <span class="label">Name</span>
    <div class="value"><strong>{{client.full_name}}</strong></div>
    <span class="label">Adresse</span>
    <div class="value">{{client.address}}<br/>{{client.postal_code}} {{client.city}}</div>
    <span class="label">Kontakt</span>
    <div class="value">{{client.email}} · {{client.phone}}</div>
  </div>
  <div class="panel">
    <h3>Auftragnehmer</h3>
    <span class="label">Firma</span>
    <div class="value"><strong>{{company.legal_name}}</strong></div>
    <span class="label">Adresse</span>
    <div class="value">{{company.address}}<br/>{{company.postal_code}} {{company.city}}</div>
    <span class="label">Kontakt</span>
    <div class="value">{{company.email}} · {{company.phone}}</div>
    <span class="label">UID</span>
    <div class="value">{{company.uid_number}}</div>
  </div>
</div>
`;

const MANDATE_OBJECT_GRID = `
<div class="grid-2">
  <div class="panel">
    <h3>Vermittlungsobjekt</h3>
    <span class="label">Bezeichnung</span>
    <div class="value"><strong>{{property.title}}</strong></div>
    <span class="label">Adresse</span>
    <div class="value">{{property.address}}<br/>{{property.postal_code}} {{property.city}}</div>
    <span class="label">Verkaufspreis</span>
    <div class="value"><strong>{{property.price}}</strong></div>
  </div>
  <div class="panel">
    <h3>Eckdaten</h3>
    <span class="label">Wohnfläche</span>
    <div class="value">{{property.living_area}} m²</div>
    <span class="label">Zimmer</span>
    <div class="value">{{property.rooms}}</div>
    <span class="label">Grundstück</span>
    <div class="value">{{property.plot_area}} m²</div>
    <span class="label">Baujahr</span>
    <div class="value">{{property.year_built}}</div>
  </div>
</div>

<h3>Objektart</h3>
<div class="checks">
  <div class="check"><span class="box-icon">{{check.house}}</span> Einfamilienhaus</div>
  <div class="check"><span class="box-icon">{{check.apartment}}</span> Eigentumswohnung</div>
  <div class="check"><span class="box-icon">{{check.multifamily}}</span> Mehrfamilienhaus</div>
  <div class="check"><span class="box-icon">{{check.commercial}}</span> Gewerbeobjekt</div>
  <div class="check"><span class="box-icon">{{check.land}}</span> Grundstück / Bauland</div>
  <div class="check"><span class="box-icon">{{check.other}}</span> Sonstiges</div>
</div>
`;

const MANDATE_SIGNATURES = `
<div class="signature">
  <div class="sig-line">
    <div class="sig-name">{{client.full_name}}</div>
    Auftraggeber · {{company.default_place}}, den {{today}}
  </div>
  <div class="sig-line">
    <div class="sig-name">{{company.default_signatory_name}}</div>
    {{company.default_signatory_role}} · {{company.name}}
  </div>
</div>
`;

export const DEFAULT_MANDATE_TEMPLATE = `${MANDATE_INTRO}
${MANDATE_PARTIES_GRID}

<div class="section-title"><span class="num">1</span> Vertragsgegenstand</div>
<p>Der Auftraggeber beauftragt den Auftragnehmer mit der <strong>exklusiven</strong> Vermittlung des nachstehend bezeichneten Objekts. Während der Laufzeit dieses Mandats ist der Auftraggeber nicht berechtigt, weitere Makler oder Vermittler mit der Vermarktung des Objekts zu beauftragen.</p>
${MANDATE_OBJECT_GRID}

<div class="section-title"><span class="num">2</span> Provision</div>
<table class="data">
  <tr><th>Provisionsmodell</th><td>{{mandate.commission_model}}</td></tr>
  <tr><th>Provisionssatz / Pauschale</th><td><strong>{{mandate.commission_value}}</strong></td></tr>
  <tr><th>Berechnungsbasis</th><td>Notariell beurkundeter Kaufpreis (zzgl. ges. MwSt.)</td></tr>
  <tr><th>Fälligkeit</th><td>Mit Abschluss des Kaufvertrages, spätestens bei Eigentumsübertragung</td></tr>
</table>

<div class="section-title"><span class="num">3</span> Laufzeit & Verlängerung</div>
<p>Dieses Mandat tritt am <strong>{{mandate.valid_from}}</strong> in Kraft und endet am <strong>{{mandate.valid_until}}</strong>. Wird das Mandat nicht spätestens 30 Tage vor Ablauf schriftlich gekündigt, verlängert es sich stillschweigend um jeweils drei Monate.</p>

<div class="section-title"><span class="num">4</span> Pflichten des Auftragnehmers</div>
<p>Der Auftragnehmer verpflichtet sich, das Objekt fachgerecht und mit der Sorgfalt eines ordentlichen Maklers zu vermarkten. Dies umfasst insbesondere:</p>
<ul>
  <li>Erstellung eines professionellen Exposés inkl. hochwertiger Fotos</li>
  <li>Listing auf relevanten Plattformen (ImmoScout24, Homegate, Newhome u. a.)</li>
  <li>Qualifizierung von Interessenten und Bonitätsprüfung</li>
  <li>Organisation und Durchführung der Besichtigungen</li>
  <li>Verhandlungsführung und Begleitung bis zur Beurkundung</li>
</ul>

<div class="section-title"><span class="num">5</span> Pflichten des Auftraggebers</div>
<p>Der Auftraggeber stellt dem Auftragnehmer alle für die Vermittlung erforderlichen Unterlagen vollständig und wahrheitsgemäss zur Verfügung. Er verpflichtet sich, alle Anfragen, die ihn direkt erreichen, unverzüglich an den Auftragnehmer weiterzuleiten.</p>

<div class="section-title"><span class="num">6</span> Datenschutz & Vertraulichkeit</div>
<p>Beide Parteien verpflichten sich zur vertraulichen Behandlung aller im Rahmen dieses Mandats ausgetauschten Informationen. Personenbezogene Daten werden ausschliesslich zum Zweck der Vertragserfüllung gemäss DSGVO und revDSG verarbeitet.</p>

<div class="section-title"><span class="num">7</span> Schlussbestimmungen</div>
<p>Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Gerichtsstand ist {{company.default_place}}, anwendbar ist Schweizer Recht.</p>

${MANDATE_SIGNATURES}
`;

export const DEFAULT_MANDATE_PARTIAL_TEMPLATE = `${MANDATE_INTRO}
${MANDATE_PARTIES_GRID}

<div class="section-title"><span class="num">1</span> Vertragsgegenstand</div>
<p>Der Auftraggeber beauftragt den Auftragnehmer mit der <strong>teilexklusiven</strong> Vermittlung des unten bezeichneten Objekts. Der Auftraggeber behält das Recht, einen eigenen Käufer zu vermitteln, ohne dass ein Provisionsanspruch des Auftragnehmers entsteht. Die Beauftragung weiterer Makler ist ausgeschlossen.</p>
${MANDATE_OBJECT_GRID}

<div class="section-title"><span class="num">2</span> Provision</div>
<table class="data">
  <tr><th>Provisionsmodell</th><td>{{mandate.commission_model}}</td></tr>
  <tr><th>Provisionssatz / Pauschale</th><td><strong>{{mandate.commission_value}}</strong></td></tr>
  <tr><th>Berechnungsbasis</th><td>Notariell beurkundeter Kaufpreis (zzgl. ges. MwSt.)</td></tr>
  <tr><th>Fälligkeit</th><td>Mit Abschluss des Kaufvertrages</td></tr>
</table>
<div class="box"><strong>Eigenvermittlung:</strong> Findet der Auftraggeber selbst einen Käufer, ist keine Provision geschuldet. Der Auftraggeber informiert den Auftragnehmer hierüber unverzüglich.</div>

<div class="section-title"><span class="num">3</span> Laufzeit & Verlängerung</div>
<p>Dieses Mandat ist gültig vom <strong>{{mandate.valid_from}}</strong> bis zum <strong>{{mandate.valid_until}}</strong>. Eine stillschweigende Verlängerung erfolgt nicht.</p>

<div class="section-title"><span class="num">4</span> Pflichten des Auftragnehmers</div>
<p>Professionelle Vermarktung gemäss Standard des Maklers, inklusive Exposé, Online-Listings, Interessentenqualifizierung, Besichtigungen und Verhandlungsbegleitung.</p>

<div class="section-title"><span class="num">5</span> Pflichten des Auftraggebers</div>
<p>Bereitstellung aller relevanten Objektunterlagen sowie unverzügliche Weiterleitung sämtlicher direkt eingehender Anfragen, sofern diese nicht aus eigener Vermittlung stammen.</p>

<div class="section-title"><span class="num">6</span> Datenschutz & Vertraulichkeit</div>
<p>Beide Parteien behandeln alle ausgetauschten Informationen vertraulich. Datenverarbeitung erfolgt gemäss DSGVO und revDSG.</p>

<div class="section-title"><span class="num">7</span> Schlussbestimmungen</div>
<p>Änderungen bedürfen der Schriftform. Gerichtsstand: {{company.default_place}}. Es gilt Schweizer Recht.</p>

${MANDATE_SIGNATURES}
`;

export const DEFAULT_RESERVATION_TEMPLATE = `<h1>Reservationsvereinbarung</h1>
<p class="muted">Datum: {{today}} – Ort: {{company.default_place}}</p>

<h2>Reservierende Partei</h2>
<p>{{client.full_name}}<br/>{{client.address}}<br/>{{client.postal_code}} {{client.city}}<br/>E-Mail: {{client.email}} – Telefon: {{client.phone}}</p>

<h2>Reserviertes Objekt</h2>
<p><strong>{{property.title}}</strong><br/>{{property.address}}, {{property.postal_code}} {{property.city}}</p>
<p>Kaufpreis: <strong>{{property.price}}</strong></p>

<h2>Reservationsbedingungen</h2>
<p>Reservationsgebühr: <strong>{{reservation.reservation_fee}}</strong><br/>Reservation gültig bis: <strong>{{reservation.valid_until}}</strong><br/>Zahlungsfrist: {{reservation.payment_deadline}}</p>

<h2>Zahlungsdetails</h2>
<p>Bank: {{bank.bank_name}}<br/>Inhaber: {{bank.account_holder}}<br/>IBAN: <strong>{{bank.iban}}</strong><br/>BIC: {{bank.bic}}<br/>Verwendungszweck: {{bank.purpose}}</p>

<hr/>
<p>Die reservierende Partei sichert sich mit dieser Vereinbarung das ausschliessliche Vorkaufsrecht am oben genannten Objekt bis zum genannten Datum.</p>

<div class="signature">
  <div>{{client.full_name}}</div>
  <div>{{company.default_signatory_name}} – {{company.name}}</div>
</div>`;

export const DEFAULT_RESERVATION_RECEIPT_TEMPLATE = `<h1>Quittung – Reservationsgebühr</h1>
<p class="muted">Datum: {{today}} – Ort: {{company.default_place}}</p>

<p>Hiermit bestätigen wir den Erhalt der Reservationsgebühr in Höhe von <strong>{{reservation.reservation_fee}}</strong> für das Objekt <strong>{{property.title}}</strong>, {{property.address}}, {{property.postal_code}} {{property.city}}.</p>

<table>
  <tr><th>Reservierende Partei</th><td>{{client.full_name}}, {{client.address}}, {{client.postal_code}} {{client.city}}</td></tr>
  <tr><th>Betrag</th><td><strong>{{reservation.reservation_fee}}</strong></td></tr>
  <tr><th>Eingang auf Konto</th><td>{{bank.iban}} ({{bank.bank_name}})</td></tr>
  <tr><th>Reservation gültig bis</th><td>{{reservation.valid_until}}</td></tr>
</table>

<div class="signature">
  <div>{{client.full_name}}</div>
  <div>{{company.default_signatory_name}} – {{company.name}}</div>
</div>`;

export const DEFAULT_NDA_TEMPLATE = `<h1>Vertraulichkeitsvereinbarung (NDA)</h1>
<p class="muted">Datum: {{today}} – Ort: {{company.default_place}}</p>

<h2>Parteien</h2>
<p><strong>Empfangende Partei:</strong><br/>{{client.full_name}}<br/>{{client.address}}, {{client.postal_code}} {{client.city}}</p>
<p><strong>Offenlegende Partei:</strong><br/>{{company.legal_name}}<br/>{{company.address}}, {{company.postal_code}} {{company.city}}</p>

<h2>Gegenstand</h2>
<p>Diese Vereinbarung regelt die Behandlung vertraulicher Informationen im Rahmen folgender Tätigkeit: <strong>{{nda.purpose}}</strong>.</p>
<p>Bezug zum Objekt (sofern zutreffend): {{property.title}}, {{property.address}}, {{property.postal_code}} {{property.city}}.</p>

<h2>Pflichten</h2>
<p>Die empfangende Partei verpflichtet sich, alle erhaltenen Informationen vertraulich zu behandeln, ausschliesslich für den genannten Zweck zu verwenden und nicht ohne schriftliche Zustimmung an Dritte weiterzugeben.</p>

<h2>Laufzeit</h2>
<p>Diese Vereinbarung ist gültig von {{nda.valid_from}} bis {{nda.valid_until}}.</p>

<div class="signature">
  <div>{{client.full_name}}</div>
  <div>{{company.default_signatory_name}} – {{company.name}}</div>
</div>`;

export function defaultTemplateForType(type: string): string {
  switch (type) {
    case "mandate":
      return DEFAULT_MANDATE_TEMPLATE;
    case "mandate_partial":
      return DEFAULT_MANDATE_PARTIAL_TEMPLATE;
    case "reservation":
      return DEFAULT_RESERVATION_TEMPLATE;
    case "reservation_receipt":
      return DEFAULT_RESERVATION_RECEIPT_TEMPLATE;
    case "nda":
      return DEFAULT_NDA_TEMPLATE;
    default:
      return "";
  }
}
