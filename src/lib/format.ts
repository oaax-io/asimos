export type PropertyType = "apartment" | "house" | "commercial" | "land" | "parking" | "mixed_use" | "other";
export type ListingType = "sale" | "rent";

export const propertyTypeLabels: Record<PropertyType, string> = {
  apartment: "Wohnung",
  house: "Haus",
  commercial: "Gewerbe",
  land: "Grundstück",
  parking: "Parkplatz",
  mixed_use: "Mischnutzung",
  other: "Sonstiges",
};

export const listingTypeLabels: Record<ListingType, string> = {
  sale: "Kauf",
  rent: "Miete",
};

export const leadStatusLabels = {
  new: "Neu",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  converted: "Konvertiert",
  lost: "Verloren",
} as const;
export type LeadStatus = keyof typeof leadStatusLabels;
export const leadStatuses: LeadStatus[] = ["new","contacted","qualified","converted","lost"];

// Tailwind classes per lead status (badge & dot). Uses utility colors so we
// don't depend on extra design tokens.
export const leadStatusColors: Record<LeadStatus, {
  badge: string;   // full badge classes
  dot: string;     // small color dot
  ring: string;    // ring/border accent for kanban column
}> = {
  new:        { badge: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400",       dot: "bg-blue-500",    ring: "border-blue-500/40" },
  contacted:  { badge: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",   dot: "bg-amber-500",   ring: "border-amber-500/40" },
  qualified:  { badge: "bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400", dot: "bg-violet-500", ring: "border-violet-500/40" },
  converted:  { badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400", dot: "bg-emerald-500", ring: "border-emerald-500/40" },
  lost:       { badge: "bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400",       dot: "bg-rose-500",    ring: "border-rose-500/40" },
};

export const clientTypeLabels = {
  buyer: "Käufer",
  seller: "Verkäufer",
  owner: "Eigentümer",
  tenant: "Mieter",
  landlord: "Vermieter",
  investor: "Investor",
  other: "Sonstige",
} as const;

export const propertyStatusLabels = {
  draft: "Entwurf",
  preparation: "Vorbereitung",
  active: "Aktiv",
  available: "Verfügbar",
  reserved: "Reserviert",
  sold: "Verkauft",
  rented: "Vermietet",
  archived: "Archiviert",
} as const;

export const apptTypeLabels = {
  viewing: "Besichtigung",
  meeting: "Meeting",
  call: "Telefonat",
  other: "Sonstiges",
} as const;

export function formatCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}

export function formatArea(n: number | null | undefined) {
  if (n == null) return "—";
  return `${new Intl.NumberFormat("de-DE").format(n)} m²`;
}

export function formatDate(d: string | Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(d));
}

export function formatDateTime(d: string | Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}
