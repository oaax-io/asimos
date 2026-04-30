// Shared types & helpers for the Leads-Import flow.

export type LeadField =
  | "skip"
  | "full_name"
  | "entity_type"
  | "company_name"
  | "contact_first_name"
  | "contact_last_name"
  | "email"
  | "secondary_email"
  | "phone"
  | "phone_direct"
  | "mobile"
  | "address"
  | "postal_code"
  | "city"
  | "country"
  | "website"
  | "language"
  | "tags"
  | "notes"
  | "internal_notes"
  | "source"
  | "status"
  | "old_crm_id"
  | "old_crm_created_at"
  | "old_crm_updated_at";

export const LEAD_FIELD_LABELS: Record<LeadField, string> = {
  skip: "— Spalte ignorieren —",
  full_name: "Name (vollständig)",
  entity_type: "Entität (person/company)",
  company_name: "Firma",
  contact_first_name: "Vorname",
  contact_last_name: "Nachname",
  email: "E-Mail",
  secondary_email: "E-Mail (zweite)",
  phone: "Telefon",
  phone_direct: "Telefon direkt",
  mobile: "Mobile",
  address: "Adresse",
  postal_code: "PLZ",
  city: "Ort",
  country: "Land",
  website: "Webseite",
  language: "Sprache",
  tags: "Tags (Komma getrennt)",
  notes: "Notizen",
  internal_notes: "Interne Notizen",
  source: "Quelle",
  status: "Status",
  old_crm_id: "Alte CRM-ID",
  old_crm_created_at: "Erfasst (alt)",
  old_crm_updated_at: "Letztes Update (alt)",
};

export const CASAONE_MAPPING: Record<string, LeadField> = {
  id: "old_crm_id",
  entität: "entity_type",
  entitaet: "entity_type",
  entity: "entity_type",
  firma: "company_name",
  company: "company_name",
  vorname: "contact_first_name",
  firstname: "contact_first_name",
  "first name": "contact_first_name",
  nachname: "contact_last_name",
  lastname: "contact_last_name",
  "last name": "contact_last_name",
  "e-mail 1": "email",
  "email 1": "email",
  email: "email",
  "e-mail": "email",
  "e-mail 2": "secondary_email",
  "email 2": "secondary_email",
  telefon: "phone",
  phone: "phone",
  "telefon direkt": "phone_direct",
  "phone direct": "phone_direct",
  mobile: "mobile",
  mobil: "mobile",
  handy: "mobile",
  adresse: "address",
  address: "address",
  plz: "postal_code",
  "postal code": "postal_code",
  zip: "postal_code",
  ort: "city",
  city: "city",
  stadt: "city",
  land: "country",
  country: "country",
  webseite: "website",
  website: "website",
  sprache: "language",
  language: "language",
  tags: "tags",
  notizen: "notes",
  notes: "notes",
  "interne notizen": "internal_notes",
  "internal notes": "internal_notes",
  erfasst: "old_crm_created_at",
  "created at": "old_crm_created_at",
  "letztes update": "old_crm_updated_at",
  "updated at": "old_crm_updated_at",
  status: "status",
};

/** Auto-detect mapping for a header row (case-insensitive). */
export function autoDetectMapping(headers: string[]): Record<number, LeadField> {
  const out: Record<number, LeadField> = {};
  headers.forEach((raw, idx) => {
    const key = raw?.trim().toLowerCase();
    if (!key) {
      out[idx] = "skip";
      return;
    }
    const mapped = CASAONE_MAPPING[key];
    if (mapped) {
      out[idx] = mapped;
      return;
    }
    // Try direct match against field keys
    const directMatch = (Object.keys(LEAD_FIELD_LABELS) as LeadField[]).find(
      (f) => f.toLowerCase() === key,
    );
    out[idx] = directMatch ?? "skip";
  });
  return out;
}

export type ParsedRow = Record<string, string>;

