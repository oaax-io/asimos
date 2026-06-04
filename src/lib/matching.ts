import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Property = Tables<"properties">;

/** Vereinfachte finanzielle Tragfähigkeit eines Kunden (inkl. Ehepartner/Mitantragsteller). */
export interface FinancialCapacity {
  grossIncomeYearly: number; // CHF / Jahr (Kunde + Ehepartner)
  equity: number;            // CHF (Kunde + Ehepartner)
  hasPartner: boolean;
}

export interface ScoreBreakdown {

  score: number;       // 0..100
  reasons: string[];   // positive matches
  misses: string[];    // criteria that did not match
}

export interface PropertyMatch extends ScoreBreakdown {
  property: Property;
}

export interface ClientMatch extends ScoreBreakdown {
  client: Client;
}

interface Criterion {
  weight: number;
  label: string;
  result: boolean | null; // null = not evaluable (no data on one side)
}

function scoreCriteria(criteria: Criterion[]): ScoreBreakdown {
  let total = 0;
  let earned = 0;
  const reasons: string[] = [];
  const misses: string[] = [];
  for (const c of criteria) {
    if (c.result === null) continue;
    total += c.weight;
    if (c.result) {
      earned += c.weight;
      reasons.push(c.label);
    } else {
      misses.push(c.label);
    }
  }
  const score = total === 0 ? 0 : Math.round((earned / total) * 100);
  return { score, reasons, misses };
}

/** Build the criteria array shared by both directions. */
function buildCriteria(client: Client, property: Property, capacity?: FinancialCapacity | null): Criterion[] {
  const price = property.price != null ? Number(property.price) : null;
  const rent = property.rent != null ? Number(property.rent) : null;
  const value = price ?? rent;
  const bMin = client.budget_min != null ? Number(client.budget_min) : null;
  const bMax = client.budget_max != null ? Number(client.budget_max) : null;

  // Wenn kein Budget gesetzt ist, aber finanzielle Kapazität bekannt → daraus Budgetdeckel ableiten
  const derivedMax = (() => {
    if (!capacity || capacity.grossIncomeYearly <= 0) return null;
    // Tragbarkeitsgrenze 33% von Brutto-Jahreseinkommen, kalk. 5% Zins + 1% NK + 1% Amort = 7% jährl. Kosten auf Belehnung
    // Belehnung max 80% → Preis ≈ (Einkommen * 0.33 / 0.07) / 0.80
    const maxYearlyCost = capacity.grossIncomeYearly * 0.33;
    const maxMortgage = maxYearlyCost / 0.07;
    const equity = capacity.equity;
    // Falls Eigenmittel >= 20% des resultierenden Preises, sonst durch Eigenmittel limitiert
    const priceFromMortgage = maxMortgage / 0.8;
    const priceFromEquity = equity > 0 ? equity / 0.2 : priceFromMortgage;
    return Math.min(priceFromMortgage, priceFromEquity);
  })();
  const effectiveMax = bMax ?? derivedMax;

  const criteria: Criterion[] = [
    {
      weight: 25,
      label: bMax ? "Im Budget" : "Im finanziellen Rahmen",
      result:
        value == null || (bMin == null && effectiveMax == null)
          ? null
          : (effectiveMax == null || value <= effectiveMax) && (bMin == null || value >= bMin),
    },
    {
      weight: 20,
      label: "Stadt passt",
      result:
        !property.city || !client.preferred_cities?.length
          ? null
          : client.preferred_cities.map((s) => s.toLowerCase()).includes(property.city.toLowerCase()),
    },
    {
      weight: 15,
      label: "Objekttyp passt",
      result: !client.preferred_types?.length
        ? null
        : client.preferred_types.includes(property.property_type),
    },
    {
      weight: 15,
      label: "Vermarktungsart passt",
      result: !client.preferred_listing
        ? null
        : property.listing_type === client.preferred_listing,
    },
    {
      weight: 15,
      label: "Zimmeranzahl ok",
      result:
        client.rooms_min == null || property.rooms == null
          ? null
          : Number(property.rooms) >= Number(client.rooms_min),
    },
    {
      weight: 10,
      label: "Fläche passt",
      result:
        property.area == null || (client.area_min == null && client.area_max == null)
          ? null
          : (client.area_min == null || Number(property.area) >= Number(client.area_min)) &&
            (client.area_max == null || Number(property.area) <= Number(client.area_max)),
    },
  ];

  // Finanz-Kriterien (nur wenn Selbstauskunft vorhanden ist)
  if (capacity && value != null && value > 0) {
    if (capacity.grossIncomeYearly > 0) {
      // Tragbarkeit
      const mortgage = Math.max(0, value - capacity.equity);
      const yearly = mortgage * 0.07; // 5% Zins + 1% NK + 1% Amort
      const ratio = (yearly / capacity.grossIncomeYearly) * 100;
      criteria.push({
        weight: 20,
        label: capacity.hasPartner
          ? `Tragbarkeit ${ratio.toFixed(0)}% (inkl. Ehepartner)`
          : `Tragbarkeit ${ratio.toFixed(0)}%`,
        result: ratio <= 38,
      });
    }
    if (capacity.equity > 0) {
      const ltv = ((value - capacity.equity) / value) * 100;
      criteria.push({
        weight: 15,
        label: `Belehnung ${Math.max(0, ltv).toFixed(0)}%`,
        result: ltv <= 80,
      });
    }
  }

  return criteria;
}

export function scoreMatch(client: Client, property: Property, capacity?: FinancialCapacity | null): ScoreBreakdown {
  return scoreCriteria(buildCriteria(client, property, capacity));
}


const AVAILABLE_STATUSES = new Set(["available", "active", "draft", "preparation"]);

/** Direction 1: client → properties. Filters out non-available properties and weak matches. */
export function matchClientToProperties(
  client: Client,
  properties: Property[],
  minScore = 40,
  capacity?: FinancialCapacity | null,
): PropertyMatch[] {
  const out: PropertyMatch[] = [];
  for (const p of properties) {
    if (!AVAILABLE_STATUSES.has(p.status as string)) continue;
    const r = scoreMatch(client, p, capacity);
    if (r.score >= minScore) out.push({ property: p, ...r });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Direction 2: property → clients. Only buyers/tenants are considered. */
export function matchPropertyToClients(
  property: Property,
  clients: Client[],
  minScore = 40,
  capacityByClientId?: Map<string, FinancialCapacity>,
): ClientMatch[] {
  const out: ClientMatch[] = [];
  for (const c of clients) {
    if (c.client_type !== "buyer" && c.client_type !== "tenant") continue;
    const r = scoreMatch(c, property, capacityByClientId?.get(c.id) ?? null);
    if (r.score >= minScore) out.push({ client: c, ...r });
  }
  return out.sort((a, b) => b.score - a.score);
}

