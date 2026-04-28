// Document template variable substitution for mandates, reservations, and other documents.

import { formatCurrency, formatDate } from "@/lib/format";

export type TemplateContext = {
  client?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country?: string | null;
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
  } | null;
  mandate?: {
    commission_model?: string | null;
    commission_value?: number | string | null;
    valid_from?: string | null;
    valid_until?: string | null;
  } | null;
  reservation?: {
    reservation_fee?: number | string | null;
    valid_until?: string | null;
  } | null;
  company?: { name?: string | null } | null;
  today?: string;
};

export const AVAILABLE_VARIABLES = [
  { key: "client.full_name", label: "Kundenname" },
  { key: "client.address", label: "Kundenadresse" },
  { key: "client.postal_code", label: "Kunde PLZ" },
  { key: "client.city", label: "Kunde Ort" },
  { key: "client.email", label: "Kunde E-Mail" },
  { key: "client.phone", label: "Kunde Telefon" },
  { key: "property.title", label: "Objekt-Titel" },
  { key: "property.address", label: "Objekt-Adresse" },
  { key: "property.city", label: "Objekt-Ort" },
  { key: "property.price", label: "Verkaufspreis" },
  { key: "property.rent", label: "Mietpreis" },
  { key: "property.rooms", label: "Zimmer" },
  { key: "property.living_area", label: "Wohnfläche" },
  { key: "mandate.commission_value", label: "Provisionswert" },
  { key: "mandate.commission_model", label: "Provisionsmodell" },
  { key: "mandate.valid_from", label: "Mandat gültig ab" },
  { key: "mandate.valid_until", label: "Mandat gültig bis" },
  { key: "reservation.reservation_fee", label: "Reservationsgebühr" },
  { key: "reservation.valid_until", label: "Reservation gültig bis" },
  { key: "company.name", label: "Firmenname" },
  { key: "today", label: "Heutiges Datum" },
] as const;

const NUMERIC_KEYS = new Set([
  "property.price",
  "property.rent",
  "mandate.commission_value",
  "reservation.reservation_fee",
]);
const DATE_KEYS = new Set([
  "mandate.valid_from",
  "mandate.valid_until",
  "reservation.valid_until",
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
      // commission percent stays raw with %, fee/price as currency
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

export function wrapHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${title.replace(/</g, "&lt;")}</title>
<style>
  @page { size: A4; margin: 24mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; line-height: 1.55; max-width: 780px; margin: 32px auto; padding: 0 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  p { margin: 8px 0; }
  hr { border: 0; border-top: 1px solid #e5e5e5; margin: 24px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 14px; }
  .muted { color: #666; font-size: 12px; }
  .signature { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .signature div { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export const DEFAULT_MANDATE_TEMPLATE = `<h1>Maklervertrag (Verkaufsmandat)</h1>
<p class="muted">Datum: {{today}}</p>

<h2>Auftraggeber</h2>
<p>{{client.full_name}}<br/>{{client.address}}<br/>{{client.postal_code}} {{client.city}}</p>

<h2>Objekt</h2>
<p><strong>{{property.title}}</strong><br/>{{property.address}}, {{property.city}}</p>
<p>Verkaufspreis: <strong>{{property.price}}</strong></p>

<h2>Provision</h2>
<p>Modell: {{mandate.commission_model}}<br/>Provision: <strong>{{mandate.commission_value}}</strong></p>

<h2>Laufzeit</h2>
<p>Gültig von {{mandate.valid_from}} bis {{mandate.valid_until}}.</p>

<hr/>
<p>Mit der Unterzeichnung erteilt der Auftraggeber der Maklerin den exklusiven Auftrag, das oben genannte Objekt zu vermarkten.</p>

<div class="signature">
  <div>Auftraggeber – {{client.full_name}}</div>
  <div>Maklerin – {{company.name}}</div>
</div>`;

export const DEFAULT_RESERVATION_TEMPLATE = `<h1>Reservationsvereinbarung</h1>
<p class="muted">Datum: {{today}}</p>

<h2>Reservierende Partei</h2>
<p>{{client.full_name}}<br/>{{client.address}}<br/>{{client.postal_code}} {{client.city}}</p>

<h2>Reserviertes Objekt</h2>
<p><strong>{{property.title}}</strong><br/>{{property.address}}, {{property.city}}</p>
<p>Kaufpreis: <strong>{{property.price}}</strong></p>

<h2>Reservationsbedingungen</h2>
<p>Reservationsgebühr: <strong>{{reservation.reservation_fee}}</strong><br/>Reservation gültig bis: <strong>{{reservation.valid_until}}</strong></p>

<hr/>
<p>Die reservierende Partei sichert sich mit dieser Vereinbarung das ausschliessliche Vorkaufsrecht am oben genannten Objekt bis zum genannten Datum.</p>

<div class="signature">
  <div>Reservierende Partei – {{client.full_name}}</div>
  <div>Maklerin – {{company.name}}</div>
</div>`;