export type StagedLead = {
  row_index: number;
  entity_type: "person" | "company";
  full_name: string;
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string | null;
  secondary_email: string | null;
  phone: string | null;
  phone_direct: string | null;
  mobile: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  language: string | null;
  tags: string[];
  notes: string | null;
  internal_notes: string | null;
  source: string | null;
  status: string | null;
  old_crm_id: string | null;
  old_crm_created_at: string | null;
  old_crm_updated_at: string | null;
  errors: string[];
  warnings: string[];
  duplicate_of: string | null; // existing lead id
  decision: "create" | "skip" | "update";
};

const VALID_STATUSES = new Set([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "converted",
  "lost",
]);

function pick(row: Record<string, string | undefined>, field: LeadField): string | null {
  const v = row[field];
  if (v == null) return null;
  const trimmed = String(v).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseTags(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Build a per-row staged lead from a parsed CSV row.
 * `row` is keyed by LeadField (after applying the column mapping).
 */
export function buildStagedLead(
  rowIndex: number,
  row: Record<string, string>,
): StagedLead {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawEntity = pick(row, "entity_type")?.toLowerCase() ?? "";
  let entity_type: "person" | "company" = "person";
  if (
    rawEntity.startsWith("firma") ||
    rawEntity.startsWith("company") ||
    rawEntity.startsWith("organis")
  ) {
    entity_type = "company";
  } else if (rawEntity.startsWith("person")) {
    entity_type = "person";
  }

  const company_name = pick(row, "company_name");
  const contact_first_name = pick(row, "contact_first_name");
  const contact_last_name = pick(row, "contact_last_name");

  // If company + contact names present → company entity with contact person
  if (company_name && (contact_first_name || contact_last_name)) {
    entity_type = "company";
  } else if (company_name && !contact_first_name && !contact_last_name) {
    entity_type = "company";
  }

  // Build display name
  let full_name = pick(row, "full_name") ?? "";
  if (!full_name) {
    if (entity_type === "company") {
      const contact = [contact_first_name, contact_last_name].filter(Boolean).join(" ");
      full_name = company_name ?? contact;
      if (company_name && contact) full_name = `${company_name} (${contact})`;
    } else {
      full_name = [contact_first_name, contact_last_name].filter(Boolean).join(" ");
    }
  }
  if (!full_name) {
    errors.push("Kein Name vorhanden (weder vollständiger Name, noch Vor-/Nachname, noch Firma).");
  }

  const email = pick(row, "email");
  const phone = pick(row, "phone");
  const mobile = pick(row, "mobile");
  if (!email) warnings.push("Keine E-Mail.");
  if (!phone && !mobile) warnings.push("Keine Telefonnummer.");

  let status = pick(row, "status")?.toLowerCase() ?? null;
  if (status && !VALID_STATUSES.has(status)) {
    warnings.push(`Unbekannter Status "${status}" → wird auf "new" gesetzt.`);
    status = "new";
  }

  return {
    row_index: rowIndex,
    entity_type,
    full_name: full_name || "(ohne Namen)",
    company_name,
    contact_first_name,
    contact_last_name,
    email,
    secondary_email: pick(row, "secondary_email"),
    phone,
    phone_direct: pick(row, "phone_direct"),
    mobile,
    address: pick(row, "address"),
    postal_code: pick(row, "postal_code"),
    city: pick(row, "city"),
    country: pick(row, "country"),
    website: pick(row, "website"),
    language: pick(row, "language"),
    tags: parseTags(pick(row, "tags")),
    notes: pick(row, "notes"),
    internal_notes: pick(row, "internal_notes"),
    source: pick(row, "source"),
    status,
    old_crm_id: pick(row, "old_crm_id"),
    old_crm_created_at: parseDate(pick(row, "old_crm_created_at")),
    old_crm_updated_at: parseDate(pick(row, "old_crm_updated_at")),
    errors,
    warnings,
    duplicate_of: null,
    decision: "create",
  };
}

export function applyMapping(
  rawRow: ParsedRow,
  headers: string[],
  mapping: Record<number, LeadField>,
): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((h, idx) => {
    const target = mapping[idx];
    if (!target || target === "skip") return;
    const v = rawRow[h];
    if (v == null) return;
    // If multiple columns map to same field, keep first non-empty
    if (out[target] && String(out[target]).trim().length > 0) return;
    out[target] = String(v);
  });
  return out;
}
