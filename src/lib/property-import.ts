// Phase 1 — Minimal CasaOne CSV property importer.
// Maps a fixed set of fields, stores the original row in raw_import.

export type RawRow = Record<string, string>;

type ListingType = "sale" | "rent" | "both";
type PropertyType = "apartment" | "house" | "commercial" | "land" | "parking" | "mixed_use" | "other";
type PropertyStatus =
  | "draft"
  | "preparation"
  | "active"
  | "available"
  | "reserved"
  | "sold"
  | "rented"
  | "archived";

export type StagedProperty = {
  row_index: number;
  insertable: Record<string, unknown> | null;
  skipped_reason?: string;
  raw: RawRow;
};

// Case-insensitive lookup helpers
function findKey(row: RawRow, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const lc = cand.toLowerCase();
    const k = keys.find((x) => x.trim().toLowerCase() === lc);
    if (k) return k;
  }
  return undefined;
}

function pick(row: RawRow, candidates: string[]): string | null {
  const k = findKey(row, candidates);
  if (!k) return null;
  const v = row[k];
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function toNumber(v: string | null): number | null {
  if (!v) return null;
  // CH/DE-friendly: remove spaces, apostrophes (CH thousand sep), and convert "," → "."
  const cleaned = v
    .replace(/['\s\u00A0]/g, "")
    .replace(/[A-Za-z€$£]/g, "")
    .replace(/,(\d{1,2})$/, ".$1") // decimal comma at end
    .replace(/,/g, ""); // remaining commas as thousand sep
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: string | null): number | null {
  const n = toNumber(v);
  if (n == null) return null;
  return Math.trunc(n);
}

function toDate(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    // try DD.MM.YYYY
    const m = v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const yr = yyyy.length === 2 ? `20${yyyy}` : yyyy;
      const d2 = new Date(`${yr}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
      if (!Number.isNaN(d2.getTime())) return d2.toISOString();
    }
    return null;
  }
  return d.toISOString();
}

function toDateOnly(v: string | null): string | null {
  const iso = toDate(v);
  return iso ? iso.slice(0, 10) : null;
}

function mapListingType(v: string | null): ListingType {
  if (!v) return "sale";
  const s = v.trim().toLowerCase();
  if (s.startsWith("rent") || s.startsWith("miet") || s.startsWith("verm")) return "rent";
  if (s.startsWith("buy") || s.startsWith("kauf") || s.startsWith("verk") || s.startsWith("sale")) return "sale";
  return "sale";
}

function mapStatus(v: string | null): PropertyStatus {
  if (!v) return "draft";
  const s = v.trim().toLowerCase();
  if (s.includes("aktiv") || s === "active") return "active";
  if (s.includes("bearbeit") || s.includes("preparation") || s.includes("entwurf") || s === "draft") return "preparation";
  if (s.includes("reserv")) return "reserved";
  if (s.includes("verkauft") || s === "sold") return "sold";
  if (s.includes("vermiet") || s === "rented") return "rented";
  if (s.includes("archiv")) return "archived";
  return "draft";
}

function mapPropertyType(v: string | null): PropertyType {
  if (!v) return "other";
  // First category if comma/semicolon separated
  const first = v.split(/[,;|/]/)[0].trim().toLowerCase();
  if (first.includes("einfamilien") || first.includes("reihenhaus") || first.includes("mehrfamilien") || first.includes("haus") || first === "house")
    return "house";
  if (first.includes("wohnung") || first === "apartment") return "apartment";
  if (first.includes("gewerbe") || first.includes("commercial") || first.includes("büro") || first.includes("buero")) return "commercial";
  if (first.includes("grundstück") || first.includes("grundstuck") || first.includes("land")) return "land";
  if (first.includes("park") || first.includes("garage")) return "parking";
  return "other";
}

function joinAddress(street: string | null, houseNo: string | null): string | null {
  const parts = [street, houseNo].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(" ").trim();
}

export function buildStagedProperty(
  rowIndex: number,
  raw: RawRow,
  batchId: string,
): StagedProperty {
  const title = pick(raw, ["Titel", "Title", "title"]);
  const street = pick(raw, ["Strasse", "Straße", "Street", "street"]);
  const houseNo = pick(raw, ["Hausnummer", "House No", "House Number", "Nr", "Nr."]);
  const address = joinAddress(street, houseNo);
  const postal_code = pick(raw, ["PLZ", "Postal Code", "ZIP", "zip"]);
  const city = pick(raw, ["Ort", "Stadt", "City", "city"]);
  const country = pick(raw, ["Land", "Country", "country"]);
  const old_crm_id = pick(raw, ["Reference-Nr.", "Reference No", "Reference", "ID", "id", "Referenz"]);

  // Validation
  const hasTitle = !!title;
  const hasAddrCity = !!address && !!city;
  const hasOldId = !!old_crm_id;
  if (!hasTitle && !hasAddrCity && !hasOldId) {
    return {
      row_index: rowIndex,
      insertable: null,
      skipped_reason: "Pflichtangaben fehlen (kein Titel, keine Adresse+Ort, keine Referenz-Nr).",
      raw,
    };
  }

  const listing_type = mapListingType(pick(raw, ["Vermarktungsart", "Marketing Type", "marketing_type", "Listing Type"]));
  const status = mapStatus(pick(raw, ["Status", "status"]));
  const property_type = mapPropertyType(pick(raw, ["Kategorie", "Category", "Objektart", "Property Type", "Type"]));

  const rooms = toNumber(pick(raw, ["Zimmer", "Rooms", "rooms"]));
  const bathrooms = toNumber(pick(raw, ["Nasszellen", "Bathrooms", "bathrooms", "Bäder"]));
  const total_floors = toInt(pick(raw, ["Etagen", "Total Floors", "Stockwerke"]));
  const floor = toInt(pick(raw, ["Etage", "Floor", "Stockwerk"]));
  const year_built = toInt(pick(raw, ["Baujahr", "Year Built", "year_built"]));
  const renovated_at = toInt(pick(raw, ["Renovationsjahr", "Renovated", "Renovation Year"]));
  const living_area = toNumber(pick(raw, ["Nettowohnfläche", "Nettowohnflaeche", "Living Area", "Wohnfläche", "Wohnflaeche"]));
  const plot_area = toNumber(pick(raw, ["Grundstücksfläche", "Grundstuecksflaeche", "Plot Area", "Grundstück"]));
  const price = toNumber(pick(raw, ["Verkaufspreis", "Price", "Kaufpreis", "Sale Price"]));
  const rent = toNumber(pick(raw, ["Bruttomiete", "Rent", "Miete", "Gross Rent"]));
  const availability_date = toDateOnly(pick(raw, ["Verfügbar ab", "Verfuegbar ab", "Available From", "Bezugsdatum"]));
  const energy_source = pick(raw, ["Wärmeerzeugung", "Waermeerzeugung", "Heat Generation", "Energy Source"]);
  const heating_type = pick(raw, ["Wärmeverteilung", "Waermeverteilung", "Heat Distribution", "Heating Type"]);
  const created_at = toDate(pick(raw, ["Erfasst", "Created At", "Created"]));
  const updated_at = toDate(pick(raw, ["Letztes Update", "Updated At", "Updated"]));

  const insertable: Record<string, unknown> = {
    title: title ?? address ?? old_crm_id ?? "(ohne Titel)",
    listing_type,
    status,
    property_type,
    address,
    postal_code,
    city,
    country,
    rooms,
    bathrooms,
    total_floors,
    floor,
    year_built,
    renovated_at,
    living_area,
    plot_area,
    price,
    rent,
    availability_date,
    energy_source,
    heating_type,
    old_crm_id,
    import_source: "CasaOne CSV",
    import_batch_id: batchId,
    raw_import: raw,
  };
  if (created_at) insertable.created_at = created_at;
  if (updated_at) insertable.updated_at = updated_at;

  // Strip null/undefined to avoid overriding column defaults unnecessarily
  for (const k of Object.keys(insertable)) {
    if (insertable[k] === null || insertable[k] === undefined) {
      // Keep null for explicitly nullable columns is fine, but cleaner to drop them
      delete insertable[k];
    }
  }

  return { row_index: rowIndex, insertable, raw };
}
