// Dynamische Feld-Konfiguration je Finanzierungsart
// Phase A: unterstützt Kombinationen mehrerer Module.
// Schweizer Rechtschreibung, kein ß.
import type { FinancingType } from "./financing";

export type FieldKey =
  | "purchase_price"
  | "purchase_additional_costs"
  | "renovation_costs"
  | "renovation_description"
  | "renovation_value_increase"
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
  purchase_additional_costs: { key: "purchase_additional_costs", label: "Kaufnebenkosten (CHF)", type: "number" } as FieldDef,
  renovation_costs: { key: "renovation_costs", label: "Renovationskosten (CHF)", required: true, type: "number" } as FieldDef,
  renovation_description: { key: "renovation_description", label: "Renovationsbeschreibung", type: "text" } as FieldDef,
  renovation_value_increase: { key: "renovation_value_increase", label: "Geschätzte Wertsteigerung (CHF)", type: "number" } as FieldDef,
  property_value: { key: "property_value", label: "Immobilienwert (CHF)", required: true, type: "number" } as FieldDef,
  existing_mortgage: { key: "existing_mortgage", label: "Bestehende Hypothek (CHF)", required: true, type: "number" } as FieldDef,
  requested_mortgage: { key: "requested_mortgage", label: "Gewünschte Hypothek (CHF)", required: true, type: "number" } as FieldDef,
  requested_increase: { key: "requested_increase", label: "Gewünschte Erhöhung (CHF)", required: true, type: "number" } as FieldDef,
  new_total_mortgage: { key: "new_total_mortgage", label: "Neue Gesamthypothek (CHF)", type: "number" } as FieldDef,
  land_price: { key: "land_price", label: "Landpreis (CHF)", required: true, type: "number" } as FieldDef,
  construction_costs: { key: "construction_costs", label: "Baukosten (CHF)", required: true, type: "number" } as FieldDef,
  construction_additional_costs: { key: "construction_additional_costs", label: "Baunebenkosten (CHF)", type: "number" } as FieldDef,
  current_bank: { key: "current_bank", label: "Aktuelle Bank", type: "text" } as FieldDef,
  interest_rate_expiry: { key: "interest_rate_expiry", label: "Zinsablauf", type: "date" } as FieldDef,
  own_funds_total: { key: "own_funds_total", label: "Eigenmittel total (CHF)", required: true, type: "number" } as FieldDef,
  own_funds_pension_fund: { key: "own_funds_pension_fund", label: "davon Pensionskasse (CHF)", type: "number" } as FieldDef,
  own_funds_vested_benefits: { key: "own_funds_vested_benefits", label: "davon Freizügigkeit (CHF)", type: "number" } as FieldDef,
  gross_income_yearly: { key: "gross_income_yearly", label: "Bruttoeinkommen jährlich (CHF)", required: true, type: "number" } as FieldDef,
};

// Felder pro einzelnem Modul (ohne Eigenmittel/Einkommen — die kommen separat)
export const FIELDS_BY_MODULE: Record<FinancingType, FieldDef[]> = {
  purchase: [F.purchase_price, F.purchase_additional_costs],
  renovation: [
    // property_value nur dann required, wenn KEIN Kauf/Neubau im Modul-Set ist – dynamisch in fieldsForModules()
    F.property_value,
    F.renovation_costs,
    F.renovation_description,
    F.renovation_value_increase,
  ],
  increase: [F.property_value, F.existing_mortgage, F.requested_increase],
  refinance: [F.property_value, F.existing_mortgage, F.requested_mortgage, F.current_bank, F.interest_rate_expiry],
  new_build: [F.land_price, F.construction_costs, F.construction_additional_costs],
  mortgage_increase: [F.property_value, F.existing_mortgage, F.requested_increase],
};

// Globale Felder (immer benötigt)
export const GLOBAL_FIELDS: FieldDef[] = [
  F.requested_mortgage, // Standard: gewünschte Hypothek (wird ggf. von refinance überschrieben)
  F.own_funds_total,
  F.own_funds_pension_fund,
  F.own_funds_vested_benefits,
  F.gross_income_yearly,
];

