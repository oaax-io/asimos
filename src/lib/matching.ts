import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Property = Tables<"properties">;

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
function buildCriteria(client: Client, property: Property): Criterion[] {
  const price = property.price != null ? Number(property.price) : null;
  const rent = property.rent != null ? Number(property.rent) : null;
  const value = price ?? rent;
  const bMin = client.budget_min != null ? Number(client.budget_min) : null;
  const bMax = client.budget_max != null ? Number(client.budget_max) : null;

  return [
    {
      weight: 25,
      label: "Im Budget",
      result:
        value == null || (bMin == null && bMax == null)
          ? null
          : (bMax == null || value <= bMax) && (bMin == null || value >= bMin),
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
}

export function scoreMatch(client: Client, property: Property): ScoreBreakdown {
  return scoreCriteria(buildCriteria(client, property));
}

/** Direction 1: client → properties. Filters out non-available properties and weak matches. */
export function matchClientToProperties(
  client: Client,
  properties: Property[],
  minScore = 40,
): PropertyMatch[] {
  const out: PropertyMatch[] = [];
  for (const p of properties) {
    if (p.status !== "available" && p.status !== "draft") continue;
    const r = scoreMatch(client, p);
    if (r.score >= minScore) out.push({ property: p, ...r });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Direction 2: property → clients. Only buyers/tenants are considered. */
export function matchPropertyToClients(
  property: Property,
  clients: Client[],
  minScore = 40,
): ClientMatch[] {
  const out: ClientMatch[] = [];
  for (const c of clients) {
    if (c.client_type !== "buyer" && c.client_type !== "tenant") continue;
    const r = scoreMatch(c, property);
    if (r.score >= minScore) out.push({ client: c, ...r });
  }
  return out.sort((a, b) => b.score - a.score);
}
