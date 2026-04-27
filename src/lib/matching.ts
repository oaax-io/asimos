import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Property = Tables<"properties">;

export interface MatchResult {
  property: Property;
  score: number;
  reasons: string[];
}

export function matchClientToProperties(client: Client, properties: Property[]): MatchResult[] {
  const results: MatchResult[] = [];
  for (const p of properties) {
    if (p.status !== "available") continue;
    let score = 0;
    const reasons: string[] = [];
    let possible = 0;

    if (client.preferred_listing) {
      possible += 25;
      if (p.listing_type === client.preferred_listing) { score += 25; reasons.push("Vermarktungsart passt"); }
    }
    if (client.preferred_types && client.preferred_types.length) {
      possible += 20;
      if (client.preferred_types.includes(p.property_type)) { score += 20; reasons.push("Objekttyp passt"); }
    }
    if (client.preferred_cities && client.preferred_cities.length && p.city) {
      possible += 15;
      if (client.preferred_cities.map(s => s.toLowerCase()).includes(p.city.toLowerCase())) {
        score += 15; reasons.push("Stadt passt");
      }
    }
    if (client.budget_max != null && p.price != null) {
      possible += 25;
      if (p.price <= Number(client.budget_max) && (client.budget_min == null || p.price >= Number(client.budget_min))) {
        score += 25; reasons.push("Im Budget");
      }
    }
    if (client.rooms_min != null && p.rooms != null) {
      possible += 10;
      if (Number(p.rooms) >= Number(client.rooms_min)) { score += 10; reasons.push("Zimmeranzahl ok"); }
    }
    if (client.area_min != null && p.area != null) {
      possible += 5;
      if (Number(p.area) >= Number(client.area_min)) { score += 5; reasons.push("Mindestfläche ok"); }
    }

    if (possible === 0) continue;
    const normalized = Math.round((score / possible) * 100);
    if (normalized >= 40) results.push({ property: p, score: normalized, reasons });
  }
  return results.sort((a, b) => b.score - a.score);
}