// Vereinigung der Felder über mehrere Module, mit Sonderlogik:
// - Wenn Kauf oder Neubau aktiv ist, wird property_value bei Renovation NICHT mehr verlangt
//   (Gesamtinvestition basiert dann auf Kauf/Bau).
// - requested_mortgage ist Pflicht ausser bei reiner Aufstockung/Erhöhung
//   (dort zählt requested_increase).
export function fieldsForModules(modules: FinancingType[]): FieldDef[] {
  const set = new Set(modules);
  const seen = new Set<FieldKey>();
  const out: FieldDef[] = [];

  const push = (f: FieldDef, overrides?: Partial<FieldDef>) => {
    if (seen.has(f.key)) return;
    seen.add(f.key);
    out.push({ ...f, ...overrides });
  };

  const hasPurchaseOrBuild = set.has("purchase") || set.has("new_build");
  const onlyIncrease =
    Array.from(set).every((m) => m === "increase" || m === "mortgage_increase");

  for (const m of modules) {
    for (const f of FIELDS_BY_MODULE[m]) {
      if (m === "renovation" && f.key === "property_value" && hasPurchaseOrBuild) {
        // nicht erneut nötig
        continue;
      }
      push(f);
    }
  }

  // Globale Felder anhängen
  for (const f of GLOBAL_FIELDS) {
    if (f.key === "requested_mortgage") {
      // bei reiner Aufstockung nicht zwingend (requested_increase reicht)
      if (onlyIncrease) continue;
      // bei refinance ist es bereits durch das Modul abgedeckt → übergehen wenn schon drin
      if (seen.has("requested_mortgage")) continue;
      push(f);
      continue;
    }
    push(f);
  }

  return out;
}

export type DynamicForm = Partial<Record<FieldKey, string>>;

export type ComputedFinancing = {
  total_investment: number;
  effective_mortgage: number;
  reference_value: number; // für LTV
  new_total_mortgage: number;
};

// Multi-Modul Berechnung
export function computeFinancingMulti(modules: FinancingType[], f: DynamicForm): ComputedFinancing {
  const n = (k: FieldKey) => num(f[k]);
  const set = new Set(modules);

  // Gesamtinvestition
  let invest = 0;
  if (set.has("purchase")) invest += n("purchase_price") + n("purchase_additional_costs");
  if (set.has("new_build")) invest += n("land_price") + n("construction_costs") + n("construction_additional_costs");
  if (set.has("renovation")) invest += n("renovation_costs");

  // Wenn weder Kauf noch Neubau, aber Objektwert vorhanden → Objektwert als Basis
  if (!set.has("purchase") && !set.has("new_build")) {
    invest += n("property_value");
  }

  // Effektive / neue Hypothek
  let mortgage = 0;
  if (set.has("refinance")) {
    mortgage = n("requested_mortgage") || n("existing_mortgage");
  } else if (set.has("purchase") || set.has("new_build")) {
    mortgage = n("requested_mortgage");
    // Bei Kombination mit Aufstockung/Erhöhung kommt die Erhöhung dazu
    if (set.has("increase") || set.has("mortgage_increase")) {
      mortgage += n("requested_increase");
    }
  } else if (set.has("increase") || set.has("mortgage_increase") || set.has("renovation")) {
    mortgage = n("existing_mortgage") + n("requested_increase");
    if (mortgage === 0) mortgage = n("requested_mortgage");
  } else {
    mortgage = n("requested_mortgage");
  }

  const reference = invest > 0 ? invest : n("property_value");

  return {
    total_investment: invest,
    effective_mortgage: mortgage,
    reference_value: reference,
    new_total_mortgage: mortgage,
  };
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

// --- Backwards-compat (alte Single-Type API, falls noch irgendwo importiert) ---
export const FIELDS_BY_TYPE: Record<FinancingType, FieldDef[]> = {
  purchase: fieldsForModules(["purchase"]),
  renovation: fieldsForModules(["renovation"]),
  increase: fieldsForModules(["increase"]),
  refinance: fieldsForModules(["refinance"]),
  new_build: fieldsForModules(["new_build"]),
  mortgage_increase: fieldsForModules(["mortgage_increase"]),
};

export function computeFinancing(type: FinancingType, f: DynamicForm): ComputedFinancing {
  return computeFinancingMulti([type], f);
}
