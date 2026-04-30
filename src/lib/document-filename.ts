// Builds personalized filenames for generated documents.
// Format: YYYY-MM-DD_COMPANY_DOCUMENT_CLIENT.pdf
// Example: 2026-04-30_ASIMO_Maklermandat_BilelChagra.pdf

export type DocumentTypeKey =
  | "mandate"
  | "mandate_partial"
  | "reservation"
  | "reservation_receipt"
  | "nda"
  | "financing_check"
  | "expose"
  | "contract"
  | "other"
  | string;

const DOCUMENT_LABELS: Record<string, string> = {
  mandate: "Maklermandat",
  mandate_partial: "Maklermandat",
  reservation: "Reservation",
  reservation_receipt: "Reservation",
  nda: "NDA",
  financing_check: "FinanzierungsCheck",
  expose: "Expose",
  contract: "Vertrag",
  other: "Dokument",
};

/**
 * Sanitize a string for safe use in filenames:
 * - Transliterates German umlauts and common accents
 * - Removes diacritics
 * - Strips whitespace and filesystem-reserved characters
 * - Keeps PascalCase-like result without spaces
 */
export function sanitizeForFilename(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input).trim();

  // German umlauts and ß (must run before NFD strips diacritics)
  s = s
    .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss");

  // Strip remaining diacritics (é → e, è → e, à → a, ñ → n, …)
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Remove characters that are illegal or annoying in filenames
  // Reserved: / \ : * ? " < > | plus control chars
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "");

  // Replace ampersands and similar separators with nothing
  s = s.replace(/[&+]+/g, "");

  // Collapse all whitespace and remove it (PascalCase-style join)
  s = s.replace(/\s+/g, "");

  // Drop anything that's not a safe filename char
  s = s.replace(/[^A-Za-z0-9._-]/g, "");

  return s;
}

function formatDate(date: Date | string | null | undefined): string {
  const d = date instanceof Date ? date : date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) return formatDate(new Date());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function documentTypeLabel(type: DocumentTypeKey | null | undefined): string {
  if (!type) return DOCUMENT_LABELS.other;
  return DOCUMENT_LABELS[type] ?? sanitizeForFilename(type) || DOCUMENT_LABELS.other;
}

export type BuildDocumentFileNameInput = {
  company?: string | null;
  documentType?: DocumentTypeKey | null;
  /** Custom document label, overrides the type-based label (e.g. for "Sonstiges"). */
  documentLabel?: string | null;
  clientName?: string | null;
  propertyTitle?: string | null;
  /** Used as last fallback identifier when no client/property exists. */
  documentId?: string | null;
  date?: Date | string | null;
  /** File extension without dot, default 'pdf'. */
  extension?: string;
};

/**
 * Build a personalized filename like
 *   2026-04-30_ASIMO_Maklermandat_BilelChagra.pdf
 *
 * Falls back gracefully when individual parts are missing.
 */
export function buildDocumentFileName(input: BuildDocumentFileNameInput): string {
  const datePart = formatDate(input.date);
  const companyPart = sanitizeForFilename(input.company) || "Dokument";
  const documentPart =
    sanitizeForFilename(input.documentLabel) ||
    sanitizeForFilename(documentTypeLabel(input.documentType)) ||
    "Dokument";

  let subjectPart = sanitizeForFilename(input.clientName);
  if (!subjectPart) subjectPart = sanitizeForFilename(input.propertyTitle);
  if (!subjectPart && input.documentId) subjectPart = sanitizeForFilename(input.documentId.slice(0, 8));
  if (!subjectPart) subjectPart = "Dokument";

  const ext = (input.extension ?? "pdf").replace(/^\.+/, "");
  return `${datePart}_${companyPart}_${documentPart}_${subjectPart}.${ext}`;
}
