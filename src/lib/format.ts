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

export const clientTypeLabels = {
  buyer: "Käufer",
  seller: "Verkäufer",
  tenant: "Mieter",
  landlord: "Vermieter",
  investor: "Investor",
  other: "Sonstige",
} as const;

export const propertyStatusLabels = {
  draft: "Entwurf",
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
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
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
