// Dynamische Feld-Konfiguration je Finanzierungsart
// Schweizer Rechtschreibung, kein ß.
import type { FinancingType } from "./financing";

export type FieldKey =
  | "purchase_price"
  | "renovation_costs"
  | "property_value"
  | "existing_mortgage"
  | "requested_mortgage"
  | "requested_increase"
  | "new_total_mortgage"
  | "land_price"
  | "construction_costs"
  | "construction_additional_costs"
  | "current_bank"
  | "interest_rate_expiry"
  | "own_funds_total"
  | "own_funds_pension_fund"
  | "own_funds_vested_benefits"
  | "gross_income_yearly";

export type FieldDef = { key: FieldKey; label: string; required?: boolean; type?: "number" | "text" | "date" };

const F = {
  purchase_price: { key: "purchase_price", label: "Kaufpreis (CHF)", required: true, type: "number" } as FieldDef,
  renovation_costs: { key: "renovation_costs", label: "Renovationskosten (CHF)", type: "number" } as FieldDef,
  property_value: { key: "property_value", label: "Immobilienwert (CHF)", required: true, type: "number" } as FieldDef,
  existing_mortgage: { key: "existing_mortgage", label: "Bestehende Hypothek (CHF)", required: true, type: "number" } as FieldDef,
  requested_mortgage: { key: "requested_mortgage", label: "Gewünschte Hypothek (CHF)", required: true, type: "number" } as FieldDef,
  requested_increase: { key: "requested_increase", label: "Gewünschte Erhöhung / Aufstockung (CHF)", required: true, type: "number" } as FieldDef,
  new_total_mortgage: { key: "new_total_mortgage", label: "Neue Gesamthypothek (CHF)", type: "number" } as FieldDef,
  land_price: { key: "land_price", label: "Landpreis (CHF)", required: true, type: "number" } as FieldDef,
  construction_costs: { key: "construction_costs", label: "Baukosten (CHF)", required: true, type: "number" } as FieldDef,
  construction_additional_costs: { key: "construction_additional_costs", label: "Baunebenkosten (CHF)", type: "number" } as FieldDef,
  current_bank: { key: "current_bank", label: "Aktuelle Bank", type: "text" } as FieldDef,
  interest_rate_expiry: { key: "interest_rate_expiry", label: "Zinsablauf", type: "date" } as FieldDef,
  own_funds_total: { key: "own_funds_total", label: "Eigenmittel total (CHF)", type: "number" } as FieldDef,
  own_funds_pension_fund: { key: "own_funds_pension_fund", label: "davon Pensionskasse (CHF)", type: "number" } as FieldDef,
  own_funds_vested_benefits: { key: "own_funds_vested_benefits", label: "davon Freizügigkeit (CHF)", type: "number" } as FieldDef,
  gross_income_yearly: { key: "gross_income_yearly", label: "Bruttoeinkommen jährlich (CHF)", required: true, type: "number" } as FieldDef,
};

export const FIELDS_BY_TYPE: Record<FinancingType, FieldDef[]> = {
  purchase: [
    F.purchase_price,
    F.renovation_costs,
    F.requested_mortgage,
    { ...F.own_funds_total, required: true },
    F.own_funds_pension_fund,
    F.own_funds_vested_benefits,
    F.gross_income_yearly,
  ],
  renovation: [
    F.property_value,
    F.existing_mortgage,
    { ...F.renovation_costs, required: true },
    F.requested_increase,
    F.gross_income_yearly,
    F.own_funds_total,
  ],
  increase: [
    F.property_value,
    F.existing_mortgage,
    F.requested_increase,
    F.gross_income_yearly,
  ],
  refinance: [
    F.property_value,
    F.existing_mortgage,
    F.requested_mortgage,
    F.current_bank,
    F.interest_rate_expiry,
    F.gross_income_yearly,
  ],
  new_build: [
    F.land_price,
    F.construction_costs,
    F.construction_additional_costs,
    F.requested_mortgage,
    { ...F.own_funds_total, required: true },
    F.own_funds_pension_fund,
    F.own_funds_vested_benefits,
    F.gross_income_yearly,
  ],
  mortgage_increase: [
    F.property_value,
    F.existing_mortgage,
    F.requested_increase,
    F.gross_income_yearly,
  ],
};

export type DynamicForm = Partial<Record<FieldKey, string>>;

export type ComputedFinancing = {
  total_investment: number;
  effective_mortgage: number; // die für LTV/Tragbarkeit relevante Hypothek
  reference_value: number; // Objektwert oder Gesamtinvestition
};

export function computeFinancing(type: FinancingType, f: DynamicForm): ComputedFinancing {
  const n = (k: FieldKey) => num(f[k]);
  switch (type) {
    case "purchase": {
      const total = n("purchase_price") + n("renovation_costs");
      return { total_investment: total, effective_mortgage: n("requested_mortgage"), reference_value: total };
    }
    case "renovation": {
      const total = n("property_value") + n("renovation_costs");
      const mort = n("existing_mortgage") + n("requested_increase");
      return { total_investment: total, effective_mortgage: mort, reference_value: total };
    }
    case "increase":
    case "mortgage_increase": {
      const mort = n("existing_mortgage") + n("requested_increase");
      const ref = n("property_value");
      return { total_investment: ref, effective_mortgage: mort, reference_value: ref };
    }
    case "refinance": {
      const mort = n("requested_mortgage") || n("existing_mortgage");
      const ref = n("property_value");
      return { total_investment: ref, effective_mortgage: mort, reference_value: ref };
    }
    case "new_build": {
      const total = n("land_price") + n("construction_costs") + n("construction_additional_costs");
      return { total_investment: total, effective_mortgage: n("requested_mortgage"), reference_value: total };
    }
  }
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function toNumOrNull(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
