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
    if (!getValue(ctx, path)) missing.push(path);
  }
  return missing;
}

export function wrapHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${title.replace(/</g, "&lt;")}</title>
<style>
  @page { size: A4; margin: 24mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; line-height: 1.55; max-width: 780px; margin: 32px auto; padding: 0 24px; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  p { margin: 8px 0; }
  hr { border: 0; border-top: 1px solid #e5e5e5; margin: 24px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 14px; }
  .muted { color: #666; font-size: 12px; }
  .signature { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .signature div { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }
  @media print {
    body { margin: 0; padding: 0; max-width: none; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export const DEFAULT_MANDATE_TEMPLATE = `<h1>Maklervertrag (Verkaufsmandat)</h1>
<p class="muted">Datum: {{today}} – Ort: {{company.default_place}}</p>

<h2>Auftraggeber</h2>
<p>{{client.full_name}}<br/>{{client.address}}<br/>{{client.postal_code}} {{client.city}}<br/>E-Mail: {{client.email}} – Telefon: {{client.phone}}</p>

<h2>Auftragnehmer</h2>
<p>{{company.legal_name}}<br/>{{company.address}}<br/>{{company.postal_code}} {{company.city}}<br/>UID: {{company.uid_number}}</p>

<h2>Objekt</h2>
<p><strong>{{property.title}}</strong><br/>{{property.address}}, {{property.postal_code}} {{property.city}}</p>
<p>Verkaufspreis: <strong>{{property.price}}</strong> – Wohnfläche: {{property.living_area}} m² – Zimmer: {{property.rooms}}</p>

<h2>Provision</h2>
<p>Modell: {{mandate.commission_model}}<br/>Provision: <strong>{{mandate.commission_value}}</strong></p>

<h2>Laufzeit</h2>
<p>Gültig von {{mandate.valid_from}} bis {{mandate.valid_until}}.</p>

<hr/>
<p>Mit der Unterzeichnung erteilt der Auftraggeber dem Auftragnehmer den Auftrag, das oben genannte Objekt zu vermarkten.</p>

<div class="signature">
  <div>{{client.full_name}} – Auftraggeber</div>
  <div>{{company.default_signatory_name}} – {{company.default_signatory_role}}, {{company.name}}</div>
</div>`;

export const DEFAULT_MANDATE_PARTIAL_TEMPLATE = `<h1>Teilexklusiver Maklerauftrag</h1>
<p class="muted">Datum: {{today}} – Ort: {{company.default_place}}</p>

<h2>Auftraggeber</h2>
<p>{{client.full_name}}<br/>{{client.address}}<br/>{{client.postal_code}} {{client.city}}</p>

<h2>Auftragnehmer</h2>
<p>{{company.legal_name}}<br/>{{company.address}}<br/>{{company.postal_code}} {{company.city}}</p>

<h2>Objekt</h2>
<p><strong>{{property.title}}</strong><br/>{{property.address}}, {{property.postal_code}} {{property.city}}<br/>Verkaufspreis: <strong>{{property.price}}</strong></p>

<h2>Provision</h2>
<p>Modell: {{mandate.commission_model}} – Wert: <strong>{{mandate.commission_value}}</strong></p>

<h2>Besonderheit</h2>
<p>Diese Vereinbarung ist <strong>teilexklusiv</strong>. Der Auftraggeber behält das Recht, einen eigenen Käufer ohne Provisionsanspruch des Maklers zu vermitteln.</p>

<h2>Laufzeit</h2>
<p>Gültig von {{mandate.valid_from}} bis {{mandate.valid_until}}.</p>

<div class="signature">
  <div>{{client.full_name}}</div>
  <div>{{company.default_signatory_name}} – {{company.name}}</div>
</div>`;

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
